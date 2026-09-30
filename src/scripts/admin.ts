import { supabase } from '../lib/supabase';
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

function allowedTeamIds() {
  if (state.isSuper) return state.teams.map((t) => t.id);
  return state.memberships.filter((m) => m.active).map((m) => m.team_id);
}

function allowedTeams() {
  const ids = new Set(allowedTeamIds());
  return state.teams.filter((t) => ids.has(t.id));
}

function allowedTeamSeasons() {
  const ids = new Set(allowedTeamIds());
  return state.teamSeasons.filter((ts) => ids.has(ts.team_id));
}

function currentTeamSeason(teamId: string) {
  const current = state.seasons.find((s) => s.is_current) ?? state.seasons[0];
  return state.teamSeasons.find((ts) => ts.team_id === teamId && ts.season_id === current?.id)
    ?? state.teamSeasons.find((ts) => ts.team_id === teamId);
}

function teamSeasonLabel(ts: Row) {
  const team = state.teams.find((t) => t.id === ts.team_id);
  const season = state.seasons.find((s) => s.id === ts.season_id);
  return `${team?.name ?? 'Team'} · ${season?.name ?? ''}`;
}

function renderTeamOptions(selector: string, includeBlank = false) {
  const el = $<HTMLSelectElement>(selector);
  if (!el) return;
  el.innerHTML = (includeBlank ? '<option value="">Keine / Verein allgemein</option>' : '') +
    allowedTeams().map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
}

function renderTeamSeasonOptions(selector: string) {
  const el = $<HTMLSelectElement>(selector);
  if (!el) return;
  el.innerHTML = allowedTeamSeasons().map((ts) => `<option value="${ts.id}">${escapeHtml(teamSeasonLabel(ts))}</option>`).join('');
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
  target.innerHTML = allowedTeams().map((team) => {
    const ts = currentTeamSeason(team.id);
    return `<article class="card flat"><p class="eyebrow">${escapeHtml(ts?.league || 'Mannschaft')}</p><h3>${escapeHtml(team.name)}</h3><p class="muted">${escapeHtml(ts?.group_name || '')}</p><button class="button secondary" data-open-team="${team.id}">Bearbeiten</button></article>`;
  }).join('') || '<p class="muted">Noch keine Mannschaft zugeordnet.</p>';
  target.querySelectorAll<HTMLButtonElement>('[data-open-team]').forEach((button) => button.addEventListener('click', () => {
    const select = $<HTMLSelectElement>('#team-select');
    if (select) select.value = button.dataset.openTeam || '';
    fillTeamForm();
    showPanel('teams');
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
}

async function saveTeam(event: Event) {
  event.preventDefault();
  const teamId = $<HTMLSelectElement>('#team-select')?.value;
  if (!teamId) return;
  const ts = currentTeamSeason(teamId);
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
  }

  await loadCore();
  renderSelectors();
  fillTeamForm();
  await refreshDashboard();
  status('Mannschaft gespeichert.', 'success');
}

async function refreshPlayers() {
  const tsId = $<HTMLSelectElement>('#players-team-season')?.value;
  const target = $('#players-list');
  if (!tsId || !target) return;
  const { data: links } = await supabase.from('team_players').select('*').eq('team_season_id', tsId).order('sort_order');
  const ids = (links ?? []).map((x) => x.player_id);
  const players = ids.length ? (await supabase.from('players').select('*').in('id', ids)).data ?? [] : [];
  const pMap = new Map(players.map((p) => [p.id, p]));
  target.innerHTML = `<table class="data-table"><thead><tr><th>Name</th><th>Rolle</th><th></th></tr></thead><tbody>${(links ?? []).map((link) => {
    const p: any = pMap.get(link.player_id);
    return `<tr><td>${escapeHtml(p?.display_name || '')}</td><td>${link.is_captain ? 'Mannschaftsführung' : 'Kader'}</td><td><button class="button ghost" data-remove-player="${link.id}">Entfernen</button></td></tr>`;
  }).join('')}</tbody></table>`;
  target.querySelectorAll<HTMLButtonElement>('[data-remove-player]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Spieler aus dieser Mannschaft entfernen?')) return;
    const { error } = await supabase.from('team_players').delete().eq('id', button.dataset.removePlayer);
    if (error) status(error.message, 'error'); else { status('Kader aktualisiert.', 'success'); refreshPlayers(); }
  }));
}

