import { mediaUrl, supabase } from '../lib/supabase';
import { optimizeImage } from '../lib/images';
import { initAdvancedAdmin, loadAdvancedUsers } from './admin-advanced';
import { escapeHtml, formatDateTime, setStatus, slugify } from '../lib/ui';

type Row = Record<string, any>;
const state: {
  user: any;
  profile: Row | null;
  isSuper: boolean;
  teams: Row[];
  seasons: Row[];
  teamSeasons: Row[];
  memberships: Row[];
  matches: Row[];
} = { user: null, profile: null, isSuper: false, teams: [], seasons: [], teamSeasons: [], memberships: [], matches: [] };

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const status = (message: string, tone: 'info' | 'error' | 'success' = 'info') => {
  const el = $('#admin-status');
  if (!el) return;
  el.classList.remove('hidden');
  setStatus(el, message, tone);
};

function ownMemberships() {
  if (state.isSuper) return [];
  return state.memberships.filter((m) => m.active && m.user_id === state.user?.id);
}

function canEditTeamId(teamId: string) {
  if (state.isSuper) return true;
  return ownMemberships().some((m) => m.team_id === teamId && ['manager', 'editor'].includes(m.role));
}

function canTickTeamId(teamId: string) {
  if (state.isSuper) return true;
  return ownMemberships().some((m) => m.team_id === teamId && ['manager', 'editor', 'ticker'].includes(m.role));
}

function allowedTeamIds(mode: 'tick' | 'edit' = 'tick') {
  if (state.isSuper) return state.teams.map((t) => t.id);
  return ownMemberships()
    .filter((m) => mode === 'edit' ? ['manager', 'editor'].includes(m.role) : ['manager', 'editor', 'ticker'].includes(m.role))
    .map((m) => m.team_id);
}

function allowedTeams(mode: 'tick' | 'edit' = 'tick') {
  const ids = new Set(allowedTeamIds(mode));
  return state.teams.filter((t) => ids.has(t.id));
}

function allowedTeamSeasons(mode: 'tick' | 'edit' = 'tick') {
  const ids = new Set(allowedTeamIds(mode));
  return state.teamSeasons.filter((ts) => ids.has(ts.team_id));
}

function currentTeamSeason(teamId: string) {
  const current = state.seasons.find((s) => s.is_current) ?? state.seasons[0];
  return state.teamSeasons.find((ts) => ts.team_id === teamId && ts.season_id === current?.id)
    ?? state.teamSeasons.find((ts) => ts.team_id === teamId);
}

function defaultTeamImagePath(team: Row) {
  if (team.gender === 'men') return 'teams/herren.png';
  if (team.gender === 'women') return 'teams/damen.png';
  if (team.gender === 'youth') return 'teams/jugend.png';
  return null;
}

function teamSeasonLabel(ts: Row) {
  const team = state.teams.find((t) => t.id === ts.team_id);
  const season = state.seasons.find((s) => s.id === ts.season_id);
  return `${team?.name ?? 'Team'} · ${season?.name ?? ''}`;
}

function renderTeamOptions(selector: string, includeBlank = false, mode: 'tick' | 'edit' = 'edit') {
  const el = $<HTMLSelectElement>(selector);
  if (!el) return;
  el.innerHTML = (includeBlank ? '<option value="">Keine / Verein allgemein</option>' : '') +
    allowedTeams(mode).map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
}

function renderTeamSeasonOptions(selector: string, mode: 'tick' | 'edit' = 'edit') {
  const el = $<HTMLSelectElement>(selector);
  if (!el) return;
  el.innerHTML = allowedTeamSeasons(mode).map((ts) => `<option value="${ts.id}">${escapeHtml(teamSeasonLabel(ts))}</option>`).join('');
}

function renderGalleryMatchOptions() {
  const teamId = $<HTMLSelectElement>('#gallery-team')?.value;
  const el = $<HTMLSelectElement>('#gallery-match');
  if (!el) return;
  const rows = state.matches
    .filter((match) => {
      const ts = state.teamSeasons.find((row) => row.id === match.team_season_id);
      return !!teamId && ts?.team_id === teamId;
    })
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  el.innerHTML = '<option value="">Keine Spielzuordnung</option>' + rows.map((match) =>
    `<option value="${match.id}">${escapeHtml(formatDateTime(match.starts_at))} · ${escapeHtml(match.opponent)} · ${match.is_home ? 'Heim' : 'Auswärts'}</option>`
  ).join('');
}

async function loadCore() {
  const [{ data: teams }, { data: seasons }, { data: teamSeasons }, { data: memberships }] = await Promise.all([
    supabase.from('teams').select('*').order('sort_order'),
    supabase.from('seasons').select('*').order('year', { ascending: false }),
    supabase.from('team_seasons').select('*'),
    supabase.from('team_memberships').select('*').eq('active', true),
  ]);
  state.teams = teams ?? [];
  state.seasons = seasons ?? [];
  state.teamSeasons = teamSeasons ?? [];
  state.memberships = memberships ?? [];
}

async function ensureProfile(user: any) {
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (data) return data;
  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Benutzer';
  const { data: created, error } = await supabase.from('profiles').insert({
    id: user.id,
    display_name: displayName,
    email: user.email,
    global_role: 'user',
  }).select().single();
  if (error) throw error;
  return created;
}

