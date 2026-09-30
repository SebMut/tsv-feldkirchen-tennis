import { supabase } from '../lib/supabase';
import { escapeHtml, formatDateTime, setStatus } from '../lib/ui';

type Row = Record<string, any>;
type BaseState = {
  user: any;
  profile: Row | null;
  isSuper: boolean;
  teams: Row[];
  seasons: Row[];
  teamSeasons: Row[];
  memberships: Row[];
  matches: Row[];
};

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

function reportStatus(message: string, tone: 'info' | 'error' | 'success' = 'info') {
  const target = $('#admin-status');
  if (!target) return;
  target.classList.remove('hidden');
  setStatus(target, message, tone);
}

function teamName(base: BaseState, teamId?: string | null) {
  return base.teams.find((team) => team.id === teamId)?.name ?? '';
}

function matchTeam(base: BaseState, match: Row) {
  const teamSeason = base.teamSeasons.find((row) => row.id === match.team_season_id);
  return base.teams.find((row) => row.id === teamSeason?.team_id);
}

function canEditTeam(base: BaseState, teamId?: string | null) {
  if (base.isSuper) return true;
  if (!teamId) return false;
  return base.memberships.some((membership) =>
    membership.user_id === base.user?.id &&
    membership.team_id === teamId &&
    membership.active &&
    ['manager', 'editor'].includes(membership.role)
  );
}

async function loadSeasons(base: BaseState) {
  if (!base.isSuper) return;
  const { data, error } = await supabase.from('seasons').select('*').order('year', { ascending: false });
  if (error) return reportStatus(error.message, 'error');
  base.seasons = data ?? [];
  const target = $('#seasons-list');
  if (!target) return;

  target.innerHTML = base.seasons.map((season) => `
    <article class="card flat" data-season="${season.id}">
      <div class="page-head">
        <div>
          <strong>${escapeHtml(season.name)}</strong>
          <div class="match-meta">${escapeHtml(String(season.year))}${season.archived_at ? ' · archiviert' : ''}</div>
        </div>
        <span class="status-pill ${season.is_current ? 'live' : ''}">${season.is_current ? 'Aktuell' : 'Saison'}</span>
      </div>
      <div class="actions">
        ${season.is_current ? '' : '<button class="button secondary" data-set-current>Als aktuell setzen</button>'}
        <button class="button ghost" data-toggle-archive>${season.archived_at ? 'Reaktivieren' : 'Archivieren'}</button>
      </div>
    </article>
  `).join('');

  target.querySelectorAll<HTMLElement>('[data-season]').forEach((card) => {
    const id = card.dataset.season!;
    card.querySelector<HTMLButtonElement>('[data-set-current]')?.addEventListener('click', async () => {
      const { error: resetError } = await supabase.from('seasons').update({ is_current: false }).neq('id', id);
      if (resetError) return reportStatus(resetError.message, 'error');
      const { error: currentError } = await supabase.from('seasons').update({ is_current: true, archived_at: null }).eq('id', id);
      if (currentError) return reportStatus(currentError.message, 'error');
      reportStatus('Aktuelle Saison geändert.', 'success');
      await loadSeasons(base);
    });
    card.querySelector<HTMLButtonElement>('[data-toggle-archive]')?.addEventListener('click', async () => {
      const season = base.seasons.find((row) => row.id === id);
      const archived = season?.archived_at ? null : new Date().toISOString();
      const patch: Row = { archived_at: archived };
      if (archived) patch.is_current = false;
      const { error: archiveError } = await supabase.from('seasons').update(patch).eq('id', id);
      if (archiveError) return reportStatus(archiveError.message, 'error');
      reportStatus(archived ? 'Saison archiviert.' : 'Saison reaktiviert.', 'success');
      await loadSeasons(base);
    });
  });
}

