import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/ui';

type RsvpChoice = 'yes' | 'no' | 'maybe';
type EventRow = {
  id: string; slug: string; title: string; description: string | null;
  starts_at: string; location_name: string | null; rsvp_deadline: string | null;
  rsvp_details: { fee_note?: string; setup_note?: string; cleanup_note?: string; youth_note?: string } | null;
};
type Summary = { yes: number; no: number; maybe: number; persons: number; adults: number; children: number };
type YouthRegistration = { name: string; category: string };

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const YOUTH_CATEGORIES = [
  { value: 'u10-mixed', label: 'U10 · Mädchen & Jungen gemischt' },
  { value: 'u12-m', label: 'U12 · männlich' },
  { value: 'u15-m', label: 'U15 · männlich' },
  { value: 'u18-m', label: 'U18 · männlich' },
  { value: 'u18-w', label: 'U18 · weiblich' },
] as const;

export async function initEventRsvp() {
  const form = byId<HTMLFormElement>('rsvp-form');
  const feedback = byId<HTMLElement>('rsvp-form-feedback');
  const nameInput = byId<HTMLInputElement>('rsvp-member-name');
  const emailInput = byId<HTMLInputElement>('rsvp-member-email');
  const adultsInput = byId<HTMLInputElement>('rsvp-adults-count');
  const childrenInput = byId<HTMLInputElement>('rsvp-children-count');
  const countWrap = byId<HTMLElement>('rsvp-count-wrap');
  const submit = byId<HTMLButtonElement>('rsvp-submit');
  const youthRows = byId<HTMLElement>('rsvp-youth-rows');
  if (!form || !feedback || !nameInput || !emailInput || !adultsInput || !childrenInput || !countWrap || !submit || !youthRows) return;

  const choice = () => (form.querySelector<HTMLInputElement>('input[name="attendance"]:checked')?.value || 'yes') as RsvpChoice;
  const updateChoice = () => {
    countWrap.hidden = choice() !== 'yes';
    adultsInput.required = choice() === 'yes';
    childrenInput.required = choice() === 'yes';
    form.querySelectorAll<HTMLElement>('.rsvp-choice').forEach(label => {
      label.classList.toggle('is-chosen', !!label.querySelector<HTMLInputElement>('input')?.checked);
    });
  };
  form.querySelectorAll<HTMLInputElement>('input[name="attendance"]').forEach(input => input.addEventListener('change', updateChoice));
  updateChoice();

  // Nur die Kategorien der PDF-Vorlage von 2024; reale Turnierklassen
  // können Veranstalter vor der nächsten Saison neu festlegen.
  const appendYouthRow = () => {
    if (youthRows.querySelectorAll('.rsvp-youth-row').length >= 12) return;
    const row = document.createElement('div');
    row.className = 'rsvp-youth-row';
    row.innerHTML = `
      <label>Name der jugendlichen Person
        <input type="text" data-youth-name maxlength="100" placeholder="Vor- und Nachname" autocomplete="off"/>
      </label>
      <label>Altersklasse
        <select data-youth-category>${YOUTH_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}</select>
      </label>
      <button class="button ghost" type="button" data-youth-remove aria-label="Anmeldung entfernen">Entfernen</button>`;
    youthRows.append(row);
    row.querySelector<HTMLInputElement>('[data-youth-name]')?.focus();
  };
  byId<HTMLButtonElement>('rsvp-add-youth')?.addEventListener('click', appendYouthRow);
  youthRows.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    event.target.closest('[data-youth-remove]')?.closest('.rsvp-youth-row')?.remove();
  });
  const youthValues = (): YouthRegistration[] | null => {
    const values: YouthRegistration[] = [];
    for (const row of youthRows.querySelectorAll<HTMLElement>('.rsvp-youth-row')) {
      const name = row.querySelector<HTMLInputElement>('[data-youth-name]')?.value.trim() || '';
      const category = row.querySelector<HTMLSelectElement>('[data-youth-category]')?.value || '';
      if (name.length < 2 || name.length > 100 || !YOUTH_CATEGORIES.some(c => c.value === category)) return null;
      values.push({ name, category });
    }
    return values;
  };

  const slug = new URLSearchParams(window.location.search).get('slug')?.trim() || 'sommerfest';
  let active: EventRow | null = null;
  const response = await supabase.from('events')
    .select('id,slug,title,description,starts_at,location_name,rsvp_deadline,rsvp_details')
    .eq('slug', slug).eq('status', 'published').eq('rsvp_enabled', true).maybeSingle();
  if (response.data) active = response.data as EventRow;
  const event = active;
  if (event) {
    byId<HTMLElement>('rsvp-heading')!.textContent = event.title;
    byId<HTMLElement>('rsvp-description')!.textContent = event.description || 'Liebe Tennisfreunde, wir laden euch herzlich zum gemeinsamen Sommerfest ein!';
    byId<HTMLElement>('rsvp-date')!.textContent = formatDateTime(event.starts_at);
    byId<HTMLElement>('rsvp-location')!.textContent = event.location_name || 'Ort wird bekannt gegeben';
    byId<HTMLElement>('rsvp-deadline')!.textContent = event.rsvp_deadline ? formatDateTime(event.rsvp_deadline) : 'Bis zum Veranstaltungstag';
    byId<HTMLElement>('rsvp-mode-label')!.textContent = 'Einladung & Rückmeldung';
    byId<HTMLElement>('rsvp-demo-note')!.textContent = 'Antworten werden zur Veranstaltungsplanung gespeichert. Namen und Jugendanmeldungen sind nicht öffentlich einsehbar.';
    byId<HTMLElement>('rsvp-source-note')?.classList.add('hidden');
    const details = event.rsvp_details || {};
    if (details.fee_note) byId<HTMLElement>('rsvp-fees-note')!.textContent = details.fee_note;
    if (details.setup_note || details.cleanup_note) {
      byId<HTMLElement>('rsvp-helper-note')!.textContent = [details.setup_note, details.cleanup_note].filter(Boolean).join(' ');
    }
    if (details.youth_note) byId<HTMLElement>('rsvp-youth-note')!.textContent = details.youth_note;
  } else {
    byId<HTMLElement>('rsvp-mode-label')!.textContent = 'Vorlage 2024 · Demo';
    byId<HTMLElement>('rsvp-demo-note')!.textContent = response.error
      ? 'Die Veranstaltungsdaten konnten nicht geladen werden. Der Demo-Modus speichert keine Antwort.'
      : 'Diese Einladung ist eine unverbindliche Vorlage nach dem Sommerfest 2024. Bitte noch keine verbindlichen Anmeldungen abgeben.';
    byId<HTMLElement>('rsvp-summary')?.classList.add('is-demo');
  }

  async function loadSummary() {
    if (!event) return;
    const { data, error } = await supabase.rpc('event_rsvp_summary', { p_event_id: event.id });
    if (error || !data) return;
    const stats = data as Summary;
    byId<HTMLElement>('rsvp-stat-yes')!.textContent = String(stats.yes ?? 0);
    byId<HTMLElement>('rsvp-stat-people')!.textContent = String(stats.persons ?? 0);
    byId<HTMLElement>('rsvp-stat-maybe')!.textContent = String(stats.maybe ?? 0);
  }
  await loadSummary();

  const deadline = event?.rsvp_deadline ? new Date(event.rsvp_deadline).getTime() : Infinity;
  if (event && (new Date(event.starts_at).getTime() <= Date.now() || deadline <= Date.now())) {
    submit.disabled = true;
    feedback.classList.remove('hidden');
    feedback.textContent = 'Die Rückmeldefrist für diese Veranstaltung ist bereits abgelaufen.';
    return;
  }

  // Die Bestätigung erfolgt ausschließlich über eine serverseitig abgesicherte
  // Edge Function. Ohne Turnstile/SMTP-Konfiguration gibt es KEINE echte Anmeldung.
  let turnstileToken = '';
  let turnstileId: string | number | undefined;
  let enabled = false;
  const cf = window as Window & { turnstile?: {
    render: (target: HTMLElement, config: Record<string, unknown>) => string | number;
    reset: (id?: string | number) => void;
  } };
  const showFeedback = (text: string, error = false) => {
    feedback.textContent = text;
    feedback.classList.remove('hidden');
    feedback.classList.toggle('is-error', error);
  };
  const resetChallenge = () => {
    turnstileToken = '';
    try { cf.turnstile?.reset(turnstileId); } catch { /* widget can be reloaded */ }
  };
  const loadTurnstile = async (siteKey: string) => {
    const wrap = byId<HTMLElement>('rsvp-turnstile-wrap');
    const widget = byId<HTMLElement>('rsvp-turnstile-widget');
    const status = byId<HTMLElement>('rsvp-turnstile-status');
    if (!wrap || !widget || !status) throw new Error('Menschprüfung fehlt.');
    wrap.hidden = false;
    // Cloudflare loads only when a real event is published and configured.
    if (!cf.turnstile) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Cloudflare Turnstile konnte nicht geladen werden.'));
        document.head.append(script);
      });
    }
    if (!cf.turnstile) throw new Error('Cloudflare Turnstile ist nicht verfügbar.');
    turnstileId = cf.turnstile.render(widget,{
      sitekey: siteKey,
      theme:'light',size:'flexible',
      callback:(token: string)=>{turnstileToken=token;status.textContent='Menschprüfung erfolgreich.';},
      'expired-callback':()=>{turnstileToken='';status.textContent='Bitte die Menschprüfung erneut ausführen.';},
      'error-callback':()=>{turnstileToken='';status.textContent='Menschprüfung fehlgeschlagen, bitte erneut versuchen.';},
    });
    status.textContent = 'Bitte die Cloudflare-Menschprüfung abschließen.';
  };

  if (event) {
    submit.disabled = true;
    try {
      const { data, error } = await supabase.functions.invoke('event-rsvp-email',{body:{action:'config'}});
      if (error || !data?.enabled || !data.siteKey) {
        showFeedback(data?.message || 'Die E-Mail-Bestätigung und Cloudflare Turnstile müssen vor der Anmeldung noch eingerichtet werden.',true);
      } else {
        await loadTurnstile(String(data.siteKey));
        enabled = true;
        submit.disabled = false;
      }
    } catch {
      showFeedback('Die Cloudflare-Menschprüfung konnte nicht geladen werden. Die Anmeldung ist derzeit geschlossen.',true);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const memberName = nameInput.value.trim();
    const memberEmail = emailInput.value.trim().toLowerCase();
    const selected = choice();
    const adults = selected === 'yes' ? Number(adultsInput.value) : 0;
    const children = selected === 'yes' ? Number(childrenInput.value) : 0;
    const partySize = adults + children;
    const youth = youthValues();
    feedback.classList.remove('hidden', 'is-error');
    if (memberName.length < 2 || memberName.length > 100
      || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(memberEmail) || memberEmail.length > 254
      || !Number.isInteger(adults) || !Number.isInteger(children)
      || adults < 0 || children < 0 || partySize > 20
      || (selected === 'yes' && partySize < 1)) {
      showFeedback('Bitte Namen, eine gültige E-Mail-Adresse und die Personenzahl prüfen (maximal 20).',true);
      return;
    }
    if (!youth) {
      showFeedback('Bitte für jede Jugendanmeldung einen vollständigen Namen und eine Altersklasse auswählen.',true);
      return;
    }
    const dessert = byId<HTMLInputElement>('rsvp-dessert')?.value.trim() || '';
    const salad = byId<HTMLInputElement>('rsvp-salad')?.value.trim() || '';
    if (dessert.length > 180 || salad.length > 180) {
      showFeedback('Bitte die Buffetbeiträge kürzer beschreiben.',true);
      return;
    }
    if (!event) {
      showFeedback(`Demo: ${selected === 'yes' ? `${adults} Erwachsene und ${children} Kinder/Jugendliche` : selected === 'maybe' ? 'Vielleicht' : 'Absage'}, ${youth.length} Jugendanmeldungen. Keine E-Mail versendet, nichts gespeichert.`);
      return;
    }
    if (!enabled) {
      showFeedback('Die E-Mail-Bestätigung ist noch nicht eingerichtet. Bitte beim Verein nachfragen.',true);
      return;
    }
    if (!turnstileToken) {
      showFeedback('Bitte zuerst „Ich bin ein Mensch“ abschließen.',true);
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Prüfe und versende E-Mail …';
    try {
      const { data, error } = await supabase.functions.invoke('event-rsvp-email', {body:{
        action:'submit',event_id:event.id, name:memberName,email:memberEmail,
        attendance:selected, adults,children,dessert,salad,
        help_setup:!!byId<HTMLInputElement>('rsvp-help-setup')?.checked,
        help_cleanup:!!byId<HTMLInputElement>('rsvp-help-cleanup')?.checked,
        youth,turnstileToken,
      }});
      if (error || !data?.pending) {
        showFeedback(data?.error || 'E-Mail konnte nicht versendet werden. Bitte noch einmal versuchen.',true);
        return;
      }
      showFeedback('Prüfe jetzt dein E-Mail-Postfach: Du erhältst alle Angaben und einen Bestätigungslink. Erst nach dem Klick darauf zählt deine Rückmeldung.');
      submit.textContent = 'Bestätigungs-E-Mail angefordert';
      return;
    } catch {
      showFeedback('Die Anmeldung ist momentan nicht erreichbar. Bitte später erneut versuchen.',true);
    } finally {
      resetChallenge();
      if (submit.textContent !== 'Bestätigungs-E-Mail angefordert') {
        submit.disabled = false;
        submit.innerHTML = 'Bestätigungs-E-Mail anfordern <span aria-hidden="true">›</span>';
      }
    }
  });
}