function showPanel(name: string) {
  document.querySelectorAll<HTMLElement>('.admin-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `panel-${name}`));
  document.querySelectorAll<HTMLButtonElement>('.admin-nav button').forEach((button) => button.classList.toggle('active', button.dataset.panel === name));
}

function bindNav() {
  document.querySelectorAll<HTMLButtonElement>('.admin-nav button').forEach((button) => {
    button.addEventListener('click', () => button.dataset.panel && showPanel(button.dataset.panel));
  });
}

async function refreshDashboard() {
  const target = $('#dashboard-teams');
  if (!target) return;
  target.innerHTML = allowedTeams('tick').map((team) => {
    const ts = currentTeamSeason(team.id);
    const membership = ownMemberships().find((m) => m.team_id === team.id);
    const editable = canEditTeamId(team.id);
    const roleLabel = state.isSuper ? 'SuperAdmin' : membership?.role === 'ticker' ? 'Nur Liveticker' : membership?.role === 'manager' ? 'Manager' : 'Editor';
    return `<article class="card flat"><p class="eyebrow">${escapeHtml(ts?.league || 'Mannschaft')}</p><h3>${escapeHtml(team.name)}</h3><p class="muted">${escapeHtml(ts?.group_name || '')}</p><p><span class="status-pill">${escapeHtml(roleLabel)}</span></p><button class="button secondary" data-open-team="${team.id}" data-editable="${editable ? '1' : '0'}">${editable ? 'Mannschaft bearbeiten' : 'Zum Liveticker'}</button></article>`;
  }).join('') || '<p class="muted">Noch keine Mannschaft zugeordnet.</p>';
  target.querySelectorAll<HTMLButtonElement>('[data-open-team]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.editable === '1') {
      const select = $<HTMLSelectElement>('#team-select');
      if (select) select.value = button.dataset.openTeam || '';
      fillTeamForm();
      showPanel('teams');
    } else {
      showPanel('matches');
    }
  }));
}

function fillTeamForm() {
  const select = $<HTMLSelectElement>('#team-select');
  if (!select) return;
  const team = state.teams.find((t) => t.id === select.value);
  if (!team) return;
  const ts = currentTeamSeason(team.id);
  ($<HTMLInputElement>('#team-name')!).value = team.name ?? '';
  ($<HTMLInputElement>('#team-short-name')!).value = team.short_name ?? '';
  ($<HTMLTextAreaElement>('#team-description')!).value = team.description ?? '';
  ($<HTMLInputElement>('#team-league')!).value = ts?.league ?? '';
  ($<HTMLInputElement>('#team-group')!).value = ts?.group_name ?? '';
  ($<HTMLInputElement>('#team-btv-url')!).value = ts?.btv_url ?? '';
  const preview = $('#team-image-preview');
  if (preview) {
    const path = team.image_path || defaultTeamImagePath(team);
    const isDefault = path === defaultTeamImagePath(team);
    preview.innerHTML = path
      ? `<img src="${escapeHtml(mediaUrl(path))}" alt="Aktuelles Mannschaftsbild ${escapeHtml(team.name)}" /><div><strong>${isDefault ? 'Standardbild' : 'Individuelles Mannschaftsfoto'}</strong><p class="muted">${isDefault ? 'Bis ein echtes Mannschaftsfoto hochgeladen wird.' : 'Dieses Bild wird öffentlich angezeigt.'}</p></div>`
      : '<p class="muted">Noch kein Mannschaftsbild vorhanden.</p>';
  }
}