async function createSeason(event: Event, base: BaseState) {
  event.preventDefault();
  const year = Number($<HTMLInputElement>('#season-year')?.value);
  const name = $<HTMLInputElement>('#season-name')?.value.trim() || `Saison ${year}`;
  const startsOn = $<HTMLInputElement>('#season-start')?.value || null;
  const endsOn = $<HTMLInputElement>('#season-end')?.value || null;
  const makeCurrent = $<HTMLInputElement>('#season-current')?.checked ?? false;
  const clone = $<HTMLInputElement>('#season-clone')?.checked ?? true;
  if (!year) return;

  const sourceSeason = base.seasons.find((season) => season.is_current) ?? base.seasons[0];
  const { data: season, error } = await supabase.from('seasons').insert({
    name, year, starts_on: startsOn, ends_on: endsOn, is_current: false,
  }).select().single();
  if (error || !season) return reportStatus(error?.message || 'Saison konnte nicht angelegt werden.', 'error');

  if (clone && sourceSeason) {
    const { data: sourceRows, error: sourceError } = await supabase.from('team_seasons').select('*').eq('season_id', sourceSeason.id);
    if (sourceError) return reportStatus(sourceError.message, 'error');
    if (sourceRows?.length) {
      const rows = sourceRows.map((row) => ({
        team_id: row.team_id,
        season_id: season.id,
        league: row.league,
        group_name: row.group_name,
        btv_url: row.btv_url,
        summary: row.summary,
        team_image_path: row.team_image_path,
        is_published: false,
      }));
      const { error: cloneError } = await supabase.from('team_seasons').insert(rows);
      if (cloneError) return reportStatus(cloneError.message, 'error');
    }
  }

  if (makeCurrent) {
    const { error: resetError } = await supabase.from('seasons').update({ is_current: false }).neq('id', season.id);
    if (resetError) return reportStatus(resetError.message, 'error');
    const { error: currentError } = await supabase.from('seasons').update({ is_current: true }).eq('id', season.id);
    if (currentError) return reportStatus(currentError.message, 'error');
  }

  reportStatus('Saison angelegt. Die Mannschaftsdaten können jetzt saisonbezogen angepasst werden.', 'success');
  ($<HTMLFormElement>('#season-form'))?.reset();
  await loadSeasons(base);
}

async function loadSettings(base: BaseState) {
  if (!base.isSuper) return;
  const { data, error } = await supabase.from('site_settings').select('*');
  if (error) return reportStatus(error.message, 'error');
  const values = new Map((data ?? []).map((row) => [row.key, row.value]));

  const set = (selector: string, value: unknown) => {
    const el = $<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (el) el.value = value == null ? '' : String(value);
  };
  set('#setting-club-name', values.get('club_name'));
  set('#setting-email', values.get('email'));
  set('#setting-phone', values.get('phone'));
  set('#setting-member-count', values.get('member_count'));
  set('#setting-team-count', values.get('team_count'));
  set('#setting-court-count', values.get('court_count'));
  set('#setting-courtbooking-url', values.get('courtbooking_url'));
  set('#setting-tennis-school-url', values.get('tennis_school_url'));
  set('#setting-address', JSON.stringify(values.get('address') ?? {}, null, 2));
  set('#setting-social-links', JSON.stringify(values.get('social_links') ?? {}, null, 2));
}

async function saveSettings(event: Event, base: BaseState) {
  event.preventDefault();
  if (!base.isSuper) return;
  let address: unknown = {};
  let socials: unknown = {};
  try {
    address = JSON.parse($<HTMLTextAreaElement>('#setting-address')?.value || '{}');
    socials = JSON.parse($<HTMLTextAreaElement>('#setting-social-links')?.value || '{}');
  } catch {
    return reportStatus('Adresse und Social-Links müssen gültiges JSON sein.', 'error');
  }

  const rows = [
    ['club_name', $<HTMLInputElement>('#setting-club-name')?.value.trim() || 'TSV Feldkirchen Tennis'],
    ['email', $<HTMLInputElement>('#setting-email')?.value.trim() || ''],
    ['phone', $<HTMLInputElement>('#setting-phone')?.value.trim() || ''],
    ['member_count', Number($<HTMLInputElement>('#setting-member-count')?.value || 0)],
    ['team_count', Number($<HTMLInputElement>('#setting-team-count')?.value || 0)],
    ['court_count', Number($<HTMLInputElement>('#setting-court-count')?.value || 0)],
    ['courtbooking_url', $<HTMLInputElement>('#setting-courtbooking-url')?.value.trim() || ''],
    ['tennis_school_url', $<HTMLInputElement>('#setting-tennis-school-url')?.value.trim() || ''],
    ['address', address],
    ['social_links', socials],
  ].map(([key, value]) => ({ key, value, is_public: true, updated_by: base.user.id }));

  const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) return reportStatus(error.message, 'error');
  reportStatus('Website-Einstellungen gespeichert.', 'success');
}

