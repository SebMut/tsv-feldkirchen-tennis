import { mediaUrl, supabase } from '../lib/supabase';
import { replaceMediaImage } from '../lib/media-upload';
import { escapeHtml, formatDateTime } from '../lib/ui';
import { verifyEventCalendarPublication } from '../lib/calendar-feed-diagnostics';

type Row = Record<string, any>;
type Entry = { kind: 'news' | 'event'; news?: Row; event?: Row };
type Access = { canNews: boolean; canEvents: boolean; user: { id: string } };
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const input = (id: string) => el<HTMLInputElement>('editorial-compose-' + id)!;
const val = (id: string) => input(id).value.trim();
const on = (id: string) => input(id).checked;
const iso = (stamp: string) => stamp ? new Date(stamp).toISOString() : null;
const plain = (s: string) => s.replace(/\*\*/g, '').replace(/^\s*[🥨🎾🍂🍻📍]+\s*/u, '').replace(/\s+/g, ' ').trim();
const cleanTitle = (s: string) => plain(s).replace(/^[–—-]+\s*/, '').replace(/[!]+\s*$/, '').replace(/[🍂🎾🍻🥨]+\s*$/u, '').trim();
const localTime = (stamp: string | null | undefined) => stamp ? new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(stamp)).replace(' ', 'T') : '';