async function saveTeam(event: Event) {
  event.preventDefault();
  const teamId = $<HTMLSelectElement>('#team-select')?.value;
  if (!teamId) return;
  const ts = currentTeamSeason(teamId);
  const existingTeam = state.teams.find((row) => row.id === teamId);
  const oldImagePath = existingTeam?.image_path || null;
  const teamUpdate = {
    name: $<HTMLInputElement>('#team-name')?.value.trim(),
    short_name: $<HTMLInputElement>('#team-short-name')?.value.trim() || null,
    description: $<HTMLTextAreaElement>('#team-description')?.value.trim() || null,
  };
  const { error: teamError } = await supabase.from('teams').update(teamUpdate).eq('id', teamId);
  if (teamError) return status(teamError.message, 'error');

  if (ts) {
    const { error: seasonError } = await supabase.from('team_seasons').update({
      league: $<HTMLInputElement>('#team-league')?.value.trim() || null,
      group_name: $<HTMLInputElement>('#team-group')?.value.trim() || null,
      btv_url: $<HTMLInputElement>('#team-btv-url')?.value.trim() || null,
    }).eq('id', ts.id);
    if (seasonError) return status(seasonError.message, 'error');
  }

  const file = $<HTMLInputElement>('#team-image')?.files?.[0];
  if (file) {
    const image = await optimizeImage(file);
    const path = `teams/${teamId}/team/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(path, image, { upsert: false });
    if (uploadError) return status(uploadError.message, 'error');
    const { error: imageError } = await supabase.from('teams').update({ image_path: path }).eq('id', teamId);
    if (imageError) return status(imageError.message, 'error');

    if (oldImagePath && oldImagePath !== path && oldImagePath.startsWith(`teams/${teamId}/team/`)) {
      await supabase.storage.from('media').remove([oldImagePath]);
    }
  }

  await loadCore();
  renderSelectors();
  fillTeamForm();
  await refreshDashboard();
  status('Mannschaft gespeichert.', 'success');
}

async function resetTeamImage() {
  const teamId = $<HTMLSelectElement>('#team-select')?.value;
  const team = state.teams.find((row) => row.id === teamId);
  if (!teamId || !team) return;
  const fallback = defaultTeamImagePath(team);
  if (!fallback) return status('Für diese Mannschaft ist kein Standardbild definiert.', 'error');

  const currentPath = team.image_path;
  const { error } = await supabase.from('teams').update({ image_path: fallback }).eq('id', teamId);
  if (error) return status(error.message, 'error');

  if (currentPath && currentPath !== fallback && currentPath.startsWith(`teams/${teamId}/team/`)) {
    await supabase.storage.from('media').remove([currentPath]);
  }

  await loadCore();
  renderSelectors();
  fillTeamForm();
  status('Standardbild wiederhergestellt.', 'success');
}

async function refreshPlayers() {
  const tsId = $<HTMLSelectElement>('#players-team-season')?.value;
  const target = $('#players-list');
  if (!tsId || !target) return;

  const { data: links } = await supabase
    .from('team_players')
    .select('*')
    .eq('team_season_id', tsId)
    .order('is_captain', { ascending: false })
    .order('sort_order');

  const ids = (links ?? []).map((x) => x.player_id);
  const players = ids.length
    ? (await supabase.from('players').select('*').in('id', ids)).data ?? []
    : [];
  const pMap = new Map(players.map((p) => [p.id, p]));

  target.innerHTML = `<table class="data-table roster-admin-table">
    <thead><tr><th>Foto</th><th>Name</th><th>Rolle</th><th>Sichtbarkeit</th><th></th></tr></thead>
    <tbody>${(links ?? []).map((link) => {
      const p: any = pMap.get(link.player_id);
      const photo = p?.photo_path
        ? `<img class="admin-thumb" src="${escapeHtml(mediaUrl(p.photo_path))}" alt="" />`
        : '<span class="admin-thumb admin-thumb--empty" aria-hidden="true">•</span>';
      return `<tr data-player-row="${link.id}" data-player-id="${link.player_id}">
        <td>${photo}</td>
        <td><strong>${escapeHtml(p?.display_name || '')}</strong></td>
        <td>${link.is_captain ? 'Mannschaftsführung' : 'Kader'}</td>
        <td>${link.public_visible ? 'Öffentlich' : 'Intern'}</td>
        <td>
          <div class="actions">
            <button class="button ghost" data-edit-player="${link.player_id}">Bearbeiten</button>
            <button class="button ghost" data-toggle-captain="${link.id}">${link.is_captain ? 'Führung entfernen' : 'Als Führung'}</button>
            <button class="button ghost" data-toggle-visible="${link.id}">${link.public_visible ? 'Verbergen' : 'Veröffentlichen'}</button>
            <button class="button ghost" data-remove-player="${link.id}">Entfernen</button>
          </div>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;

  target.querySelectorAll<HTMLButtonElement>('[data-edit-player]').forEach((button) => button.addEventListener('click', () => {
    const playerId = button.dataset.editPlayer;
    const player: any = pMap.get(playerId);
    const link = (links ?? []).find((row) => row.player_id === playerId);
    if (!player || !link) return;
    ($<HTMLInputElement>('#player-edit-id')!).value = player.id;
    ($<HTMLInputElement>('#player-display-name')!).value = player.display_name ?? '';
    ($<HTMLInputElement>('#player-captain')!).checked = !!link.is_captain;
    ($<HTMLInputElement>('#player-public-visible')!).checked = !!link.public_visible;
    const submit = $<HTMLButtonElement>('#player-submit');
    if (submit) submit.textContent = 'Spieler speichern';
    $<HTMLButtonElement>('#player-cancel-edit')?.classList.remove('hidden');
    $<HTMLInputElement>('#player-display-name')?.focus();
  }));

  target.querySelectorAll<HTMLButtonElement>('[data-toggle-captain]').forEach((button) => button.addEventListener('click', async () => {
    const link = (links ?? []).find((row) => row.id === button.dataset.toggleCaptain);
    if (!link) return;
    const { error } = await supabase.from('team_players').update({ is_captain: !link.is_captain }).eq('id', link.id);
    if (error) status(error.message, 'error'); else refreshPlayers();
  }));

  target.querySelectorAll<HTMLButtonElement>('[data-toggle-visible]').forEach((button) => button.addEventListener('click', async () => {
    const link = (links ?? []).find((row) => row.id === button.dataset.toggleVisible);
    if (!link) return;
    const { error } = await supabase.from('team_players').update({ public_visible: !link.public_visible }).eq('id', link.id);
    if (error) status(error.message, 'error'); else {
      status(link.public_visible ? 'Spieler ist jetzt intern.' : 'Spieler ist jetzt öffentlich sichtbar.', 'success');
      refreshPlayers();
    }
  }));

  target.querySelectorAll<HTMLButtonElement>('[data-remove-player]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Spieler aus dieser Mannschaft entfernen?')) return;
    const { error } = await supabase.from('team_players').delete().eq('id', button.dataset.removePlayer);
    if (error) status(error.message, 'error'); else {
      status('Kader aktualisiert.', 'success');
      resetPlayerForm();
      refreshPlayers();
    }
  }));
}

function resetPlayerForm() {
  ($<HTMLFormElement>('#player-form'))?.reset();
  const editId = $<HTMLInputElement>('#player-edit-id');
  if (editId) editId.value = '';
  const visible = $<HTMLInputElement>('#player-public-visible');
  if (visible) visible.checked = false;
  const submit = $<HTMLButtonElement>('#player-submit');
  if (submit) submit.textContent = 'Spieler hinzufügen';
  $<HTMLButtonElement>('#player-cancel-edit')?.classList.add('hidden');
}

async function savePlayer(event: Event) {
  event.preventDefault();
  const tsId = $<HTMLSelectElement>('#players-team-season')?.value;
  const ts = state.teamSeasons.find((x) => x.id === tsId);
  const displayName = $<HTMLInputElement>('#player-display-name')?.value.trim();
  const editId = $<HTMLInputElement>('#player-edit-id')?.value || '';
  if (!tsId || !ts || !displayName) return;

  let playerId = editId;
  let oldPhotoPath: string | null = null;

  if (editId) {
    const existingPlayer = (await supabase.from('players').select('photo_path').eq('id', editId).maybeSingle()).data;
    oldPhotoPath = existingPlayer?.photo_path || null;
    const { error } = await supabase.from('players').update({
      display_name: displayName,
      active: true,
    }).eq('id', editId);
    if (error) return status(error.message, 'error');
  } else {
    const { data: player, error } = await supabase
      .from('players')
      .insert({ display_name: displayName, active: true })
      .select()
      .single();
    if (error || !player) return status(error?.message || 'Spieler konnte nicht angelegt werden.', 'error');
    playerId = player.id;

    const { error: linkError } = await supabase.from('team_players').insert({
      team_season_id: tsId,
      player_id: playerId,
      is_captain: $<HTMLInputElement>('#player-captain')?.checked ?? false,
      public_visible: $<HTMLInputElement>('#player-public-visible')?.checked ?? false,
    });
    if (linkError) return status(linkError.message, 'error');
  }

  if (editId) {
    const { error: linkError } = await supabase.from('team_players').update({
      is_captain: $<HTMLInputElement>('#player-captain')?.checked ?? false,
      public_visible: $<HTMLInputElement>('#player-public-visible')?.checked ?? false,
    }).eq('team_season_id', tsId).eq('player_id', playerId);
    if (linkError) return status(linkError.message, 'error');
  }

  const file = $<HTMLInputElement>('#player-photo')?.files?.[0];
  if (file) {
    const image = await optimizeImage(file, 1200, 0.82);
    const path = `teams/${ts.team_id}/players/${playerId}/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(path, image);
    if (uploadError) return status(uploadError.message, 'error');
    const { error: photoError } = await supabase.from('players').update({ photo_path: path }).eq('id', playerId);
    if (photoError) return status(photoError.message, 'error');

    if (oldPhotoPath && oldPhotoPath !== path && oldPhotoPath.includes(`/players/${playerId}/`)) {
      await supabase.storage.from('media').remove([oldPhotoPath]);
    }
  }

  resetPlayerForm();
  status(editId ? 'Spieler aktualisiert.' : 'Spieler hinzugefügt.', 'success');
  refreshPlayers();
}

async function refreshMatches() {
  const ids = allowedTeamSeasons('tick').map((ts) => ts.id);
  if (!ids.length) return;
  const { data } = await supabase.from('matches').select('*').in('team_season_id', ids).order('starts_at', { ascending: false });
  state.matches = data ?? [];
  renderGalleryMatchOptions();
  const liveStates = state.matches.length ? (await supabase.from('match_live_state').select('*').in('match_id', state.matches.map((m) => m.id))).data ?? [] : [];
  const liveMap = new Map(liveStates.map((x) => [x.match_id, x]));
  const target = $('#matches-admin-list');
  if (!target) return;
  target.innerHTML = state.matches.map((match) => {
    const ts = state.teamSeasons.find((x) => x.id === match.team_season_id);
    const team = state.teams.find((x) => x.id === ts?.team_id);
    const live: any = liveMap.get(match.id) || { status: 'scheduled', home_score: 0, away_score: 0 };
    return `<article class="card flat" data-match-card="${match.id}">
      <div class="page-head"><div><p class="eyebrow">${escapeHtml(team?.name || '')}</p><h3>${escapeHtml(match.opponent)}</h3><p class="muted">${escapeHtml(formatDateTime(match.starts_at))} · ${match.is_home ? 'Heim' : 'Auswärts'}</p></div><span class="status-pill ${live.status === 'live' ? 'live' : ''}">${escapeHtml(live.status)}</span></div>
      <div class="score-control"><button data-score="home" data-delta="-1">−</button><strong>${live.home_score}</strong><button data-score="home" data-delta="1">+</button><span>:</span><button data-score="away" data-delta="-1">−</button><strong>${live.away_score}</strong><button data-score="away" data-delta="1">+</button></div>
      <div class="actions" style="margin-top:12px"><button class="button secondary" data-live-action="start">Live starten</button><button class="button ghost" data-live-action="finish">Beenden</button><a class="button ghost" href="/live/?match=${match.id}" target="_blank">Ticker öffnen ↗</a></div>
      <div class="field" style="margin-top:12px"><label>Tickermeldung</label><textarea data-ticker-message placeholder="z. B. Doppel 1 gewinnt den ersten Satz."></textarea><button class="button" data-publish-ticker>Veröffentlichen</button></div>
    </article>`;
  }).join('') || '<p class="muted">Noch keine Spiele.</p>';

  target.querySelectorAll<HTMLElement>('[data-match-card]').forEach((card) => {
    const matchId = card.dataset.matchCard!;
    const live: any = liveMap.get(matchId) || { match_id: matchId, status: 'scheduled', home_score: 0, away_score: 0 };
    card.querySelectorAll<HTMLButtonElement>('[data-score]').forEach((button) => button.addEventListener('click', async () => {
      const side = button.dataset.score as 'home' | 'away';
      const delta = Number(button.dataset.delta || 0);
      const patch: Row = { updated_by: state.user.id };
      patch[side === 'home' ? 'home_score' : 'away_score'] = Math.max(0, Number(live[side === 'home' ? 'home_score' : 'away_score'] || 0) + delta);
      const { error } = await supabase.from('match_live_state').update(patch).eq('match_id', matchId);
      if (error) status(error.message, 'error'); else refreshMatches();
    }));
    card.querySelectorAll<HTMLButtonElement>('[data-live-action]').forEach((button) => button.addEventListener('click', async () => {
      const action = button.dataset.liveAction;
      const patch = action === 'start'
        ? { status: 'live', started_at: new Date().toISOString(), finished_at: null, updated_by: state.user.id }
        : { status: 'finished', finished_at: new Date().toISOString(), updated_by: state.user.id };
      const { error } = await supabase.from('match_live_state').update(patch).eq('match_id', matchId);
      if (error) status(error.message, 'error'); else { status(action === 'start' ? 'Liveticker gestartet.' : 'Spiel beendet.', 'success'); refreshMatches(); }
    }));
    card.querySelector<HTMLButtonElement>('[data-publish-ticker]')?.addEventListener('click', async () => {
      const message = card.querySelector<HTMLTextAreaElement>('[data-ticker-message]')?.value.trim();
      if (!message) return;
      const current = (await supabase.from('match_live_state').select('*').eq('match_id', matchId).single()).data;
      const { error } = await supabase.from('live_ticker_entries').insert({
        match_id: matchId,
        author_id: state.user.id,
        message,
        entry_type: 'update',
        home_score: current?.home_score ?? null,
        away_score: current?.away_score ?? null,
      });
      if (error) status(error.message, 'error'); else {
        const area = card.querySelector<HTMLTextAreaElement>('[data-ticker-message]'); if (area) area.value = '';
        status('Tickermeldung veröffentlicht.', 'success');
      }
    });
  });

  const newsMatch = $<HTMLSelectElement>('#news-match');
  if (newsMatch) newsMatch.innerHTML = '<option value="">Kein Spiel</option>' + state.matches.map((m) => {
    const ts = state.teamSeasons.find((x) => x.id === m.team_season_id);
    const team = state.teams.find((x) => x.id === ts?.team_id);
    return `<option value="${m.id}">${escapeHtml(team?.name || '')} – ${escapeHtml(m.opponent)} – ${escapeHtml(formatDateTime(m.starts_at))}</option>`;
  }).join('');
}

async function addMatch(event: Event) {
  event.preventDefault();
  const start = $<HTMLInputElement>('#match-start')?.value;
  const end = $<HTMLInputElement>('#match-end')?.value;
  const { error } = await supabase.from('matches').insert({
    team_season_id: $<HTMLSelectElement>('#match-team-season')?.value,
    opponent: $<HTMLInputElement>('#match-opponent')?.value.trim(),
    starts_at: start ? new Date(start).toISOString() : null,
    ends_at: end ? new Date(end).toISOString() : null,
    is_home: $<HTMLInputElement>('#match-home')?.checked ?? true,
    external_url: $<HTMLInputElement>('#match-url')?.value.trim() || null,
    is_published: true,
  });
  if (error) return status(error.message, 'error');
  ($<HTMLFormElement>('#match-form'))?.reset();
  ($<HTMLInputElement>('#match-home'))!.checked = true;
  status('Spiel angelegt.', 'success');
  refreshMatches();
}

async function refreshNews() {
  const ids = allowedTeamIds();
  let query = supabase.from('news').select('*').order('created_at', { ascending: false });
  if (!state.isSuper && ids.length) query = query.in('team_id', ids);
  const { data } = await query;
  const target = $('#news-admin-list');
  if (!target) return;
  target.innerHTML = `<table class="data-table"><thead><tr><th>Titel</th><th>Status</th><th>Mannschaft</th></tr></thead><tbody>${(data ?? []).map((n) => `<tr><td>${escapeHtml(n.title)}</td><td>${escapeHtml(n.status)}</td><td>${escapeHtml(state.teams.find((t) => t.id === n.team_id)?.name || 'Allgemein')}</td></tr>`).join('')}</tbody></table>`;
}

async function addNews(event: Event) {
  event.preventDefault();
  const title = $<HTMLInputElement>('#news-title')?.value.trim() || '';
  const teamId = $<HTMLSelectElement>('#news-team')?.value || null;
  const matchId = $<HTMLSelectElement>('#news-match')?.value || null;
  const publication = $<HTMLSelectElement>('#news-status')?.value || 'draft';
  const { data: article, error } = await supabase.from('news').insert({
    slug: `${slugify(title)}-${Date.now().toString(36)}`,
    title,
    excerpt: $<HTMLTextAreaElement>('#news-excerpt')?.value.trim() || null,
    body: $<HTMLTextAreaElement>('#news-body')?.value.trim() || '',
    team_id: teamId,
    match_id: matchId,
    status: publication,
    author_id: state.user.id,
    published_at: publication === 'published' ? new Date().toISOString() : null,
  }).select().single();
  if (error || !article) return status(error?.message || 'Beitrag konnte nicht gespeichert werden.', 'error');

  const file = $<HTMLInputElement>('#news-image')?.files?.[0];
  if (file) {
    const image = await optimizeImage(file);
    const base = teamId ? `teams/${teamId}/news/${article.id}` : `site/news/${article.id}`;
    const path = `${base}/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(path, image);
    if (uploadError) return status(uploadError.message, 'error');
    const { error: imageError } = await supabase.from('news').update({ hero_image_path: path }).eq('id', article.id);
    if (imageError) return status(imageError.message, 'error');
  }

  ($<HTMLFormElement>('#news-form'))?.reset();
  status('Beitrag gespeichert.', 'success');
  refreshNews();
}

async function refreshEvents() {
  const ids = allowedTeamIds();
  let query = supabase.from('events').select('*').order('starts_at', { ascending: false });
  if (!state.isSuper && ids.length) query = query.in('team_id', ids);
  const { data } = await query;
  const target = $('#events-admin-list');
  if (!target) return;
  target.innerHTML = `<table class="data-table"><thead><tr><th>Termin</th><th>Titel</th><th>Mannschaft</th></tr></thead><tbody>${(data ?? []).map((e) => `<tr><td>${escapeHtml(formatDateTime(e.starts_at))}</td><td>${escapeHtml(e.title)}</td><td>${escapeHtml(state.teams.find((t) => t.id === e.team_id)?.name || 'Verein')}</td></tr>`).join('')}</tbody></table>`;
}

async function addEvent(event: Event) {
  event.preventDefault();
  const start = $<HTMLInputElement>('#event-start')?.value;
  const end = $<HTMLInputElement>('#event-end')?.value;
  const title = $<HTMLInputElement>('#event-title')?.value.trim() || '';
  const { error } = await supabase.from('events').insert({
    slug: `${slugify(title)}-${Date.now().toString(36)}`,
    title,
    description: $<HTMLTextAreaElement>('#event-description')?.value.trim() || null,
    category: $<HTMLInputElement>('#event-category')?.value.trim() || 'club',
    starts_at: start ? new Date(start).toISOString() : null,
    ends_at: end ? new Date(end).toISOString() : null,
    location_name: $<HTMLInputElement>('#event-location')?.value.trim() || null,
    team_id: $<HTMLSelectElement>('#event-team')?.value || null,
    status: 'published',
    created_by: state.user.id,
  });
  if (error) return status(error.message, 'error');
  ($<HTMLFormElement>('#event-form'))?.reset();
  status('Termin gespeichert.', 'success');
  refreshEvents();
}

async function refreshGalleries() {
  const ids = allowedTeamIds();
  const target = $('#galleries-list');
  if (!target) return;
  if (!ids.length) {
    target.innerHTML = '<p class="muted">Noch keine Mannschaft zugeordnet.</p>';
    return;
  }

  const { data } = await supabase
    .from('galleries')
    .select('*')
    .in('team_id', ids)
    .order('created_at', { ascending: false });

  const galleries = data ?? [];
  const galleryIds = galleries.map((g) => g.id);
  const items = galleryIds.length
    ? (await supabase.from('gallery_items').select('*').in('gallery_id', galleryIds).order('sort_order')).data ?? []
    : [];

  target.innerHTML = galleries.map((g) => {
    const galleryItems = items.filter((item) => item.gallery_id === g.id);
    const preview = galleryItems[0]?.storage_path
      ? `<img class="gallery-admin-preview" src="${escapeHtml(mediaUrl(galleryItems[0].storage_path))}" alt="" />`
      : '';
    const match = g.match_id ? state.matches.find((row) => row.id === g.match_id) : null;
    return `<article class="card flat" data-gallery-card="${g.id}">
      ${preview}
      <p class="eyebrow">${escapeHtml(state.teams.find((t) => t.id === g.team_id)?.name || '')}</p>
      <h3>${escapeHtml(g.title)}</h3>
      ${match ? `<p><strong>Punktspiel:</strong> ${escapeHtml(formatDateTime(match.starts_at))} · gegen ${escapeHtml(match.opponent)}</p>` : '<p class="muted">Allgemeine Mannschaftsgalerie</p>'}
      <p class="muted">${galleryItems.length} Bild${galleryItems.length === 1 ? '' : 'er'} · ${g.published ? 'Öffentlich' : 'Entwurf'}</p>
      <div class="actions">
        <button class="button ghost" data-toggle-gallery="${g.id}">${g.published ? 'Als Entwurf' : 'Veröffentlichen'}</button>
        <button class="button ghost" data-delete-gallery="${g.id}">Galerie löschen</button>
      </div>
    </article>`;
  }).join('') || '<p class="muted">Noch keine Galerien.</p>';

  target.querySelectorAll<HTMLButtonElement>('[data-toggle-gallery]').forEach((button) => button.addEventListener('click', async () => {
    const gallery = galleries.find((g) => g.id === button.dataset.toggleGallery);
    if (!gallery) return;
    const { error } = await supabase.from('galleries').update({ published: !gallery.published }).eq('id', gallery.id);
    if (error) status(error.message, 'error'); else {
      status(gallery.published ? 'Galerie ist jetzt ein Entwurf.' : 'Galerie veröffentlicht.', 'success');
      refreshGalleries();
    }
  }));

  target.querySelectorAll<HTMLButtonElement>('[data-delete-gallery]').forEach((button) => button.addEventListener('click', async () => {
    const galleryId = button.dataset.deleteGallery;
    if (!galleryId || !confirm('Galerie und alle zugehörigen Bilder löschen?')) return;
    const galleryItems = items.filter((item) => item.gallery_id === galleryId);
    const paths = galleryItems.map((item) => item.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from('media').remove(paths);
      if (storageError) return status(storageError.message, 'error');
    }
    const { error: itemError } = await supabase.from('gallery_items').delete().eq('gallery_id', galleryId);
    if (itemError) return status(itemError.message, 'error');
    const { error } = await supabase.from('galleries').delete().eq('id', galleryId);
    if (error) status(error.message, 'error'); else {
      status('Galerie gelöscht.', 'success');
      refreshGalleries();
    }
  }));
}

async function addGallery(event: Event) {
  event.preventDefault();
  const teamId = $<HTMLSelectElement>('#gallery-team')?.value;
  const title = $<HTMLInputElement>('#gallery-title')?.value.trim();
  const matchId = $<HTMLSelectElement>('#gallery-match')?.value || null;
  const files = Array.from($<HTMLInputElement>('#gallery-files')?.files ?? []);
  if (!teamId || !title || !files.length) return;

  const { data: gallery, error } = await supabase.from('galleries').insert({
    title,
    team_id: teamId,
    match_id: matchId,
    published: $<HTMLInputElement>('#gallery-published')?.checked ?? true,
    created_by: state.user.id,
  }).select().single();
  if (error || !gallery) return status(error?.message || 'Galerie konnte nicht angelegt werden.', 'error');

  for (const [index, file] of files.entries()) {
    const image = await optimizeImage(file, 1800, 0.82);
    const path = `teams/${teamId}/galleries/${gallery.id}/${Date.now()}-${index}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(path, image);
    if (uploadError) return status(uploadError.message, 'error');
    const { error: itemError } = await supabase.from('gallery_items').insert({
      gallery_id: gallery.id,
      storage_path: path,
      alt_text: `${title} – Bild ${index + 1}`,
      sort_order: index,
    });
    if (itemError) return status(itemError.message, 'error');
  }

  ($<HTMLFormElement>('#gallery-form'))?.reset();
  const published = $<HTMLInputElement>('#gallery-published');
  if (published) published.checked = true;
  status('Galerie gespeichert.', 'success');
  refreshGalleries();
}

async function loadFacility() {
  if (!state.isSuper) return;
  const [{ data: rows }, { data: courts }] = await Promise.all([
    supabase.from('facility_status').select('*').limit(1),
    supabase.from('courts').select('*').order('sort_order'),
  ]);
  const current = rows?.[0];
  if (current) {
    ($<HTMLSelectElement>('#facility-status')!).value = current.status;
    ($<HTMLTextAreaElement>('#facility-message')!).value = current.message ?? '';
  }
  const target = $('#courts-admin-list');
  if (!target) return;
  target.innerHTML = (courts ?? []).map((court) => `<div class="card flat" data-court="${court.id}"><div class="page-head"><strong>${escapeHtml(court.name)}</strong><div class="actions"><select data-court-status><option value="open" ${court.status === 'open' ? 'selected' : ''}>Offen</option><option value="limited" ${court.status === 'limited' ? 'selected' : ''}>Eingeschränkt</option><option value="closed" ${court.status === 'closed' ? 'selected' : ''}>Gesperrt</option></select><input data-court-message value="${escapeHtml(court.status_message || '')}" placeholder="Hinweis" /><button class="button ghost" data-save-court>Speichern</button></div></div></div>`).join('');
  target.querySelectorAll<HTMLElement>('[data-court]').forEach((row) => row.querySelector<HTMLButtonElement>('[data-save-court]')?.addEventListener('click', async () => {
    const { error } = await supabase.from('courts').update({
      status: row.querySelector<HTMLSelectElement>('[data-court-status]')?.value,
      status_message: row.querySelector<HTMLInputElement>('[data-court-message]')?.value.trim() || null,
    }).eq('id', row.dataset.court);
    if (error) status(error.message, 'error'); else status('Platzstatus gespeichert.', 'success');
  }));
}

async function saveFacility(event: Event) {
  event.preventDefault();
  const { error } = await supabase.from('facility_status').update({
    status: $<HTMLSelectElement>('#facility-status')?.value,
    message: $<HTMLTextAreaElement>('#facility-message')?.value.trim() || null,
    updated_by: state.user.id,
  }).eq('id', true);
  if (error) status(error.message, 'error'); else status('Anlagenstatus gespeichert.', 'success');
}

let pages: Row[] = [];
async function loadContent() {
  if (!state.isSuper) return;
  const { data } = await supabase.from('pages').select('*').order('title');
  pages = data ?? [];
  const select = $<HTMLSelectElement>('#page-select');
  if (!select) return;
  select.innerHTML = pages.map((p) => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
  fillPage();
}
function fillPage() {
  const id = $<HTMLSelectElement>('#page-select')?.value;
  const page = pages.find((p) => p.id === id);
  if (!page) return;
  ($<HTMLInputElement>('#page-title')!).value = page.title ?? '';
  ($<HTMLTextAreaElement>('#page-body')!).value = page.body ?? '';
  ($<HTMLInputElement>('#page-meta-title')!).value = page.meta_title ?? '';
  ($<HTMLInputElement>('#page-meta-description')!).value = page.meta_description ?? '';
}
async function savePage(event: Event) {
  event.preventDefault();
  const id = $<HTMLSelectElement>('#page-select')?.value;
  const { error } = await supabase.from('pages').update({
    title: $<HTMLInputElement>('#page-title')?.value.trim(),
    body: $<HTMLTextAreaElement>('#page-body')?.value,
    meta_title: $<HTMLInputElement>('#page-meta-title')?.value.trim() || null,
    meta_description: $<HTMLInputElement>('#page-meta-description')?.value.trim() || null,
    updated_by: state.user.id,
  }).eq('id', id);
  if (error) status(error.message, 'error'); else { status('Seite gespeichert.', 'success'); loadContent(); }
}

async function addSponsor(event: Event) {
  event.preventDefault();
  const { data: sponsor, error } = await supabase.from('sponsors').insert({
    name: $<HTMLInputElement>('#sponsor-name')?.value.trim(),
    url: $<HTMLInputElement>('#sponsor-url')?.value.trim() || null,
    description: $<HTMLTextAreaElement>('#sponsor-description')?.value.trim() || null,
    active: true,
  }).select().single();
  if (error || !sponsor) return status(error?.message || 'Sponsor konnte nicht gespeichert werden.', 'error');

  const file = $<HTMLInputElement>('#sponsor-logo')?.files?.[0];
  if (file) {
    const image = await optimizeImage(file, 1400, 0.9);
    const path = `site/sponsors/${sponsor.id}/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(path, image);
    if (uploadError) return status(uploadError.message, 'error');
    const { error: logoError } = await supabase.from('sponsors').update({ logo_path: path }).eq('id', sponsor.id);
    if (logoError) return status(logoError.message, 'error');
  }
  ($<HTMLFormElement>('#sponsor-form'))?.reset();
  status('Sponsor gespeichert.', 'success');
}

async function addOfficial(event: Event) {
  event.preventDefault();
  const { error } = await supabase.from('officials').insert({
    name: $<HTMLInputElement>('#official-name')?.value.trim(),
    title: $<HTMLInputElement>('#official-title')?.value.trim(),
    email: $<HTMLInputElement>('#official-email')?.value.trim() || null,
    phone: $<HTMLInputElement>('#official-phone')?.value.trim() || null,
    published: true,
  });
  if (error) status(error.message, 'error'); else { ($<HTMLFormElement>('#official-form'))?.reset(); status('Funktionär gespeichert.', 'success'); }
}

async function loadUsers() {
  if (!state.isSuper) return;
  await loadAdvancedUsers(state);
}

async function inviteUser(event: Event) {
  event.preventDefault();
  const globalRole = $<HTMLSelectElement>('#invite-global-role')?.value || 'user';
  const memberships = globalRole === 'super_admin'
    ? []
    : Array.from(document.querySelectorAll<HTMLElement>('#invite-teams [data-invite-team-card]'))
        .map((card) => {
          const checkbox = card.querySelector<HTMLInputElement>('[data-invite-team]');
          const role = card.querySelector<HTMLSelectElement>('[data-invite-team-role]');
          if (!checkbox?.checked) return null;
          return {
            team_id: checkbox.value,
            role: role?.value || 'editor',
          };
        })
        .filter((item): item is { team_id: string; role: string } => item !== null);

  const payload = {
    action: 'invite',
    display_name: $<HTMLInputElement>('#invite-name')?.value.trim(),
    email: $<HTMLInputElement>('#invite-email')?.value.trim(),
    global_role: globalRole,
    memberships,
    redirect_to: `${location.origin}${import.meta.env.BASE_URL}admin/`,
  };
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload });
  if (error || data?.error) return status(data?.error || error?.message || 'Einladung fehlgeschlagen.', 'error');

  ($<HTMLFormElement>('#invite-form'))?.reset();
  renderInviteTeamCards();
  status('Einladung wurde versendet.', 'success');
  loadUsers();
}

function renderInviteTeamCards() {
  const invite = $('#invite-teams');
  const section = $<HTMLElement>('#invite-team-section');
  const superInfo = $<HTMLElement>('#invite-superadmin-info');
  if (!invite || !section || !superInfo || !state.isSuper) return;

  const isSuperAdmin = $<HTMLSelectElement>('#invite-global-role')?.value === 'super_admin';

  section.hidden = isSuperAdmin;
  superInfo.hidden = !isSuperAdmin;
  section.setAttribute('aria-hidden', isSuperAdmin ? 'true' : 'false');
  superInfo.setAttribute('aria-hidden', isSuperAdmin ? 'false' : 'true');

  if (isSuperAdmin) {
    invite.innerHTML = '';
    return;
  }

  invite.innerHTML = state.teams.map((team) => `
    <div class="invite-team-card card flat" data-invite-team-card>
      <label class="invite-team-check">
        <input data-invite-team type="checkbox" value="${team.id}" ${isSuperAdmin ? 'disabled' : ''} />
        <strong>${escapeHtml(team.name)}</strong>
      </label>
      <label class="invite-team-role">
        <span>Rolle</span>
        <select data-invite-team-role disabled>
          <option value="editor" selected>Editor</option>
          <option value="manager">Manager</option>
          <option value="ticker">Nur Liveticker</option>
        </select>
      </label>
    </div>
  `).join('');

  invite.querySelectorAll<HTMLElement>('[data-invite-team-card]').forEach((card) => {
    const checkbox = card.querySelector<HTMLInputElement>('[data-invite-team]');
    const role = card.querySelector<HTMLSelectElement>('[data-invite-team-role]');
    checkbox?.addEventListener('change', () => {
      if (role) role.disabled = !checkbox.checked;
      card.classList.toggle('selected', !!checkbox?.checked);
    });
  });
}

function renderSelectors() {
  const teamOptions = allowedTeams('edit').map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  const teamSelect = $<HTMLSelectElement>('#team-select');
  if (teamSelect) teamSelect.innerHTML = teamOptions;
  renderTeamOptions('#news-team', state.isSuper, 'edit');
  renderTeamOptions('#event-team', state.isSuper, 'edit');
  renderTeamOptions('#gallery-team', false, 'edit');
  renderGalleryMatchOptions();
  renderTeamSeasonOptions('#players-team-season', 'edit');
  renderTeamSeasonOptions('#match-team-season', 'edit');

  renderInviteTeamCards();

  fillTeamForm();
}


function bindForms() {
  $<HTMLFormElement>('#team-form')?.addEventListener('submit', saveTeam);
  $<HTMLSelectElement>('#team-select')?.addEventListener('change', fillTeamForm);
  $<HTMLButtonElement>('#team-image-reset')?.addEventListener('click', resetTeamImage);
  $<HTMLFormElement>('#player-form')?.addEventListener('submit', savePlayer);
  $<HTMLSelectElement>('#players-team-season')?.addEventListener('change', () => { resetPlayerForm(); refreshPlayers(); });
  $<HTMLButtonElement>('#player-cancel-edit')?.addEventListener('click', resetPlayerForm);
  $<HTMLFormElement>('#match-form')?.addEventListener('submit', addMatch);
  $<HTMLFormElement>('#news-form')?.addEventListener('submit', addNews);
  $<HTMLFormElement>('#event-form')?.addEventListener('submit', addEvent);
  $<HTMLFormElement>('#gallery-form')?.addEventListener('submit', addGallery);
  $<HTMLSelectElement>('#gallery-team')?.addEventListener('change', renderGalleryMatchOptions);
  $<HTMLFormElement>('#facility-form')?.addEventListener('submit', saveFacility);
  $<HTMLSelectElement>('#page-select')?.addEventListener('change', fillPage);
  $<HTMLFormElement>('#page-form')?.addEventListener('submit', savePage);
  $<HTMLFormElement>('#sponsor-form')?.addEventListener('submit', addSponsor);
  $<HTMLFormElement>('#official-form')?.addEventListener('submit', addOfficial);
  $<HTMLFormElement>('#invite-form')?.addEventListener('submit', inviteUser);
  $<HTMLSelectElement>('#invite-global-role')?.addEventListener('change', renderInviteTeamCards);
  $<HTMLFormElement>('#password-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $<HTMLInputElement>('#new-password')?.value;
    if (!password) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) status(error.message, 'error'); else { ($<HTMLFormElement>('#password-form'))?.reset(); status('Passwort aktualisiert.', 'success'); }
  });
}

async function startApp(user: any) {
  state.user = user;
  try {
    state.profile = await ensureProfile(user);
  } catch (error: any) {
    setStatus($('#auth-status'), error.message || 'Profil konnte nicht geladen werden.', 'error');
    return;
  }
  state.isSuper = state.profile?.global_role === 'super_admin';
  await loadCore();

  const canEditAny = state.isSuper || ownMemberships().some((m) => ['manager', 'editor'].includes(m.role));
  const canTickAny = state.isSuper || ownMemberships().some((m) => ['manager', 'editor', 'ticker'].includes(m.role));
  document.querySelectorAll<HTMLElement>('[data-editor-only]').forEach((el) => el.classList.toggle('hidden', !canEditAny));
  document.querySelectorAll<HTMLElement>('[data-ticker-only]').forEach((el) => el.classList.toggle('hidden', !canTickAny));
  $('#match-create-card')?.classList.toggle('hidden', !canEditAny);

  $('#auth-box')?.classList.add('hidden');
  $('#admin-app')?.classList.remove('hidden');
  const line = $('#admin-userline');
  if (line) line.textContent = `${state.profile?.display_name || user.email} · ${state.isSuper ? 'SuperAdmin' : 'Mannschafts-Nutzer'}`;
  $('[data-super-only]')?.classList.toggle('hidden', !state.isSuper);
  document.querySelectorAll<HTMLElement>('[data-super-only]').forEach((el) => el.classList.toggle('hidden', !state.isSuper));

  renderSelectors();
  bindNav();
  bindForms();
  await Promise.all([refreshDashboard(), refreshPlayers(), refreshMatches(), refreshNews(), refreshEvents(), refreshGalleries()]);
  if (state.isSuper) await Promise.all([loadFacility(), loadContent(), loadUsers()]);
  await initAdvancedAdmin(state);
}

export async function initAdmin() {
  const authStatus = $('#auth-status');

  $<HTMLFormElement>('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $<HTMLInputElement>('#login-email')?.value.trim() || '';
    const password = $<HTMLInputElement>('#login-password')?.value || '';
    setStatus(authStatus, 'Anmeldung läuft …');
    authStatus?.classList.remove('hidden');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return setStatus(authStatus, error?.message || 'Anmeldung fehlgeschlagen.', 'error');
    await startApp(data.user);
  });

  $<HTMLFormElement>('#password-reset-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $<HTMLInputElement>('#reset-email')?.value.trim() || '';
    if (!email) return;
    const redirectTo = `${location.origin}${import.meta.env.BASE_URL}admin/`;
    setStatus(authStatus, 'E-Mail wird vorbereitet …');
    authStatus?.classList.remove('hidden');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return setStatus(authStatus, error.message, 'error');
    setStatus(authStatus, 'Wenn die Adresse bekannt ist, wurde ein Link zum Zurücksetzen gesendet.', 'success');
  });

  $('#logout-button')?.addEventListener('click', async () => { await supabase.auth.signOut(); location.reload(); });

  const { data } = await supabase.auth.getSession();
  if (data.session?.user) await startApp(data.session.user);
}