async function loadPlacements(base: BaseState) {
  if (!base.isSuper) return;
  const [{ data: sponsors }, { data: placements }, { data: matches }] = await Promise.all([
    supabase.from('sponsors').select('*').eq('active', true).order('sort_order'),
    supabase.from('sponsor_placements').select('*').order('created_at', { ascending: false }),
    supabase.from('matches').select('*').order('starts_at', { ascending: false }).limit(100),
  ]);

  const sponsorSelect = $<HTMLSelectElement>('#placement-sponsor');
  if (sponsorSelect) sponsorSelect.innerHTML = (sponsors ?? []).map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

  const teamSelect = $<HTMLSelectElement>('#placement-team');
  if (teamSelect) teamSelect.innerHTML = '<option value="">Keine bestimmte Mannschaft</option>' + base.teams.map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`).join('');

  const matchSelect = $<HTMLSelectElement>('#placement-match');
  if (matchSelect) matchSelect.innerHTML = '<option value="">Kein bestimmtes Spiel</option>' + (matches ?? []).map((match) => {
    const team = matchTeam(base, match);
    return `<option value="${match.id}">${escapeHtml(team?.name || '')} – ${escapeHtml(match.opponent)} – ${escapeHtml(formatDateTime(match.starts_at))}</option>`;
  }).join('');

  const sponsorMap = new Map((sponsors ?? []).map((s) => [s.id, s]));
  const matchMap = new Map((matches ?? []).map((m) => [m.id, m]));
  const target = $('#placements-list');
  if (!target) return;

  target.innerHTML = `<table class="data-table"><thead><tr><th>Sponsor</th><th>Platz</th><th>Zuordnung</th><th>Laufzeit</th><th></th></tr></thead><tbody>${(placements ?? []).map((p) => {
    const match = matchMap.get(p.match_id) as Row | undefined;
    const assignment = p.team_id ? teamName(base, p.team_id) : match ? `${matchTeam(base, match)?.name || ''} – ${match.opponent}` : 'allgemein';
    return `<tr><td>${escapeHtml((sponsorMap.get(p.sponsor_id) as Row | undefined)?.name || '')}</td><td>${escapeHtml(p.placement)}</td><td>${escapeHtml(assignment)}</td><td>${escapeHtml([p.starts_on, p.ends_on].filter(Boolean).join(' – ') || 'ohne Begrenzung')}</td><td><button class="button ghost" data-delete-placement="${p.id}">Löschen</button></td></tr>`;
  }).join('')}</tbody></table>`;

  target.querySelectorAll<HTMLButtonElement>('[data-delete-placement]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Sponsor-Platzierung löschen?')) return;
    const { error } = await supabase.from('sponsor_placements').delete().eq('id', button.dataset.deletePlacement);
    if (error) reportStatus(error.message, 'error'); else { reportStatus('Platzierung gelöscht.', 'success'); loadPlacements(base); }
  }));
}

async function savePlacement(event: Event, base: BaseState) {
  event.preventDefault();
  const { error } = await supabase.from('sponsor_placements').insert({
    sponsor_id: $<HTMLSelectElement>('#placement-sponsor')?.value,
    placement: $<HTMLSelectElement>('#placement-type')?.value,
    team_id: $<HTMLSelectElement>('#placement-team')?.value || null,
    match_id: $<HTMLSelectElement>('#placement-match')?.value || null,
    starts_on: $<HTMLInputElement>('#placement-start')?.value || null,
    ends_on: $<HTMLInputElement>('#placement-end')?.value || null,
    active: true,
  });
  if (error) return reportStatus(error.message, 'error');
  ($<HTMLFormElement>('#placement-form'))?.reset();
  reportStatus('Sponsor-Platzierung gespeichert.', 'success');
  loadPlacements(base);
}

function ensureMatchDialog() {
  let dialog = document.querySelector<HTMLDialogElement>('#match-edit-dialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'match-edit-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="card" id="match-edit-form" style="min-width:min(560px,86vw)">
      <h2>Spiel bearbeiten</h2>
      <input type="hidden" id="edit-match-id" />
      <div class="form-grid">
        <div class="field full"><label>Gegner</label><input id="edit-match-opponent" required /></div>
        <div class="field"><label>Beginn</label><input id="edit-match-start" type="datetime-local" required /></div>
        <div class="field"><label>Ende</label><input id="edit-match-end" type="datetime-local" /></div>
        <div class="field"><label><input id="edit-match-home" type="checkbox" /> Heimspiel</label></div>
        <div class="field"><label>Externer Link</label><input id="edit-match-url" type="url" /></div>
      </div>
      <div class="actions" style="margin-top:16px"><button class="button" value="save">Speichern</button><button class="button ghost" value="cancel">Abbrechen</button></div>
    </form>`;
  document.body.append(dialog);
  dialog.addEventListener('close', async () => {
    if (dialog?.returnValue !== 'save') return;
    const id = $<HTMLInputElement>('#edit-match-id')?.value;
    const start = $<HTMLInputElement>('#edit-match-start')?.value;
    const end = $<HTMLInputElement>('#edit-match-end')?.value;
    const { error } = await supabase.from('matches').update({
      opponent: $<HTMLInputElement>('#edit-match-opponent')?.value.trim(),
      starts_at: start ? new Date(start).toISOString() : null,
      ends_at: end ? new Date(end).toISOString() : null,
      is_home: $<HTMLInputElement>('#edit-match-home')?.checked ?? true,
      external_url: $<HTMLInputElement>('#edit-match-url')?.value.trim() || null,
    }).eq('id', id);
    if (error) reportStatus(error.message, 'error');
    else {
      reportStatus('Spiel geändert. Ansicht wird aktualisiert.', 'success');
      window.setTimeout(() => location.reload(), 500);
    }
  });
  return dialog;
}

function localDateTimeValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function loadTickerHistory(matchId: string, target: HTMLElement) {
  const { data, error } = await supabase.from('live_ticker_entries')
    .select('*').eq('match_id', matchId).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(15);
  if (error) {
    target.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    return;
  }
  target.innerHTML = (data ?? []).length ? `
    <h3>Letzte Tickermeldungen</h3>
    <div class="timeline">${(data ?? []).map((entry) => `
      <div class="timeline-row" data-ticker-entry="${entry.id}">
        <div><strong>${escapeHtml(entry.message)}</strong><div class="match-meta">${escapeHtml(formatDateTime(entry.created_at))}</div></div>
        <div class="actions"><button class="button ghost" data-edit-ticker>Bearbeiten</button><button class="button ghost" data-delete-ticker>Löschen</button></div>
      </div>`).join('')}</div>` : '<p class="muted">Noch keine Tickermeldungen.</p>';

  target.querySelectorAll<HTMLElement>('[data-ticker-entry]').forEach((row) => {
    const id = row.dataset.tickerEntry!;
    row.querySelector<HTMLButtonElement>('[data-edit-ticker]')?.addEventListener('click', async () => {
      const current = row.querySelector('strong')?.textContent || '';
      const message = prompt('Tickermeldung bearbeiten:', current)?.trim();
      if (!message || message === current) return;
      const { error: updateError } = await supabase.from('live_ticker_entries').update({ message }).eq('id', id);
      if (updateError) reportStatus(updateError.message, 'error'); else { reportStatus('Tickermeldung geändert.', 'success'); loadTickerHistory(matchId, target); }
    });
    row.querySelector<HTMLButtonElement>('[data-delete-ticker]')?.addEventListener('click', async () => {
      if (!confirm('Tickermeldung wirklich löschen?')) return;
      const { error: deleteError } = await supabase.from('live_ticker_entries').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (deleteError) reportStatus(deleteError.message, 'error'); else { reportStatus('Tickermeldung gelöscht.', 'success'); loadTickerHistory(matchId, target); }
    });
  });
}

