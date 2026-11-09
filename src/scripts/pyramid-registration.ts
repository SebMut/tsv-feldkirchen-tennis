import { supabase } from '../lib/supabase';
import { setStatus } from '../lib/ui';

type TurnstileWidget = {
  render: (target: HTMLElement, config: Record<string, unknown>) => string | number;
  reset: (id?: string | number) => void;
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
let turnstile: TurnstileWidget | undefined;
let widgetId: string | number | undefined;
let captchaToken = '';
let captchaRequired = false;

function message(value: string, tone: 'info' | 'success' | 'error' = 'info') {
  const target = byId('pyramid-registration-status');
  if (!target) return;
  target.classList.remove('hidden');
  setStatus(target, value, tone);
}

async function setupCaptcha() {
  const wrap = byId('pyramid-register-turnstile-wrap');
  const target = byId('pyramid-register-turnstile');
  if (!wrap || !target) return;
  try {
    const { data, error } = await supabase.functions.invoke('pyramid-access-email', { body: { action: 'config' } });
    if (error || !data?.enabled || typeof data.siteKey !== 'string') return;
    captchaRequired = true;
    wrap.classList.remove('hidden');
    const browser = window as Window & { turnstile?: TurnstileWidget };
    if (!browser.turnstile) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Sicherheitsprüfung konnte nicht geladen werden.'));
        document.head.append(script);
      });
    }
    turnstile = browser.turnstile;
    if (!turnstile) throw new Error('Sicherheitsprüfung nicht verfügbar.');
    widgetId = turnstile.render(target, {
      sitekey: data.siteKey,
      theme: 'light',
      size: 'flexible',
      callback: (token: string) => {
        captchaToken = token;
        const status = byId('pyramid-register-turnstile-status');
        if (status) status.textContent = 'Menschprüfung erfolgreich.';
      },
      'expired-callback': () => { captchaToken = ''; },
      'error-callback': () => { captchaToken = ''; return true; },
    });
  } catch (error) {
    captchaRequired = true;
    message(error instanceof Error ? error.message : 'Sicherheitsprüfung nicht verfügbar.', 'error');
  }
}

export function initPyramidRegistration() {
  void setupCaptcha();
  byId<HTMLFormElement>('pyramid-registration-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = byId<HTMLInputElement>('pyramid-register-name')?.value.trim().replace(/\s+/g, ' ') || '';
    const email = byId<HTMLInputElement>('pyramid-register-email')?.value.trim().toLowerCase() || '';
    const password = byId<HTMLInputElement>('pyramid-register-password')?.value || '';
    const confirmation = byId<HTMLInputElement>('pyramid-register-confirm')?.value || '';
    if (username.length < 2 || username.length > 50) return message('Bitte einen Nutzernamen mit 2 bis 50 Zeichen eingeben.', 'error');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return message('Bitte eine gültige E-Mail-Adresse eingeben.', 'error');
    if (password.length < 10 || password.length > 128) return message('Das Passwort muss zwischen 10 und 128 Zeichen lang sein.', 'error');
    if (password !== confirmation) return message('Die beiden Passwörter stimmen nicht überein.', 'error');
    if (captchaRequired && !captchaToken) return message('Bitte zuerst die Menschprüfung abschließen.', 'error');

    const button = byId<HTMLButtonElement>('pyramid-register-submit');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    message('Konto wird sicher erstellt …');
    try {
      const emailRedirectTo = new URL('/forderungspyramide/?registration=confirmed', location.origin).toString();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: username },
          emailRedirectTo,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (error) throw error;
      if (data.session) await supabase.auth.signOut();
      byId<HTMLFormElement>('pyramid-registration-form')?.reset();
      message('Konto angelegt. Bitte öffne jetzt die Bestätigungs-E-Mail und bestätige deine E-Mail-Adresse. Danach kannst du dich anmelden.', 'success');
    } catch (error) {
      message('Konto konnte nicht erstellt werden: ' + (error instanceof Error ? error.message : String(error)), 'error');
    } finally {
      captchaToken = '';
      try { turnstile?.reset(widgetId); } catch { /* a fresh token is requested on retry */ }
      if (button) button.disabled = false;
    }
  });
}