export function initEditorialComposer(access: Access) {
  const form = el<HTMLFormElement>('editorial-compose-form');
  const list = el<HTMLElement>('editorial-compose-list');
  const preview = el<HTMLElement>('editorial-compose-preview');
  const publish = el<HTMLButtonElement>('editorial-compose-publish');
  const draft = el<HTMLButtonElement>('editorial-compose-draft');
  const previewButton = el<HTMLButtonElement>('editorial-compose-preview-button');
  const calendarCheck = el<HTMLButtonElement>('editorial-compose-check-calendar');
  const calendarStatus = el<HTMLElement>('editorial-compose-calendar-status');
  if (!form || !list || !preview || !publish || !draft || !previewButton || !(access.canNews || access.canEvents)) return;
  const unsavedHint = document.createElement('p');
  unsavedHint.className = 'field full muted';
  unsavedHint.setAttribute('role', 'status');
  unsavedHint.textContent = 'Ungespeicherte Änderungen – bitte speichern oder bewusst verwerfen.';
  unsavedHint.hidden = true;
  form.prepend(unsavedHint);
  let unsavedChanges = false;
  const markUnsaved = () => { unsavedChanges = true; unsavedHint.hidden = false; };
  const clearUnsaved = () => { unsavedChanges = false; unsavedHint.hidden = true; };
  let editing: Entry | null = null;
  const isAlreadyPublished = () => (editing?.kind === 'event' ? editing.event?.status : editing?.news?.status) === 'published';
  const unpublish = document.createElement('button');
  unpublish.type = 'button';
  unpublish.className = 'button danger';
  unpublish.textContent = 'Als Entwurf zurückziehen';
  unpublish.hidden = true;
  draft.insertAdjacentElement('afterend', unpublish);
  const refreshActionLabels = () => {
    const published = isAlreadyPublished();
    draft.textContent = published ? 'Änderungen speichern (weiterhin öffentlich)' : 'Als Entwurf speichern';
    publish.hidden = published;
    unpublish.hidden = !published;
    if (calendarCheck) calendarCheck.hidden = !editing?.event?.id;
    if (calendarStatus && editing?.event?.id) calendarStatus.textContent = 'Freigabe: ' + (published ? 'Veröffentlicht' : editing.event.status === 'archived' ? 'Archiviert' : 'Entwurf') + ' – ICS-Status bei Bedarf prüfen.';
  };
  let entries: Entry[] = [];
  let revision = 0, previewRevision = -1, busy = false;
  let imageObjectUrl: string | null = null;
  const notice = (message: string, error = false) => {
    const box = el<HTMLElement>('editorial-compose-feedback')!;
    box.textContent = message;
    box.classList.remove('hidden');
    box.classList.toggle('is-error', error);
  };
  const revokeImage = () => { if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl); imageObjectUrl = null; };
  const hasEvent = () => !access.canNews || on('event') || editing?.kind === 'event';
  const choices = () => {
    if (!access.canNews || editing?.kind === 'event') input('event').checked = true;
    input('event').disabled = !access.canEvents || !access.canNews || editing?.kind === 'event';
    el<HTMLElement>('editorial-compose-event-fields')!.hidden = !hasEvent();
    el<HTMLElement>('editorial-compose-rsvp-fields')!.hidden = !(hasEvent() && on('rsvp'));
    el<HTMLElement>('editorial-compose-tournament-fields')!.hidden = !(hasEvent() && on('rsvp') && on('tournaments'));
    input('team').disabled = !!editing?.news?.match_id || !!editing?.news?.related_event_id;
    const teamField = input('team').closest<HTMLElement>('.field');
    if (teamField) teamField.hidden = !access.canNews || editing?.kind === 'event';
  };
  const invalidate = () => {
    revision++;
    previewRevision = -1;
    preview.hidden = true;
    publish.disabled = true;
    publish.title = 'Bitte zuerst die aktuelle Vorschau prüfen.';
    choices();
    refreshActionLabels();
  };
  const reset = () => {
    editing = null;
    form.reset();
    clearUnsaved();
    revokeImage();
    if (!access.canNews) input('event').checked = true;
    invalidate();
    if (calendarStatus) calendarStatus.textContent = '';
  };
  const edit = (entry: Entry) => {
    if (entry.news && entry.event && !access.canEvents) {
      notice('Für diesen verknüpften Beitrag benötigst du zusätzlich die Veranstaltungsberechtigung. Der bisherige News-Editor bleibt verfügbar.', true);
      return;
    }
    editing = entry;
    form.reset();
    clearUnsaved();
    revokeImage();
    const record = entry.news || entry.event!;
    input('title').value = String(record.title || '');
    input('body').value = String(entry.news?.body || entry.event?.description || '');
    input('excerpt').value = String(entry.news?.excerpt || entry.event?.excerpt || '');
    input('team').value = String(record.team_id || '');
    input('event').checked = !!entry.event && (entry.kind === 'event' || entry.event.status !== 'archived');
    input('start').value = localTime(entry.event?.starts_at);
    input('end').value = localTime(entry.event?.ends_at);
    input('location').value = String(entry.event?.location_name || '');
    input('rsvp').checked = !!entry.event?.rsvp_enabled;
    input('deadline').value = localTime(entry.event?.rsvp_deadline);
    const details = entry.event?.rsvp_details || {};
    for (const [field, property] of [['fees','fee_note'],['setup','setup_note'],['cleanup','cleanup_note'],['youth-note','youth_note']]) {
      input(field).value = String(details[property] || '');
    }
    input('youth').checked = !!entry.event?.rsvp_enabled && details.tournament_youth_enabled !== false;
    input('women').checked = details.tournament_women_enabled === true;
    input('men').checked = details.tournament_men_enabled === true;
    input('tournaments').checked = on('youth') || on('women') || on('men');
    invalidate();
    notice('„' + record.title + '“ zur Bearbeitung geladen. ' + (isAlreadyPublished()
      ? '„Änderungen speichern“ erhält die Veröffentlichung auch im Kalender.'
      : 'Vor dem Veröffentlichen bitte die Vorschau aktualisieren.'));
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    input('title').focus({ preventScroll: true });
  };
  const refresh = async () => {
    const [n, e] = await Promise.all([
      access.canNews ? supabase.from('news').select('*').order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [] as Row[], error: null }),
      access.canEvents ? supabase.from('events').select('*').order('starts_at', { ascending: false }).limit(250) : Promise.resolve({ data: [] as Row[], error: null }),
    ]);
    if (n.error || e.error) return notice('Beiträge konnten nicht geladen werden: ' + (n.error?.message || e.error?.message), true);
    const events: Row[] = e.data ?? [];
    const related = new Map(events.filter(e => /^news:[0-9a-f-]{36}$/i.test(String(e.external_url || '')))
      .map(e => [String(e.external_url).slice(5), e]));
    entries = [
      ...(n.data ?? []).map((news: Row) => ({kind: 'news' as const, news, event: related.get(news.id)})),
      ...events.filter(e => !String(e.external_url || '').startsWith('news:')).map(event => ({kind: 'event' as const, event})),
    ];
    list.innerHTML = entries.length ? '<div class="admin-edit-list">' + entries.map((item, index) => {
      const record = item.news || item.event!;
      const activeEvent = !!item.event && (item.kind === 'event' || item.event.status !== 'archived');
      return '<div class="admin-edit-item"><div><strong>' + escapeHtml(record.title || 'Ohne Titel') +
        '</strong><p class="muted">' + (activeEvent ? 'Veranstaltung' : 'Neuigkeit') + ' · ' +
        escapeHtml(record.status || 'draft') + (item.event?.starts_at ? ' · ' + escapeHtml(formatDateTime(item.event.starts_at)) : '') +
        '</p></div><button type="button" class="button ghost" data-compose-edit="' + index + '">Bearbeiten</button></div>';
    }).join('') + '</div>' : '<p class="muted">Noch keine Beiträge vorhanden.</p>';
    list.querySelectorAll<HTMLButtonElement>('[data-compose-edit]').forEach(button => button.addEventListener('click', () => {
      const entry = entries[Number(button.dataset.composeEdit)];
      if (entry) {
        if (unsavedChanges && !window.confirm('Ungespeicherte Änderungen verwerfen und anderen Beitrag öffnen?')) return;
        edit(entry);
      }
    }));
  };
  const validate = () => {
    if (!val('title') || !val('body')) throw Error('Überschrift und Beitragstext sind erforderlich.');
    if (hasEvent()) {
      if (!access.canEvents) throw Error('Für einen Termin wird die Veranstaltungsberechtigung benötigt.');
      if (!val('start') || !Number.isFinite(new Date(val('start')).getTime())) throw Error('Bitte einen gültigen Terminbeginn angeben.');
      if (val('end') && (!Number.isFinite(new Date(val('end')).getTime()) || new Date(val('end')) < new Date(val('start')))) throw Error('Das Ende darf nicht vor dem Beginn liegen.');
      if (on('rsvp') && val('deadline') && (!Number.isFinite(new Date(val('deadline')).getTime()) || new Date(val('deadline')) >= new Date(val('start')))) throw Error('Der Anmeldeschluss muss vor dem Beginn liegen.');
      if (on('rsvp') && on('tournaments') && !(on('youth') || on('women') || on('men'))) throw Error('Bitte mindestens eine Meisterschaft aktivieren.');
    }
    const file = input('image').files?.[0];
    if (file && (file.size > 8 * 1024 * 1024 || !['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))) {
      throw Error('Bilder dürfen höchstens 8 MB groß sein (JPEG, PNG, WebP, AVIF).');
    }
  };
  const card = (image: string) => {
    const title = escapeHtml(cleanTitle(val('title'))), body = escapeHtml(val('body'));
    const media = (source: string) => '<a href="#" class="content-card__media"><img src="' + escapeHtml(source) + '" alt="" /></a>';
    if (hasEvent()) {
      return '<article class="content-card content-card--event">' + media(image || '/images/veranstaltung-ai.svg') +
        '<div class="content-card__body"><div class="content-card__meta"><span class="content-card__badge">Veranstaltung</span><time>' +
        escapeHtml(formatDateTime(iso(val('start')) || new Date().toISOString())) + '</time></div><h3><a href="#">' + title +
        '</a></h3><p class="content-card__description">' + escapeHtml(plain(val('excerpt') || val('body'))) + '</p>' +
        '<div class="content-card__footer"><span>📍 ' + escapeHtml(val('location') || 'TSV Feldkirchen') +
        '</span><a href="#">Details lesen →</a></div><details class="content-card__details">' +
        '<summary>Vollständigen Text anzeigen →</summary><div class="content-card__full-text">' +
        body.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') + '</div>' +
        (on('rsvp') ? '<p class="content-card__signup"><a href="#" class="button">Zur Anmeldung &amp; Teilnahme →</a></p>' : '') +
        '</details></div></article>';
    }
    return '<article class="content-card content-card--news">' + (image ? media(image) : '') +
      '<div class="content-card__body"><div class="content-card__meta"><span class="content-card__badge">Neuigkeit</span><time>' +
      escapeHtml(formatDateTime(editing?.news?.published_at || new Date().toISOString())) + '</time></div><h2><a href="#">' +
      title + '</a></h2><p class="content-card__description">' +
      escapeHtml(plain(val('excerpt') || val('body').slice(0, 220))) + '</p>' +
      '<details class="content-card__details"><summary>Weiterlesen →</summary><p style="white-space:pre-wrap">' +
      body + '</p></details></div></article>';
  };
  const showPreview = () => {
    try {
      validate();
      revokeImage();
      const photo = input('image').files?.[0];
      if (photo) imageObjectUrl = URL.createObjectURL(photo);
      const previous = (hasEvent() ? editing?.event?.hero_image_path : editing?.news?.hero_image_path) || editing?.news?.hero_image_path;
      const html = card(imageObjectUrl || (previous ? mediaUrl(previous) : ''));
      for (const id of ['editorial-compose-desktop','editorial-compose-mobile']) {
        const target = el<HTMLElement>(id)!;
        target.innerHTML = html;
        target.querySelectorAll<HTMLAnchorElement>('a').forEach(link => link.addEventListener('click', event => event.preventDefault()));
      }
      preview.hidden = false;
      previewRevision = revision;
      publish.disabled = false;
      publish.title = '';
      notice('Vorschau aktualisiert. Bitte beide Geräteansichten prüfen.');
      preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) { notice(error instanceof Error ? error.message : 'Vorschau nicht möglich.', true); publish.disabled = true; }
  };
  const save = async (publication: 'draft' | 'published', preservingPublished = false) => {
    if (busy) return;
    try { validate(); } catch (error) { return notice(error instanceof Error ? error.message : 'Ungültiger Beitrag.', true); }
    if (publication === 'published' && !preservingPublished && previewRevision !== revision) return notice('Bitte zuerst die aktuelle Vorschau prüfen.', true);
    if (publication === 'published' && !preservingPublished && hasEvent() && new Date(val('start')).getTime() <= Date.now()) {
      return notice('Zum Veröffentlichen bitte einen zukünftigen Veranstaltungstermin wählen.', true);
    }
    busy = true;
    draft.disabled = publish.disabled = previewButton.disabled = unpublish.disabled = true;
    if (calendarCheck) calendarCheck.disabled = true;
    notice(preservingPublished ? 'Änderungen werden gespeichert; der Beitrag bleibt veröffentlicht …' : 'Beitrag wird ' + (publication === 'published' ? 'veröffentlicht' : 'als Entwurf gespeichert') + ' …');
    try {
      const eventActive = !!hasEvent();
      const oldNews = editing?.news, oldEvent = editing?.event;
      let newsId: string | null = oldNews?.id || null, eventId: string | null = oldEvent?.id || null;
      const teamId = editing?.kind === 'event' ? (oldEvent?.team_id || null) : (access.canNews ? val('team') || null : null);
      // New records start as drafts. Existing published records keep their visibility
      // if a later image upload or linked event update fails.
      if (access.canNews && editing?.kind !== 'event') {
        const patch = { title: val('title'), body: val('body'), excerpt: val('excerpt') || null,
          team_id: teamId, status: oldNews?.status || 'draft', published_at: oldNews?.published_at || null };
        const result = newsId
          ? await (oldNews?.updated_at
              ? supabase.from('news').update(patch).eq('id', newsId).eq('updated_at', oldNews.updated_at)
              : supabase.from('news').update(patch).eq('id', newsId)).select('id').maybeSingle()
          : await supabase.from('news').insert({ ...patch, slug: 'beitrag-' + crypto.randomUUID(), author_id: access.user.id }).select('id').single();
        if (result.error || !result.data) throw Error('News konnte nicht gespeichert werden: ' +
          (result.error?.message || (oldNews?.updated_at ? 'Der Beitrag wurde zwischenzeitlich geändert. Bitte Liste neu laden.' : 'Keine Berechtigung')));
        newsId = result.data.id;
        if (!editing) editing = { kind: 'news', news: { id: newsId } };
      }
      if (eventActive) {
        const details = { ...(oldEvent?.rsvp_details || {}),
          fee_note: val('fees'), setup_note: val('setup'), cleanup_note: val('cleanup'), youth_note: val('youth-note'),
          tournament_youth_enabled: on('rsvp') && on('tournaments') && on('youth'),
          tournament_women_enabled: on('rsvp') && on('tournaments') && on('women'),
          tournament_men_enabled: on('rsvp') && on('tournaments') && on('men') };
        const patch = { title: val('title'), excerpt: val('excerpt') || null, description: val('body'), category: 'club',
          starts_at: iso(val('start'))!, ends_at: iso(val('end')), location_name: val('location') || null,
          team_id: teamId, status: oldEvent?.status || 'draft', rsvp_enabled: on('rsvp'),
          rsvp_deadline: on('rsvp') ? iso(val('deadline')) : null, rsvp_details: details };
        const result = eventId
          ? await (oldEvent?.updated_at
              ? supabase.from('events').update(patch).eq('id', eventId).eq('updated_at', oldEvent.updated_at)
              : supabase.from('events').update(patch).eq('id', eventId)).select('id').maybeSingle()
          : await supabase.from('events').insert({ ...patch, slug: newsId ? 'news-' + newsId : 'veranstaltung-' + crypto.randomUUID(),
              external_url: newsId ? 'news:' + newsId : null, created_by: access.user.id }).select('id').single();
        if (result.error || !result.data) throw Error('Veranstaltung konnte nicht gespeichert werden: ' +
          (result.error?.message || (oldEvent?.updated_at ? 'Der Termin wurde zwischenzeitlich geändert. Bitte Liste neu laden.' : 'Keine Berechtigung')));
        eventId = result.data.id;
        if (!editing) editing = { kind: 'event', event: { id: eventId } };
        else editing.event = { ...(editing.event || {}), id: eventId };
      } else if (eventId && access.canEvents) {
        // When an event becomes a plain news item, keep its image visible in news.
        // The archived event retains its storage reference so no shared file is removed.
        if (newsId && oldEvent?.hero_image_path && !oldNews?.hero_image_path) {
          const inherited = await supabase.from('news').update({ hero_image_path: oldEvent.hero_image_path }).eq('id', newsId);
          if (inherited.error) throw Error('Veranstaltungsbild konnte nicht in die Neuigkeit übernommen werden: ' + inherited.error.message);
        }
        // Existing registrations remain intact when the calendar option is switched off.
        const { error } = await supabase.from('events').update({ status: 'archived', rsvp_enabled: false }).eq('id', eventId);
        if (error) throw Error('Alter Termin konnte nicht archiviert werden: ' + error.message);
        eventId = null;
      }
      const photo = input('image').files?.[0];
      if (photo) {
        const table = eventActive ? 'events' : 'news';
        const id = eventActive ? eventId : newsId;
        if (!id) throw Error('Für das Bild fehlt eine gespeicherte Beitrags-ID.');
        const oldPath = eventActive ? oldEvent?.hero_image_path : oldNews?.hero_image_path;
        await replaceMediaImage({ directory: table + '/' + id, file: photo, oldPath: oldPath || null,
          persistPath: async path => {
            const {data,error} = await supabase.from(table).update({hero_image_path:path}).eq('id', id).select('hero_image_path').single();
            return {error: error || (data?.hero_image_path === path ? null : {message:'Die Bildreferenz wurde nicht bestätigt.'})};
          },
        });
      }
      if (eventActive && eventId) {
        const {error} = await supabase.from('events').update({status:publication}).eq('id',eventId);
        if (error) throw Error('Termin gespeichert, Freigabe fehlgeschlagen: ' + error.message);
      }
      if (newsId && access.canNews && editing?.kind !== 'event') {
        const {error} = await supabase.from('news').update({ status:publication,
          published_at: publication === 'published' ? (oldNews?.published_at || new Date().toISOString()) : null }).eq('id',newsId);
        if (error) throw Error('News gespeichert, Freigabe fehlgeschlagen: ' + error.message);
      }
      // A successful database write alone does not prove that calendar subscribers see it.
      let feedMessage = '';
      let feedWarning = '';
      if (eventActive && eventId) {
        try {
          const verified = await verifyEventCalendarPublication(eventId, publication);
          feedMessage = verified.message;
        } catch (error) {
          feedWarning = 'Kalender-/Abo-Prüfung fehlgeschlagen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler');
        }
      }
      reset();
      notice(feedWarning ? 'Inhalte gespeichert, aber ' + feedWarning + ' Bitte die ICS-Veröffentlichung prüfen.' :
        (preservingPublished ? 'Änderungen gespeichert. Beitrag und Kalendertermin bleiben veröffentlicht.' : publication === 'published' ? 'Beitrag veröffentlicht. Er erscheint unter „Aktuelles“.' : 'Entwurf gespeichert und noch nicht öffentlich.') +
        (feedMessage ? ' ' + feedMessage : ''), !!feedWarning);
      await refresh();
      window.dispatchEvent(new CustomEvent('tsv:editorial-content-changed'));
    } catch (error) {
      notice((error instanceof Error ? error.message : 'Speichern fehlgeschlagen.') +
        ' Einzelne Änderungen können bereits gespeichert sein. Bitte die Liste prüfen, bevor du es erneut versuchst.', true);
      await refresh();
    } finally {
      busy = false;
      draft.disabled = previewButton.disabled = unpublish.disabled = false;
      if (calendarCheck) calendarCheck.disabled = false;
      publish.disabled = previewRevision !== revision;
    }
  };
  form.addEventListener('input', () => { invalidate(); markUnsaved(); });
  form.addEventListener('change', () => { invalidate(); markUnsaved(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const keepPublished = isAlreadyPublished();
    void save(keepPublished ? 'published' : 'draft', keepPublished);
  });
  unpublish.addEventListener('click', () => {
    if (!isAlreadyPublished() || !window.confirm('Beitrag und Veranstaltung wirklich als Entwurf zurückziehen? Sie verschwinden dann auch aus dem Kalender-Abo.')) return;
    void save('draft');
  });
  publish.addEventListener('click', () => void save('published'));
  previewButton.addEventListener('click', showPreview);
  calendarCheck?.addEventListener('click', async () => {
    const eventId = editing?.event?.id;
    if (!eventId || !calendarStatus || !calendarCheck) return;
    calendarCheck.disabled = true;
    calendarStatus.textContent = 'Gespeicherten Veröffentlichungsstatus und öffentlichen ICS-Feed prüfen …';
    try {
      const result = await verifyEventCalendarPublication(eventId);
      calendarStatus.textContent = 'Kalenderprüfung erfolgreich: ' + result.message;
    } catch (error) {
      calendarStatus.textContent = 'Kalenderwarnung: ' + (error instanceof Error ? error.message : 'Prüfung fehlgeschlagen');
    } finally {
      calendarCheck.disabled = false;
    }
  });
  el<HTMLButtonElement>('editorial-compose-reset')?.addEventListener('click', () => {
    if (unsavedChanges && !window.confirm('Ungespeicherte Änderungen wirklich verwerfen?')) return;
    reset();
  });
  window.addEventListener('beforeunload', (event) => {
    if (unsavedChanges) event.preventDefault();
  });
  window.addEventListener('beforeunload', revokeImage);
  const originalTeam = el<HTMLSelectElement>('news-team');
  if (access.canNews && originalTeam) input('team').innerHTML = originalTeam.innerHTML;
  reset();
  void refresh();
}