function decorateMatchCards(base: BaseState) {
  const target = $('#matches-admin-list');
  if (!target) return;
  const decorate = () => {
    target.querySelectorAll<HTMLElement>('[data-match-card]').forEach((card) => {
      if (card.dataset.advanced === '1') return;
      card.dataset.advanced = '1';
      const matchId = card.dataset.matchCard!;
      const match = base.matches.find((row) => row.id === matchId);
      const actions = card.querySelector<HTMLElement>('.actions');
      const team = match ? matchTeam(base, match) : null;
      if (actions && canEditTeam(base, team?.id)) {
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'button ghost';
        edit.textContent = 'Spiel bearbeiten';
        edit.addEventListener('click', () => {
          if (!match) return;
          const dialog = ensureMatchDialog();
          ($<HTMLInputElement>('#edit-match-id')!).value = match.id;
          ($<HTMLInputElement>('#edit-match-opponent')!).value = match.opponent ?? '';
          ($<HTMLInputElement>('#edit-match-start')!).value = localDateTimeValue(match.starts_at);
          ($<HTMLInputElement>('#edit-match-end')!).value = localDateTimeValue(match.ends_at);
          ($<HTMLInputElement>('#edit-match-home')!).checked = !!match.is_home;
          ($<HTMLInputElement>('#edit-match-url')!).value = match.external_url ?? '';
          dialog.showModal();
        });
        actions.append(edit);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button danger';
        remove.textContent = 'Spiel löschen';
        remove.addEventListener('click', async () => {
          if (!confirm('Spiel inklusive Liveticker wirklich löschen?')) return;
          const { error } = await supabase.from('matches').delete().eq('id', matchId);
          if (error) reportStatus(error.message, 'error');
          else {
            reportStatus('Spiel gelöscht.', 'success');
            card.remove();
            base.matches = base.matches.filter((row) => row.id !== matchId);
          }
        });
        actions.append(remove);
      }

      const history = document.createElement('div');
      history.className = 'card flat';
      history.dataset.tickerHistory = matchId;
      history.style.marginTop = '12px';
      history.innerHTML = '<p class="muted">Tickerhistorie wird geladen …</p>';
      card.append(history);
      loadTickerHistory(matchId, history);
    });
  };
  decorate();
  const observer = new MutationObserver(decorate);
  observer.observe(target, { childList: true });
}

async function prefillReport(base: BaseState) {
  const matchId = $<HTMLSelectElement>('#news-match')?.value;
  if (!matchId) return;
  const match = base.matches.find((row) => row.id === matchId) ?? (await supabase.from('matches').select('*').eq('id', matchId).maybeSingle()).data;
  if (!match) return;
  const team = matchTeam(base, match);
  const [{ data: live }, { data: entries }] = await Promise.all([
    supabase.from('match_live_state').select('*').eq('match_id', matchId).maybeSingle(),
    supabase.from('live_ticker_entries').select('*').eq('match_id', matchId).is('deleted_at', null).order('created_at'),
  ]);
  const clubScore = match.is_home ? live?.home_score ?? 0 : live?.away_score ?? 0;
  const opponentScore = match.is_home ? live?.away_score ?? 0 : live?.home_score ?? 0;
  const title = $<HTMLInputElement>('#news-title');
  const excerpt = $<HTMLTextAreaElement>('#news-excerpt');
  const body = $<HTMLTextAreaElement>('#news-body');
  const teamSelect = $<HTMLSelectElement>('#news-team');
  if (teamSelect && team) teamSelect.value = team.id;
  if (title && !title.value) title.value = `${team?.name || 'TSV Feldkirchen'}: ${clubScore}:${opponentScore} gegen ${match.opponent}`;
  if (excerpt && !excerpt.value) excerpt.value = `Endstand ${clubScore}:${opponentScore} gegen ${match.opponent}.`;
  if (body && !body.value) {
    const ticker = (entries ?? []).map((entry) => `• ${formatDateTime(entry.created_at)} – ${entry.message}`).join('\n');
    body.value = `Spielbericht\n\n${team?.name || 'TSV Feldkirchen'} – ${match.opponent}\nEndstand: ${clubScore}:${opponentScore}\n\nSpielverlauf\n${ticker || 'Noch keine Tickermeldungen vorhanden.'}\n\nEigener Bericht:\n`;
  }
}