async function addPlayer(event: Event) {
  event.preventDefault();
  const tsId = $<HTMLSelectElement>('#players-team-season')?.value;
  const ts = state.teamSeasons.find((x) => x.id === tsId);
  const displayName = $<HTMLInputElement>('#player-display-name')?.value.trim();
  if (!tsId || !ts || !displayName) return;

  const { data: player, error } = await supabase.from('players').insert({ display_name: displayName }).select().single();
  if (error || !player) return status(error?.message || 'Spieler konnte nicht angelegt werden.', 'error');

  const file = $<HTMLInputElement>('#player-photo')?.files?.[0];
  if (file) {
    const image = await optimizeImage(file, 1600, 0.82);
    const path = `teams/${ts.team_id}/players/${player.id}/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(path, image);
    if (!uploadError) await supabase.from('players').update({ photo_path: path }).eq('id', player.id);
  }

  const { error: linkError } = await supabase.from('team_players').insert({
    team_season_id: tsId,
    player_id: player.id,
    is_captain: $<HTMLInputElement>('#player-captain')?.checked ?? false,
    public_visible: true,
  });
  if (linkError) return status(linkError.message, 'error');
  ($<HTMLFormElement>('#player-form'))?.reset();
  status('Spieler hinzugefügt.', 'success');
  refreshPlayers();
}

async function refreshMatches() {
  const ids = allowedTeamSeasons().map((ts) => ts.id);
  if (!ids.length) return;
  const { data } = await supabase.from('matches').select('*').in('team_season_id', ids).order('starts_at', { ascending: false });
  state.matches = data ?? [];
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
  if (!ids.length) return;
  const { data } = await supabase.from('galleries').select('*').in('team_id', ids).order('created_at', { ascending: false });
  const target = $('#galleries-list');
  if (!target) return;
  target.innerHTML = (data ?? []).map((g) => `<article class="card flat"><p class="eyebrow">${escapeHtml(state.teams.find((t) => t.id === g.team_id)?.name || '')}</p><h3>${escapeHtml(g.title)}</h3><p class="muted">${g.published ? 'Öffentlich' : 'Entwurf'}</p></article>`).join('') || '<p class="muted">Noch keine Galerien.</p>';
}

async function addGallery(event: Event) {
  event.preventDefault();
  const teamId = $<HTMLSelectElement>('#gallery-team')?.value;
  const title = $<HTMLInputElement>('#gallery-title')?.value.trim();
  const files = Array.from($<HTMLInputElement>('#gallery-files')?.files ?? []);
  if (!teamId || !title || !files.length) return;
  const { data: gallery, error } = await supabase.from('galleries').insert({ title, team_id: teamId, published: true, created_by: state.user.id }).select().single();
  if (error || !gallery) return status(error?.message || 'Galerie konnte nicht angelegt werden.', 'error');

  for (const [index, file] of files.entries()) {
    const image = await optimizeImage(file);
    const path = `teams/${teamId}/galleries/${gallery.id}/${Date.now()}-${index}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(path, image);
    if (uploadError) return status(uploadError.message, 'error');
    const { error: itemError } = await supabase.from('gallery_items').insert({ gallery_id: gallery.id, storage_path: path, alt_text: title, sort_order: index });
    if (itemError) return status(itemError.message, 'error');
  }
  ($<HTMLFormElement>('#gallery-form'))?.reset();
  status('Galerie veröffentlicht.', 'success');
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
  const checked = Array.from(document.querySelectorAll<HTMLInputElement>('#invite-teams input[type="checkbox"]:checked')).map((x) => x.value);
  const payload = {
    action: 'invite',
    display_name: $<HTMLInputElement>('#invite-name')?.value.trim(),
    email: $<HTMLInputElement>('#invite-email')?.value.trim(),
    global_role: $<HTMLSelectElement>('#invite-global-role')?.value,
    team_role: $<HTMLSelectElement>('#invite-team-role')?.value,
    team_ids: checked,
    redirect_to: `${location.origin}/admin/`,
  };
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload });
  if (error || data?.error) return status(data?.error || error?.message || 'Einladung fehlgeschlagen.', 'error');
  ($<HTMLFormElement>('#invite-form'))?.reset();
  status('Einladung wurde versendet.', 'success');
  loadUsers();
}

