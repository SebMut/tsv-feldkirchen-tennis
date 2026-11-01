import { supabase } from '../lib/supabase';
import { escapeHtml, formatDateTime } from '../lib/ui';
import { downloadRsvpPdf, type RsvpPdfRow } from './rsvp-report-pdf';

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
  // Browser-interne Validierung kann den Submit-Handler blockieren, ohne einen
  // sichtbaren Hinweis zu geben. Sämtliche Pflichtfelder werden hier geprüft.
  form.noValidate = true;
  let events: Row[] = [];
  let selectedId = '';
  let verifiedResponses: RsvpPdfRow[] = [];
  const pdfButton = $<HTMLButtonElement>('rsvp-admin-pdf');

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
    field('rsvp-admin-description').value = 'Liebe Tennisfreunde, zum Abschluss der Punktspielsaison möchten wir mit euch feiern und laden alle Mitglieder, Eltern, Partner und Freunde herzlich zum Sommerfest ein. Für Speis und Trank ist gesorgt!';
    field('rsvp-admin-deadline').value = '';
    field('rsvp-admin-fees').value = '';
    field('rsvp-admin-setup').value = '';
    field('rsvp-admin-cleanup').value = '';
    field('rsvp-admin-youth-note').value = 'Wir planen Jugendvereinsmeisterschaften in den Klassen U10 gemischt, U12 männlich, U15 männlich, U18 männlich und U18 weiblich. Termine und Modus werden nach den Anmeldungen bekannt gegeben.';
    ($<HTMLSelectElement>('rsvp-admin-status')!).value = 'draft';
    field('rsvp-admin-enabled').checked = true;
    field('rsvp-admin-tournament-youth').checked = true;
    field('rsvp-admin-tournament-women').checked = false;
    field('rsvp-admin-tournament-men').checked = false;
    verifiedResponses = [];
    if (pdfButton) pdfButton.disabled = true;
    if (select) select.value = '';
    if (list) list.innerHTML = '<p class="muted">Noch keine Rückmeldungen – zuerst einen Termin speichern.</p>';
    if (summary) summary.textContent = 'Beispielveranstaltung – noch keine verbindliche Anmeldung.';
  };

  const renderVotes = async () => {
    if (!selectedId || !list || !summary) return;
    const fetchingId=selectedId;
    if(pdfButton)pdfButton.disabled=true;
    verifiedResponses=[];
    const { data, error } = await supabase.from('event_rsvps')
      .select('member_name,member_email,attendance,party_size,adults_count,children_count,dessert_contribution,salad_contribution,help_setup,help_cleanup,youth_registrations,women_registrations,men_registrations,updated_at')
      .eq('event_id', selectedId).not('verified_at','is',null).order('updated_at', { ascending: false });
    if (fetchingId!==selectedId) return;
    if (error) {
      list.textContent = 'Rückmeldungen konnten nicht geladen werden: ' + error.message;
      return;
    }
    const rows = data ?? [];
    verifiedResponses = rows as RsvpPdfRow[];
    if(pdfButton)pdfButton.disabled = false;
    const yes = rows.filter(r => r.attendance === 'yes');
    const no = rows.filter(r => r.attendance === 'no');
    const maybe = rows.filter(r => r.attendance === 'maybe');
    const people = yes.reduce((n, r) => n + Number(r.party_size), 0);
    const adults = yes.reduce((n, r) => n + Number(r.adults_count || 0), 0);
    const children = yes.reduce((n, r) => n + Number(r.children_count || 0), 0);
    const setup = rows.filter(r => r.help_setup).length;
    const cleanup = rows.filter(r => r.help_cleanup).length;
    const youthCount = rows.reduce((n, r) => n + (Array.isArray(r.youth_registrations) ? r.youth_registrations.length : 0), 0);
    const womenCount = rows.reduce((n, r) => n + (Array.isArray(r.women_registrations) ? r.women_registrations.length : 0), 0);
    const menCount = rows.reduce((n, r) => n + (Array.isArray(r.men_registrations) ? r.men_registrations.length : 0), 0);
    summary.textContent = `${yes.length} Zusagen · ${people} Personen (${adults} Erwachsene, ${children} Kinder/Jugendliche) · ${maybe.length} Vielleicht · ${no.length} Absagen · ${setup} Aufbau · ${cleanup} Abbau · ${youthCount} Jugend-, ${womenCount} Damen-, ${menCount} Herrenanmeldungen`;
    const classes: Record<string,string> = {
      'u10-mixed':'U10 gemischt','u12-m':'U12 männlich','u15-m':'U15 männlich','u18-m':'U18 männlich','u18-w':'U18 weiblich',
    };
    list.innerHTML = rows.length
      ? `<table class="rsvp-admin-table"><thead><tr><th>Absender / bestätigte E-Mail</th><th>Teilnahme</th><th>Erw. / Kinder</th><th>Kuchen / Salat</th><th>Helfer</th><th>Jugendmeisterschaften</th><th>Damen / Herren</th><th>Stand</th></tr></thead><tbody>${rows.map(row => {
          const youth = Array.isArray(row.youth_registrations) ? row.youth_registrations : [];
          const contribution = [row.dessert_contribution ? `Nachspeise: ${escapeHtml(row.dessert_contribution)}` : '',
            row.salad_contribution ? `Vorspeise: ${escapeHtml(row.salad_contribution)}` : ''].filter(Boolean).join('<hr/>') || '–';
          const helper = [row.help_setup ? 'Aufbau' : '',row.help_cleanup ? 'Abbau' : ''].filter(Boolean).join(' / ') || '–';
          const young = youth.map((entry: Row) => `${escapeHtml(String(entry.name || ''))} (${escapeHtml(classes[String(entry.category)] || String(entry.category))})`).join('<hr/>') || '–';
          const women = Array.isArray(row.women_registrations) ? row.women_registrations.map((name:string)=>escapeHtml(String(name))).join('<hr/>') : '';
          const men = Array.isArray(row.men_registrations) ? row.men_registrations.map((name:string)=>escapeHtml(String(name))).join('<hr/>') : '';
          return `<tr><td>${escapeHtml(row.member_name)}<br/><small>${escapeHtml(row.member_email || 'Altbestand ohne E-Mail')}</small></td><td>${row.attendance === 'yes' ? 'Dabei' : row.attendance === 'maybe' ? 'Vielleicht' : 'Nicht dabei'}</td>
          <td>${row.attendance === 'yes' ? `${Number(row.adults_count || 0)} / ${Number(row.children_count || 0)}` : '–'}</td>
          <td>${contribution}</td><td>${helper}</td><td>${young}</td><td>${women ? 'Damen: '+women : ''}${women&&men ? '<hr/>' : ''}${men ? 'Herren: '+men : ''}${!women&&!men ? '–' : ''}</td><td>${escapeHtml(formatDateTime(row.updated_at))}</td></tr>`;
        }).join('')}</tbody></table>`
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
    field('rsvp-admin-deadline').value = localDatetime(event.rsvp_deadline || '');
    field('rsvp-admin-location').value = event.location_name || '';
    field('rsvp-admin-description').value = event.description || '';
    const details = event.rsvp_details || {};
    field('rsvp-admin-fees').value = details.fee_note || '';
    field('rsvp-admin-setup').value = details.setup_note || '';
    field('rsvp-admin-cleanup').value = details.cleanup_note || '';
    field('rsvp-admin-youth-note').value = details.youth_note || '';
    field('rsvp-admin-tournament-youth').checked = details.tournament_youth_enabled !== false;
    field('rsvp-admin-tournament-women').checked = details.tournament_women_enabled === true;
    field('rsvp-admin-tournament-men').checked = details.tournament_men_enabled === true;
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

  pdfButton?.addEventListener('click', () => {
    const event = events.find(row => row.id === selectedId);
    if(!event){message('Bitte zuerst eine Veranstaltung auswählen.',true);return}
    if(pdfButton.disabled) return;
    try {
      downloadRsvpPdf(event, verifiedResponses);
      message('PDF mit den bestätigten Rückmeldungen wurde erstellt.');
    } catch (error) {
      message('PDF konnte nicht erstellt werden: '+(error instanceof Error ? error.message : 'Unbekannter Fehler'),true);
    }
  });
  $<HTMLButtonElement>('rsvp-admin-new')?.addEventListener('click', reset);
  select.addEventListener('change', fill);
  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const title = field('rsvp-admin-title').value.trim();
    const slug = field('rsvp-admin-slug').value.trim().toLowerCase();
    const start = field('rsvp-admin-start').value;
    const status = ($<HTMLSelectElement>('rsvp-admin-status')!).value;
    const deadline = field('rsvp-admin-deadline').value;
    if (deadline && start && new Date(deadline).getTime() >= new Date(start).getTime()) {
      message('Der Anmeldeschluss muss vor dem Veranstaltungsbeginn liegen.', true);
      return;
    }
    if (!title || !/^[a-z0-9-]{2,70}$/.test(slug) || !start) {
      message('Bitte Titel, Kurzlink (nur Kleinbuchstaben/Ziffern/Bindestriche) und Termin angeben.', true);
      (!title ? field('rsvp-admin-title') : !start ? field('rsvp-admin-start') : field('rsvp-admin-slug')).focus();
      return;
    }
    if (status === 'published' && new Date(start).getTime() <= Date.now()) {
      message('Zum Veröffentlichen bitte einen zukünftigen Termin auswählen.', true);
      return;
    }
    const date = new Date(start);
    if (Number.isNaN(date.getTime()) || (deadline && Number.isNaN(new Date(deadline).getTime()))) {
      message('Das Datum ist ungültig. Bitte Datum und Uhrzeit vollständig eingeben.', true);
      field('rsvp-admin-start').focus();
      return;
    }
    const patch = {
      title, slug,
      starts_at: date.toISOString(),
      rsvp_deadline: deadline ? new Date(deadline).toISOString() : null,
      rsvp_details: {
        fee_note: field('rsvp-admin-fees').value.trim(),
        setup_note: field('rsvp-admin-setup').value.trim(),
        cleanup_note: field('rsvp-admin-cleanup').value.trim(),
        youth_note: field('rsvp-admin-youth-note').value.trim(),
        tournament_youth_enabled:field('rsvp-admin-tournament-youth').checked,
        tournament_women_enabled:field('rsvp-admin-tournament-women').checked,
        tournament_men_enabled:field('rsvp-admin-tournament-men').checked,
      },
      location_name: field('rsvp-admin-location').value.trim() || null,
      description: field('rsvp-admin-description').value.trim() || null,
      status, rsvp_enabled: field('rsvp-admin-enabled').checked,
      category: 'club', team_id: null,
    };
    const button = $<HTMLButtonElement>('rsvp-admin-save')!;
    button.disabled = true;
    button.textContent = 'Speichert …';
    message('Speichere Veranstaltung …');
    try {
      const query = selectedId
        ? supabase.from('events').update(patch).eq('id', selectedId)
        : supabase.from('events').insert({ ...patch, created_by: access.user.id });
      const { data, error } = await query.select('id').single();
      if (error || !data) { message('Veranstaltung konnte nicht gespeichert werden: ' + (error?.message || 'Keine Berechtigung'), true); return; }
      selectedId = data.id;
      message(status === 'published' ? 'Veranstaltung veröffentlicht und Anmeldung freigegeben.' : 'Veranstaltung als Entwurf gespeichert.');
      await refresh(data.id);
    } catch (error) {
      message('Speichern fehlgeschlagen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'), true);
    } finally {
      button.disabled = false;
      button.textContent = 'Veranstaltung speichern';
    }
  });
  reset();
  void refresh();
}
