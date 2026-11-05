import { mediaUrl, supabase } from '../lib/supabase';
import { replaceMediaImage, removeMediaImage } from '../lib/media-upload';
import { escapeHtml, formatDateTime } from '../lib/ui';
import { downloadRsvpPdf, sortRsvpBySurname, type RsvpPdfRow } from './rsvp-report-pdf';
import { verifyEventCalendarPublication } from '../lib/calendar-feed-diagnostics';

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

const VERIFIED_RSVP_COLUMNS='member_name,member_email,attendance,party_size,adults_count,children_count,dessert_contribution,salad_contribution,help_setup,help_cleanup,youth_registrations,women_registrations,men_registrations,updated_at';

/** Shared live, RLS-protected query for both the existing admin form and the direct PDF page.
 *  Paging avoids dropping registrations when a celebration grows beyond 1,000 answers. */
export async function fetchVerifiedEventRsvps(eventId: string) {
  const rows: RsvpPdfRow[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('event_rsvps')
      .select(VERIFIED_RSVP_COLUMNS).eq('event_id', eventId)
      .not('verified_at','is',null)
      .order('id', { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...((data || []) as RsvpPdfRow[]));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
}

export function initEventRsvpAdmin(access: { isSuper: boolean; user: { id: string } }) {
  if (!access.isSuper) return;
  const select = $<HTMLSelectElement>('rsvp-admin-select');
  const form = $<HTMLFormElement>('rsvp-admin-event-form');
  const list = $<HTMLElement>('rsvp-admin-list');
  const summary = $<HTMLElement>('rsvp-admin-summary');
  if (!select || !form || !list || !summary) return;
  form.noValidate = true;

  if (!document.getElementById('rsvp-admin-image')) {
    const imageBlock = document.createElement('div');
    imageBlock.className = 'field full';
    imageBlock.innerHTML = `<label for="rsvp-admin-image">Veranstaltungsbild</label><input id="rsvp-admin-image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /><div id="rsvp-admin-image-preview" style="margin-top:10px"></div><button id="rsvp-admin-image-remove" class="button ghost" type="button" style="margin-top:8px" disabled>Bild entfernen</button><p class="muted">JPG, PNG, WebP oder AVIF bis 8 MB. Das Bild wird automatisch optimiert und unter „Aktuelles“ verwendet.</p>`;
    const saveField = document.getElementById('rsvp-admin-save')?.closest('.field');
    form.insertBefore(imageBlock, saveField || null);
  }

  let events: Row[] = [];
  let selectedId = '';
  let verifiedResponses: RsvpPdfRow[] = [];
  const pdfButton = $<HTMLButtonElement>('rsvp-admin-pdf');
  const imageInput = $<HTMLInputElement>('rsvp-admin-image');
  const imagePreview = $<HTMLElement>('rsvp-admin-image-preview');
  const imageRemove = $<HTMLButtonElement>('rsvp-admin-image-remove');

  const localDatetime = (date: string) => {
    if (!date) return '';
    const dt = new Date(date);
    const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(dt);
    return parts.replace(' ', 'T');
  };
  const renderImage = (path = '') => {
    if (!imagePreview) return;
    imagePreview.innerHTML = path
      ? `<img src="${escapeHtml(mediaUrl(path))}" alt="Gespeichertes Veranstaltungsbild" style="display:block;width:min(100%,520px);aspect-ratio:16/9;object-fit:contain;background:#fff;border-radius:14px" /><p class="muted">Dieses Bild wird unter „Aktuelles“ angezeigt. <a href="${escapeHtml(mediaUrl(path))}" target="_blank" rel="noopener noreferrer">Gespeichertes Originalbild öffnen</a></p>`
      : '<p class="muted">Noch kein eigenes Veranstaltungsbild. Bis zum Upload wird das Standardbild verwendet.</p>';
    imagePreview.querySelector<HTMLImageElement>('img')?.addEventListener('error', () => {
      message('Das gespeicherte Veranstaltungsbild konnte nicht geladen werden. Bitte die Bild-URL über „Originalbild öffnen“ prüfen.', true);
    });
    if (imageRemove) imageRemove.disabled = !path || !selectedId;
  };
  const reset = () => {
    selectedId = '';
    form.reset();
    field('rsvp-admin-title').value = ''; field('rsvp-admin-slug').value = ''; field('rsvp-admin-start').value = '';
    field('rsvp-admin-description').value = '';
    field('rsvp-admin-deadline').value = ''; field('rsvp-admin-fees').value = ''; field('rsvp-admin-setup').value = ''; field('rsvp-admin-cleanup').value = '';
    field('rsvp-admin-youth-note').value = '';
    for (const option of ['show-expectations','show-volunteer-info','show-contributions','show-help']) field('rsvp-admin-'+option).checked = true;
    ($<HTMLSelectElement>('rsvp-admin-status')!).value = 'draft'; field('rsvp-admin-enabled').checked = false;
    field('rsvp-admin-tournament-youth').checked = false; field('rsvp-admin-tournament-women').checked = false; field('rsvp-admin-tournament-men').checked = false;
    if (imageInput) imageInput.value = ''; renderImage(); verifiedResponses = [];
    if (pdfButton) pdfButton.disabled = true; if (select) select.value = '';
    if (list) list.innerHTML = '<p class="muted">Noch keine Rückmeldungen – zuerst einen Termin speichern.</p>';
    if (summary) summary.textContent = 'Beispielveranstaltung – noch keine verbindliche Anmeldung.';
  };

  const renderVotes = async () => {
    if (!selectedId || !list || !summary) return;
    const fetchingId=selectedId; if(pdfButton)pdfButton.disabled=true; verifiedResponses=[];
    const { data, error } = await fetchVerifiedEventRsvps(selectedId);
    if (fetchingId!==selectedId) return;
    if (error) { list.textContent = 'Rückmeldungen konnten nicht geladen werden: ' + error.message; return; }
    const rows = sortRsvpBySurname((data ?? []) as RsvpPdfRow[]); verifiedResponses = rows; if(pdfButton)pdfButton.disabled = false;
    const yes = rows.filter(r => r.attendance === 'yes'), no = rows.filter(r => r.attendance === 'no'), maybe = rows.filter(r => r.attendance === 'maybe');
    const people = yes.reduce((n, r) => n + Number(r.party_size), 0), adults = yes.reduce((n, r) => n + Number(r.adults_count || 0), 0), children = yes.reduce((n, r) => n + Number(r.children_count || 0), 0);
    const setup = rows.filter(r => r.help_setup).length, cleanup = rows.filter(r => r.help_cleanup).length;
    const youthCount = rows.reduce((n, r) => n + (Array.isArray(r.youth_registrations) ? r.youth_registrations.length : 0), 0), womenCount = rows.reduce((n, r) => n + (Array.isArray(r.women_registrations) ? r.women_registrations.length : 0), 0), menCount = rows.reduce((n, r) => n + (Array.isArray(r.men_registrations) ? r.men_registrations.length : 0), 0);
    summary.textContent = `${yes.length} Zusagen · ${people} Personen (${adults} Erwachsene, ${children} Kinder/Jugendliche) · ${maybe.length} Vielleicht · ${no.length} Absagen · ${setup} Aufbau · ${cleanup} Abbau · ${youthCount} Jugend-, ${womenCount} Damen-, ${menCount} Herrenanmeldungen`;
    const classes: Record<string,string> = {'u10-mixed':'U10 gemischt','u12-m':'U12 männlich','u15-m':'U15 männlich','u18-m':'U18 männlich','u18-w':'U18 weiblich'};
    list.innerHTML = rows.length ? `<table class="rsvp-admin-table"><thead><tr><th>Absender / bestätigte E-Mail</th><th>Teilnahme</th><th>Erw. / Kinder</th><th>Kuchen / Salat</th><th>Helfer</th><th>Jugendmeisterschaften</th><th>Damen / Herren</th><th>Stand</th></tr></thead><tbody>${rows.map(row => {
      const youth = Array.isArray(row.youth_registrations) ? row.youth_registrations : [];
      const contribution = [row.dessert_contribution ? `Nachspeise: ${escapeHtml(row.dessert_contribution)}` : '', row.salad_contribution ? `Vorspeise: ${escapeHtml(row.salad_contribution)}` : ''].filter(Boolean).join('<hr/>') || '–';
      const helper = [row.help_setup ? 'Aufbau' : '',row.help_cleanup ? 'Abbau' : ''].filter(Boolean).join(' / ') || '–';
      const young = youth.map((entry: Row) => `${escapeHtml(String(entry.name || ''))} (${escapeHtml(classes[String(entry.category)] || String(entry.category))})`).join('<hr/>') || '–';
      const women = Array.isArray(row.women_registrations) ? row.women_registrations.map((name:string)=>escapeHtml(String(name))).join('<hr/>') : '', men = Array.isArray(row.men_registrations) ? row.men_registrations.map((name:string)=>escapeHtml(String(name))).join('<hr/>') : '';
      return `<tr><td>${escapeHtml(row.member_name)}<br/><small>${escapeHtml(row.member_email || 'Altbestand ohne E-Mail')}</small></td><td>${row.attendance === 'yes' ? 'Dabei' : row.attendance === 'maybe' ? 'Vielleicht' : 'Nicht dabei'}</td><td>${row.attendance === 'yes' ? `${Number(row.adults_count || 0)} / ${Number(row.children_count || 0)}` : '–'}</td><td>${contribution}</td><td>${helper}</td><td>${young}</td><td>${women ? 'Damen: '+women : ''}${women&&men ? '<hr/>' : ''}${men ? 'Herren: '+men : ''}${!women&&!men ? '–' : ''}</td><td>${escapeHtml(formatDateTime(row.updated_at))}</td></tr>`;
    }).join('')}</tbody></table>` : '<p class="muted">Für diese Veranstaltung liegen noch keine Rückmeldungen vor.</p>';
  };

  const fill = () => {
    selectedId = select.value; if (!selectedId) { reset(); return; }
    const event = events.find(row => row.id === selectedId); if (!event) return;
    field('rsvp-admin-title').value = event.title || ''; field('rsvp-admin-slug').value = event.slug || ''; field('rsvp-admin-start').value = localDatetime(event.starts_at); field('rsvp-admin-deadline').value = localDatetime(event.rsvp_deadline || ''); field('rsvp-admin-location').value = event.location_name || ''; field('rsvp-admin-description').value = event.description || '';
    const details = event.rsvp_details || {};
    for (const [id,key] of [['show-expectations','show_expectations'],['show-volunteer-info','show_volunteer_info'],['show-contributions','show_contributions'],['show-help','show_help']])
      field('rsvp-admin-'+id).checked = details[key] !== false;
    field('rsvp-admin-fees').value = details.fee_note || ''; field('rsvp-admin-setup').value = details.setup_note || ''; field('rsvp-admin-cleanup').value = details.cleanup_note || ''; field('rsvp-admin-youth-note').value = details.youth_note || '';
    field('rsvp-admin-tournament-youth').checked = details.tournament_youth_enabled !== false; field('rsvp-admin-tournament-women').checked = details.tournament_women_enabled === true; field('rsvp-admin-tournament-men').checked = details.tournament_men_enabled === true;
    ($<HTMLSelectElement>('rsvp-admin-status')!).value = event.status || 'draft'; field('rsvp-admin-enabled').checked = !!event.rsvp_enabled;
    if (imageInput) imageInput.value = ''; renderImage(event.hero_image_path || ''); void renderVotes();
  };

  const refresh = async (preferredId = '') => {
    const { data, error } = await supabase.from('events').select('*').order('starts_at', { ascending: false }).limit(250);
    if (error) { message('Veranstaltungen konnten nicht geladen werden: ' + error.message, true); return; }
    events = data ?? []; const relevant = events.filter(e => !String(e.external_url || '').startsWith('news:'));
    // Linked events appear only in the RSVP/PDF selector, never as duplicate standalone public cards.
    const linkedRsvps = events.filter(e => String(e.external_url || '').startsWith('news:'));
    const option = (e: Row) => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.title)} · ${escapeHtml(formatDateTime(e.starts_at))} (${escapeHtml(e.status)})</option>`;
    select.innerHTML = '<option value="">Neue Veranstaltung</option>' + relevant.map(option).join('')
      + (linkedRsvps.length ? '<optgroup label="Mit Beiträgen verknüpfte Anmeldungen / PDF">' + linkedRsvps.map(option).join('') + '</optgroup>' : '');
    if (preferredId && [...relevant, ...linkedRsvps].some(e => e.id === preferredId)) select.value = preferredId; fill();
  };

  pdfButton?.addEventListener('click', () => { const event = events.find(row => row.id === selectedId); if(!event){message('Bitte zuerst eine Veranstaltung auswählen.',true);return} if(pdfButton.disabled) return; try { downloadRsvpPdf({title:String(event.title),slug:String(event.slug),starts_at:String(event.starts_at),rsvp_details:event.rsvp_details||{}},verifiedResponses); message('PDF mit den bestätigten Rückmeldungen wurde erstellt.'); } catch (error) { message('PDF konnte nicht erstellt werden: '+(error instanceof Error ? error.message : 'Unbekannter Fehler'),true); } });
  imageRemove?.addEventListener('click', async () => {
    const event = events.find(row => row.id === selectedId); if (!event?.hero_image_path || !selectedId) return;
    const oldPath=String(event.hero_image_path);imageRemove.disabled=true;try{await removeMediaImage({path:oldPath,directory:`events/${selectedId}`,clearReference:async()=>{const {error}=await supabase.from('events').update({hero_image_path:null}).eq('id',selectedId);return {error};}});message('Veranstaltungsbild entfernt. Das Standardbild wird wieder verwendet.');await refresh(selectedId);}catch(error){imageRemove.disabled=false;message('Bild konnte nicht entfernt werden: '+(error instanceof Error?error.message:'Unbekannter Fehler'),true);}
  });
  $<HTMLButtonElement>('rsvp-admin-new')?.addEventListener('click', reset); select.addEventListener('change', fill);
  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const title = field('rsvp-admin-title').value.trim(), slug = field('rsvp-admin-slug').value.trim().toLowerCase(), start = field('rsvp-admin-start').value, status = ($<HTMLSelectElement>('rsvp-admin-status')!).value, deadline = field('rsvp-admin-deadline').value;
    if (deadline && start && new Date(deadline).getTime() >= new Date(start).getTime()) { message('Der Anmeldeschluss muss vor dem Veranstaltungsbeginn liegen.', true); return; }
    if (!title || !/^[a-z0-9-]{2,70}$/.test(slug) || !start) { message('Bitte Titel, Kurzlink (nur Kleinbuchstaben/Ziffern/Bindestriche) und Termin angeben.', true); (!title ? field('rsvp-admin-title') : !start ? field('rsvp-admin-start') : field('rsvp-admin-slug')).focus(); return; }
    if (status === 'published' && new Date(start).getTime() <= Date.now()) { message('Zum Veröffentlichen bitte einen zukünftigen Termin auswählen.', true); return; }
    const date = new Date(start); if (Number.isNaN(date.getTime()) || (deadline && Number.isNaN(new Date(deadline).getTime()))) { message('Das Datum ist ungültig. Bitte Datum und Uhrzeit vollständig eingeben.', true); field('rsvp-admin-start').focus(); return; }
    const patch = { title, slug, starts_at: date.toISOString(), rsvp_deadline: deadline ? new Date(deadline).toISOString() : null, rsvp_details: { ...(events.find(e=>e.id===selectedId)?.rsvp_details||{}),
      show_expectations:field('rsvp-admin-show-expectations').checked,
      show_volunteer_info:field('rsvp-admin-show-volunteer-info').checked,
      show_contributions:field('rsvp-admin-show-contributions').checked,
      show_help:field('rsvp-admin-show-help').checked,
      fee_note: field('rsvp-admin-fees').value.trim(), setup_note: field('rsvp-admin-setup').value.trim(), cleanup_note: field('rsvp-admin-cleanup').value.trim(), youth_note: field('rsvp-admin-youth-note').value.trim(), tournament_youth_enabled:field('rsvp-admin-tournament-youth').checked, tournament_women_enabled:field('rsvp-admin-tournament-women').checked, tournament_men_enabled:field('rsvp-admin-tournament-men').checked }, location_name: field('rsvp-admin-location').value.trim() || null, description: field('rsvp-admin-description').value.trim() || null, status, rsvp_enabled: field('rsvp-admin-enabled').checked, category: 'club', team_id: null };
    const button = $<HTMLButtonElement>('rsvp-admin-save')!; button.disabled = true; button.textContent = 'Speichert …'; message('Speichere Veranstaltung …');
    try {
      const query = selectedId ? supabase.from('events').update(patch).eq('id', selectedId) : supabase.from('events').insert({ ...patch, created_by: access.user.id });
      const { data, error } = await query.select('id').single();
      if (error || !data) { message('Veranstaltung konnte nicht gespeichert werden: ' + (error?.message || 'Keine Berechtigung'), true); return; }
      selectedId = data.id; const file = imageInput?.files?.[0];
      if (file) {
        message('Veranstaltung gespeichert. Bild wird optimiert und hochgeladen …');
        const previous=events.find(row=>row.id===data.id)?.hero_image_path||null;
        try {
          const newPath = await replaceMediaImage({
            directory:`events/${data.id}`,file,oldPath:previous,
            persistPath:async(path)=>{
              const {data:stored,error}=await supabase.from('events').update({hero_image_path:path})
                .eq('id',data.id).select('hero_image_path').single();
              return {error:error || (stored?.hero_image_path === path ? null : {message:'Die neue Bildreferenz wurde nicht bestätigt.'})};
            }
          });
          // The stored URL is unique for every upload. Show it immediately rather than
          // leaving an earlier event image in the admin preview.
          renderImage(newPath);
        } catch(error) {
          message('Veranstaltung gespeichert, Bild fehlgeschlagen: '+(error instanceof Error?error.message:'Unbekannter Fehler'),true);
          await refresh(data.id);
          return;
        }
      }
      await refresh(data.id);
      window.dispatchEvent(new CustomEvent('tsv:editorial-content-changed'));
      try {
        const verified = await verifyEventCalendarPublication(data.id, status);
        message((file ? 'Veranstaltung und Bild gespeichert. ' : 'Veranstaltung gespeichert. ') + verified.message);
      } catch (error) {
        message('Veranstaltung gespeichert, aber Kalender-/Abo-Warnung: ' +
          (error instanceof Error ? error.message : 'Prüfung nicht möglich') +
          '. Bitte gespeicherten Freigabestatus und ICS-Feed prüfen.', true);
      }
    } catch (error) { message('Speichern fehlgeschlagen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'), true); }
    finally { button.disabled = false; button.textContent = 'Veranstaltung speichern'; }
  });
  window.addEventListener('tsv:editorial-content-changed', () => void refresh(selectedId));
  reset(); void refresh();
}