function renderSelectors() {
  const teamOptions = allowedTeams().map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  const teamSelect = $<HTMLSelectElement>('#team-select');
  if (teamSelect) teamSelect.innerHTML = teamOptions;
  renderTeamOptions('#news-team', state.isSuper);
  renderTeamOptions('#event-team', state.isSuper);
  renderTeamOptions('#gallery-team');
  renderTeamSeasonOptions('#players-team-season');
  renderTeamSeasonOptions('#match-team-season');

  const invite = $('#invite-teams');
  if (invite && state.isSuper) invite.innerHTML = state.teams.map((team) => `<label class="card flat"><input type="checkbox" value="${team.id}" /> ${escapeHtml(team.name)}</label>`).join('');

  fillTeamForm();
}

async function bootstrapAdmin() {
  const { data, error } = await supabase.functions.invoke('bootstrap-admin', { body: { display_name: state.profile?.display_name || '' } });
  if (error || data?.error) return status(data?.error || error?.message || 'Aktivierung fehlgeschlagen.', 'error');
  status('SuperAdmin wurde aktiviert. Oberfläche wird neu geladen.', 'success');
  window.setTimeout(() => location.reload(), 700);
}

function bindForms() {
  $<HTMLFormElement>('#team-form')?.addEventListener('submit', saveTeam);
  $<HTMLSelectElement>('#team-select')?.addEventListener('change', fillTeamForm);
  $<HTMLFormElement>('#player-form')?.addEventListener('submit', addPlayer);
  $<HTMLSelectElement>('#players-team-season')?.addEventListener('change', refreshPlayers);
  $<HTMLFormElement>('#match-form')?.addEventListener('submit', addMatch);
  $<HTMLFormElement>('#news-form')?.addEventListener('submit', addNews);
  $<HTMLFormElement>('#event-form')?.addEventListener('submit', addEvent);
  $<HTMLFormElement>('#gallery-form')?.addEventListener('submit', addGallery);
  $<HTMLFormElement>('#facility-form')?.addEventListener('submit', saveFacility);
  $<HTMLSelectElement>('#page-select')?.addEventListener('change', fillPage);
  $<HTMLFormElement>('#page-form')?.addEventListener('submit', savePage);
  $<HTMLFormElement>('#sponsor-form')?.addEventListener('submit', addSponsor);
  $<HTMLFormElement>('#official-form')?.addEventListener('submit', addOfficial);
  $<HTMLFormElement>('#invite-form')?.addEventListener('submit', inviteUser);
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

  $('#auth-box')?.classList.add('hidden');
  $('#admin-app')?.classList.remove('hidden');
  const line = $('#admin-userline');
  if (line) line.textContent = `${state.profile?.display_name || user.email} · ${state.isSuper ? 'SuperAdmin' : 'Mannschafts-Nutzer'}`;
  $('[data-super-only]')?.classList.toggle('hidden', !state.isSuper);
  document.querySelectorAll<HTMLElement>('[data-super-only]').forEach((el) => el.classList.toggle('hidden', !state.isSuper));
  $('#bootstrap-button')?.classList.toggle('hidden', state.isSuper);

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

  $<HTMLFormElement>('#signup-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $<HTMLInputElement>('#signup-email')?.value.trim() || '';
    const password = $<HTMLInputElement>('#signup-password')?.value || '';
    const displayName = $<HTMLInputElement>('#signup-name')?.value.trim() || '';
    authStatus?.classList.remove('hidden');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
    if (error) return setStatus(authStatus, error.message, 'error');
    if (data.session && data.user) {
      await startApp(data.user);
      await bootstrapAdmin();
    } else {
      setStatus(authStatus, 'Konto angelegt. Bitte E-Mail bestätigen und anschließend anmelden. Danach „SuperAdmin aktivieren“ verwenden.', 'success');
    }
  });

  $('#logout-button')?.addEventListener('click', async () => { await supabase.auth.signOut(); location.reload(); });
  $('#bootstrap-button')?.addEventListener('click', bootstrapAdmin);

  const { data } = await supabase.auth.getSession();
  if (data.session?.user) await startApp(data.session.user);
}
