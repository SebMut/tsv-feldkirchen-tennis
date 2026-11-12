import { escapeHtml } from './ui';

export function newsActionUrl(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw || /[\\\s]/u.test(raw)) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const url = new URL(raw);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function validateNewsAction(label: string, url: string) {
  if (!label && !url) return;
  if (!label || !url) throw Error('Bitte Buttontext und Link gemeinsam angeben oder beide Felder leeren.');
  if (label.length > 80) throw Error('Der Buttontext darf höchstens 80 Zeichen lang sein.');
  if (url.length > 2048 || !newsActionUrl(url)) throw Error('Bitte einen gültigen HTTP(S)-Link oder internen Pfad wie /hallenplaetze/ angeben.');
}

export function renderNewsAction(item: { button_label?: unknown; button_url?: unknown }) {
  const label = String(item.button_label ?? '').trim();
  const href = newsActionUrl(item.button_url);
  return label && href ? '<p class="news-action"><a class="button" href="' + escapeHtml(href) + '">' + escapeHtml(label) + '</a></p>' : '';
}