export async function loadAdvancedUsers(base: BaseState) {
  if (!base.isSuper) return;
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'list' } });
  if (error || data?.error) return reportStatus(data?.error || error?.message || 'Benutzer konnten nicht geladen werden.', 'error');
  const target = $('#users-list');
  if (!target) return;

  target.innerHTML = `<div class="stack">${(data.users ?? []).map((user: Row) => {
    const membershipMap = new Map((user.team_memberships ?? []).filter((m: Row) => m.active).map((m: Row) => [m.team_id, m]));
    const accountStatus = user.last_sign_in_at ? 'Aktiv' : user.invited_at ? 'Einladung offen' : 'Angelegt';
    const accountTone = user.last_sign_in_at ? '' : ' pending';
    const isSelf = user.id === base.user?.id;
    return `<article class="card flat user-admin-card" data-user-card="${user.id}">
      <div class="page-head">
        <div>
          <div class="actions"><strong>${escapeHtml(user.display_name)}</strong><span class="status-pill${accountTone}">${escapeHtml(accountStatus)}</span></div>
          <div class="match-meta">${escapeHtml(user.email)}</div>
          ${user.last_sign_in_at ? `<div class="match-meta">Letzte Anmeldung: ${escapeHtml(formatDateTime(user.last_sign_in_at))}</div>` : ''}
        </div>
        <label>Globale Rolle
          <select data-user-global ${isSelf ? 'title="Den eigenen SuperAdmin-Zugang nicht versehentlich herabstufen"' : ''}>
            <option value="user" ${user.global_role === 'user' ? 'selected' : ''}>Mannschafts-Nutzer</option>
            <option value="super_admin" ${user.global_role === 'super_admin' ? 'selected' : ''}>SuperAdmin</option>
          </select>
        </label>
      </div>
      <div class="user-team-permissions ${user.global_role === 'super_admin' ? 'is-super' : ''}">
        ${user.global_role === 'super_admin' ? '<p class="muted">SuperAdmins benötigen keine einzelnen Mannschaftszuordnungen.</p>' : `
        <div class="grid">${base.teams.map((team) => {
          const membership = membershipMap.get(team.id) as Row | undefined;
          return `<div class="card flat user-team-card">
            <label><input type="checkbox" data-user-team="${team.id}" ${membership ? 'checked' : ''}/> ${escapeHtml(team.name)}</label>
            <select data-user-team-role="${team.id}">
              <option value="manager" ${membership?.role === 'manager' ? 'selected' : ''}>Manager</option>
              <option value="editor" ${!membership || membership.role === 'editor' ? 'selected' : ''}>Editor</option>
              <option value="ticker" ${membership?.role === 'ticker' ? 'selected' : ''}>Nur Liveticker</option>
            </select>
          </div>`;
        }).join('')}</div>`}</div>
      <div class="actions" style="margin-top:12px">
        <button class="button" data-save-user>Rechte speichern</button>
        ${user.last_sign_in_at ? '' : '<button class="button secondary" data-send-access>Zugangs-Mail erneut senden</button>'}
        ${isSelf ? '' : '<button class="button danger" data-delete-user>Zugang löschen</button>'}
      </div>
    </article>`;
  }).join('')}</div>`;

  target.querySelectorAll<HTMLElement>('[data-user-card]').forEach((card) => {
    card.querySelector<HTMLButtonElement>('[data-save-user]')?.addEventListener('click', async () => {
      const userId = card.dataset.userCard!;
      const globalRole = card.querySelector<HTMLSelectElement>('[data-user-global]')?.value || 'user';
      const memberships = globalRole === 'super_admin' ? [] : Array.from(card.querySelectorAll<HTMLInputElement>('[data-user-team]:checked')).map((box) => ({
        team_id: box.dataset.userTeam!,
        role: card.querySelector<HTMLSelectElement>(`[data-user-team-role="${box.dataset.userTeam}"]`)?.value || 'editor',
      }));

      const roleResult = await supabase.functions.invoke('admin-users', { body: { action: 'set_role', user_id: userId, global_role: globalRole } });
      if (roleResult.error || roleResult.data?.error) return reportStatus(roleResult.data?.error || roleResult.error?.message || 'Rolle konnte nicht gespeichert werden.', 'error');

      const membershipResult = await supabase.functions.invoke('admin-users', { body: { action: 'memberships', user_id: userId, memberships } });
      if (membershipResult.error || membershipResult.data?.error) return reportStatus(membershipResult.data?.error || membershipResult.error?.message || 'Mannschaftsrechte konnten nicht gespeichert werden.', 'error');

      reportStatus('Benutzerrechte gespeichert.', 'success');
      loadAdvancedUsers(base);
    });

    card.querySelector<HTMLButtonElement>('[data-send-access]')?.addEventListener('click', async () => {
      const userId = card.dataset.userCard!;
      const redirectTo = `${location.origin}${import.meta.env.BASE_URL}admin/`;
      const result = await supabase.functions.invoke('admin-users', {
        body: { action: 'send_access_mail', user_id: userId, redirect_to: redirectTo },
      });
      if (result.error) return reportStatus('Die Benutzerverwaltung ist momentan nicht erreichbar. Bitte erneut versuchen.', 'error');
      if (result.data?.ok === false || result.data?.error) return reportStatus(result.data?.error || 'Zugangs-Mail konnte nicht gesendet werden.', 'error');
      reportStatus('Zugangs-Mail wurde erneut gesendet.', 'success');
    });

    card.querySelector<HTMLButtonElement>('[data-delete-user]')?.addEventListener('click', async () => {
      const userId = card.dataset.userCard!;
      const name = card.querySelector('strong')?.textContent || 'diesen Benutzer';
      if (!confirm(`Zugang für ${name} wirklich vollständig löschen? Mannschaftsrechte und Login werden entfernt.`)) return;
      const result = await supabase.functions.invoke('admin-users', { body: { action: 'delete', user_id: userId } });
      if (result.error || result.data?.error) return reportStatus(result.data?.error || result.error?.message || 'Zugang konnte nicht gelöscht werden.', 'error');
      reportStatus('Benutzerzugang gelöscht.', 'success');
      loadAdvancedUsers(base);
    });
  });
}

export async function initAdvancedAdmin(base: BaseState) {
  decorateMatchCards(base);
  $<HTMLSelectElement>('#news-match')?.addEventListener('change', () => prefillReport(base));

  if (!base.isSuper) return;

  $<HTMLFormElement>('#season-form')?.addEventListener('submit', (event) => createSeason(event, base));
  $<HTMLFormElement>('#settings-form')?.addEventListener('submit', (event) => saveSettings(event, base));
  $<HTMLFormElement>('#placement-form')?.addEventListener('submit', (event) => savePlacement(event, base));
  $<HTMLFormElement>('#sponsor-form')?.addEventListener('submit', () => window.setTimeout(() => loadPlacements(base), 800));

  await Promise.all([
    loadSeasons(base),
    loadSettings(base),
    loadPlacements(base),
    loadAdvancedUsers(base),
  ]);
}
