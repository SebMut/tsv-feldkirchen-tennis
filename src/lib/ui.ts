export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeZone: 'Europe/Berlin',
    ...options,
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(new Date(value));
}

export function slugify(value: string) {
  return value
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function setStatus(target: HTMLElement | null, message: string, tone: 'info' | 'error' | 'success' = 'info') {
  if (!target) return;
  target.textContent = message;
  target.dataset.tone = tone;
}
