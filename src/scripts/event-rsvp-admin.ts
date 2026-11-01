import { supabase } from '../lib/supabase';
import { escapeHtml, formatDateTime } from '../lib/ui';

type Row = Record<string, any>;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const field = (id: string) => $<HTMLInputElement>(id)!;
const message = (text: string, error = false) => {
  const el = $<HTMLElement>('rsvp-admin-feedback');
  if (!el) return;
  el.classList.remove('hidden');
  el.textContent = text;
  el.classList.toggle('is-error', error);
};

export function initEventRsvpAdmin(access: { isSuper: boolean; user: { id: string } }) {
  if (!access.isSuper) return;
  const select = $<HTMLSelectElement>('rsvp-admin-select');
  const form = $<HTMLFormElement>('rsvp-admin-event-form');
  const list = $<HTMLElement>('rsvp-admin-list');
  const summary = $<HTMLElement>('rsvp-admin-summary');
  if (!select || !form || !list || !summary) return;
  let events: Row[] = [];
  let selectedId = '';

  const localDatetime = (date: string) => {
    if (!date) return '';
    const dt = new Date(date);
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(dt);
    return parts.replace(' ', 'T');
  };
  const reset = () => {
    selectedId = '';
    form.reset();
    field('rsvp-admin-title').value = 'Sommerfest';
    field('rsvp-admin-slug').value = 'sommerfest';
    field('rsvp-admin-start').value = '';
    field('rsvp-admin-description').value = 'Wir freuen uns darauf, gemeinsam mit euch zu feiern!';
    ($<HTMLSelectElement>('rsvp-admin-status')!).value = 'draft';
    field('rsvp-admin-enabled').checked = true;
    if (select) select.value = '';
    if (list) list.innerHTML = '<p class="muted">Noch keine Rückmeldungen – zuerst einen Termin speichern.</p>';
    if (summary) summary.textContent = 'Beispielveranstaltung – noch keine verbindliche Anmeldung.';
  };

  const renderVotes = async () => {
    if (!selectedId || !list || !summary) return;
    const { data, error } = await supabase.from('event_rsvps')
      .select('member_name,attendance,party_size,updated_at')
      .eq('event_id', selectedId).order('updated_at', { ascending: false });
    if (error) {
      list.textContent = 'Rückmeldungen konnten nicht geladen werden: ' + error.message;
      return;
    }
    const rows = data ?? [];
    const yes = rows.filter(r => r.attendance === 'yes');
    const no = rows.filter(r => r.attendance === 'no');
    const maybe = rows.filter(r => r.attendance === 'maybe');
    const people = yes.reduce((n, r) => n + Number(r.party_size), 0);
    summary.textContent = `${yes.length} Zusagen · ${people} Personen · ${maybe.length} Vielleicht · ${no.length} Absagen`;
    list.innerHTML = rows.length
      ? `<table class="rsvp-admin-table"><thead><tr><th>Mitglied</th><th>Antwort</th><th>Personen</th><th>Aktualisiert</th></tr></thead><tbody>${rows.map(row =>
          `<tr><td>${escapeHtml(row.member_name)}</td><td>${row.attendance === 'yes' ? 'Dabei' : row.attendance === 'maybe' ? 'Vielleicht' : 'Nicht dabei'}</td><td>${Number(row.party_size) || '–'}</td><td>${escapeHtml(formatDateTime(row.updated_at))}</td></tr>`
        ).join('')}</tbody></table>`
      : '<p class="muted">Für diese Veranstaltung liegen noch keine Rückmeldungen vor.</p>';
  };

  const fill = () => {
    if (!select || !form) return;
    selectedId = select.value;
    if (!selectedId) { reset(); return; }
    const event = events.find(row => row.id === selectedId);
    if (!event) return;
    field('rsvp-admin-title').value = event.title || '';
    field('rsvp-admin-slug').value = event.slug || '';
    field('rsvp-admin-start').value = localDatetime(event.starts_at);
    field('rsvp-admin-location').value = event.location_name || '';
    field('rsvp-admin-description').value = event.description || '';
    ($<HTMLSelectElement>('rsvp-admin-status')!).value = event.status || 'draft';
    field('rsvp-admin-enabled').checked = !!event.rsvp_enabled;
    void renderVotes();
  };

  const refresh = async (preferredId = '') => {
    const { data, error } = await supabase.from('events').select('*').order('starts_at', { ascending: false }).limit(250);
    if (error) { message('Veranstaltungen konnten nicht geladen werden: ' + error.message, true); return; }
    events = data ?? [];
    if (!select) return;
    // Only event records explicitly configured for RSVPs or currently selected
    // appear in the main selector. A newly disabled record remains editable
    // during the current session until another item is chosen.
    const relevant = events.filter(e => e.rsvp_enabled || e.id === preferredId || e.slug === 'sommerfest');
    select.innerHTML = '<option value="">Neue Veranstaltung</option>' + relevant.map(e =>
      `<option value="${escapeHtml(e.id)}">${escapeHtml(e.title)} · ${escapeHtml(formatDateTime(e.starts_at))} (${escapeHtml(e.status)})</option>`).join('');
    if (preferredId && relevant.some(e => e.id === preferredId)) select.value = preferredId;
    fill();
  };

  $<HTMLButtonElement>('rsvp-admin-new')?.addEventListener('click', reset);
  select.addEventListener('change', fill);
  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const title = field('rsvp-admin-title').value.trim();
    const slug = field('rsvp-admin-slug').value.trim().toLowerCase();
    const start = field('rsvp-admin-start').value;
    const status = ($<HTMLSelectElement>('rsvp-admin-status')!).value;
    if (!title || !/^[a-z0-9-]{2,70}$/.test(slug) || !start) {
      message('Bitte Titel, Kurzlink (nur Kleinbuchstaben/Ziffern/Bindestriche) und Termin angeben.', true);
      return;
    }
    if (status === 'published' && new Date(start).getTime() <= Date.now()) {
      message('Zum Veröffentlichen bitte einen zukünftigen Termin auswählen.', true);
      return;
    }
    const patch = {
      title, slug,
      starts_at: new Date(start).toISOString(),
      location_name: field('rsvp-admin-location').value.trim() || null,
      description: field('rsvp-admin-description').value.trim() || null,
      status, rsvp_enabled: field('rsvp-admin-enabled').checked,
      category: 'club', team_id: null,
    };
    const button = $<HTMLButtonElement>('rsvp-admin-save')!;
    button.disabled = true;
    try {
      const query = selectedId
        ? supabase.from('events').update(patch).eq('id', selectedId)
        : supabase.from('events').insert({ ...patch, created_by: access.user.id });
      const { data, error } = await query.select('id').single();
      if (error || !data) { message('Veranstaltung konnte nicht gespeichert werden: ' + (error?.message || 'Keine Berechtigung'), true); return; }
      selectedId = data.id;
      message(status === 'published' ? 'Veranstaltung veröffentlicht und Anmeldung freigegeben.' : 'Veranstaltung als Entwurf gespeichert.');
      await refresh(data.id);
    } finally { button.disabled = false; }
  });
  reset();
  void refresh();
}
