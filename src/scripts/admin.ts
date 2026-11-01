import { mediaUrl, supabase } from '../lib/supabase';
import { optimizeImage } from '../lib/images';
import { initAdvancedAdmin, loadAdvancedUsers } from './admin-advanced';
import { initPhase8Admin } from './phase8';
import { initManualResultsPanel } from './manual-results-admin';
import { initOfficialReportsPanel } from './official-reports-admin';
import { escapeHtml, formatDateTime, setStatus, slugify } from '../lib/ui';
import { summarizeSetResult, homeAwaySetScore, validateSetScore } from '../lib/tennis-score.mjs';

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
  newsReferenceEvents: Row[];
} = { user: null, profile: null, isSuper: false, teams: [], seasons: [], teamSeasons: [], memberships: [], matches: [], newsReferenceEvents: [] };

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
  const seasonLabel = season?.code?.startsWith('sommer-')
    ? `Sommer ${String(season.code).replace('sommer-', '')}`
    : season?.code?.startsWith('winter-')
      ? `Winter ${String(season.code).replace('winter-', '').replace('-', '/')}`
      : season?.name ?? '';
  return `${team?.name ?? 'Team'} · ${seasonLabel}`;
}

let teamSeasonFilterCode = 'sommer-2026';
let rosterSeasonFilterCode = 'sommer-2026';

function renderAdminTeamSeasonFilter(preferredId = '') {
  const select = $<HTMLSelectElement>('#team-select');
  if (!select) return;
  const season = state.seasons.find((row) => row.code === teamSeasonFilterCode);
  const rows = allowedTeamSeasons('edit').filter((ts) => ts.season_id === season?.id);
  select.innerHTML = rows.length ? rows.map((ts) => `<option value="${ts.id}">${escapeHtml(teamSeasonLabel(ts))}</option>`).join('') : '<option value="">Noch keine Mannschaften in dieser Saison</option>';
  if (preferredId && rows.some((ts) => ts.id === preferredId)) select.value = preferredId;
  document.querySelectorAll<HTMLButtonElement>('[data-team-season]').forEach((button) => {
    const active = button.dataset.teamSeason === teamSeasonFilterCode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (rows.length) fillTeamForm();
  else {
    for (const id of ['team-name', 'team-short-name', 'team-description', 'team-league', 'team-group', 'team-btv-url']) {
      const control = $<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
      if (control) control.value = '';
    }
    const preview = $('#team-image-preview');
    if (preview) preview.innerHTML = '<p class="muted">Für diese Saison sind noch keine Mannschaften angelegt.</p>';
  }
}

function renderAdminRosterSeasonFilter(preferredId = '') {
  const select = $<HTMLSelectElement>('#players-team-season');
  if (!select) return;
  const season = state.seasons.find((row) => row.code === rosterSeasonFilterCode);
  const winterOrder = rosterSeasonFilterCode === 'winter-2026-2027' ? ['herren', 'herren-ii', 'herren-50'] : [];
  const rows = allowedTeamSeasons('edit')
    .filter((ts) => ts.season_id === season?.id)
    .sort((left, right) => {
      const leftTeam = state.teams.find((team) => team.id === left.team_id);
      const rightTeam = state.teams.find((team) => team.id === right.team_id);
      const leftRank = winterOrder.indexOf(leftTeam?.slug ?? '');
      const rightRank = winterOrder.indexOf(rightTeam?.slug ?? '');
      if (leftRank >= 0 || rightRank >= 0) return (leftRank < 0 ? Number.MAX_SAFE_INTEGER : leftRank) - (rightRank < 0 ? Number.MAX_SAFE_INTEGER : rightRank);
      return String(leftTeam?.name ?? '').localeCompare(String(rightTeam?.name ?? ''), 'de');
    });
  select.innerHTML = rows.length ? rows.map((ts) => `<option value="${ts.id}">${escapeHtml(teamSeasonLabel(ts))}</option>`).join('') : '<option value="">Noch keine Mannschaften in dieser Saison</option>';
  if (preferredId && rows.some((ts) => ts.id === preferredId)) select.value = preferredId;
  document.querySelectorAll<HTMLButtonElement>('[data-roster-season]').forEach((button) => {
    const active = button.dataset.rosterSeason === rosterSeasonFilterCode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
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


/** News references list only games and events belonging to the left-hand team. */
function renderNewsReferenceOptions(preferredValue?: string) {
  const el = $<HTMLSelectElement>('#news-match');
  if (!el) return;
  const teamId = $<HTMLSelectElement>('#news-team')?.value || '';
  const requested = preferredValue === undefined ? el.value : preferredValue;
  const matches = state.matches
    .filter(match => !!teamId && state.teamSeasons.find(ts => ts.id === match.team_season_id)?.team_id === teamId)
    .sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at)));
  const events = state.newsReferenceEvents
    .filter(event => (event.team_id || '') === teamId)
    .sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at)));

  el.innerHTML = '<option value="">Kein Spiel / Termin</option>'
    + (matches.length ? `<optgroup label="Spiele">${matches.map(match =>
      `<option value="${match.id}">${escapeHtml(formatDateTime(match.starts_at))} · ${escapeHtml(match.opponent)} · ${match.is_home ? 'Heim' : 'Auswärts'}</option>`
    ).join('')}</optgroup>` : '')
    + (events.length ? `<optgroup label="Termine / Events">${events.map(event =>
      `<option value="event:${event.id}">${escapeHtml(formatDateTime(event.starts_at))} · ${escapeHtml(event.title)}</option>`
    ).join('')}</optgroup>` : '')
    + (!matches.length && !events.length ? '<option value="" disabled>Keine passenden Spiele oder Termine</option>' : '');
  el.value = Array.from(el.options).some(o => !o.disabled && o.value === requested) ? requested : '';
}

async function refreshNewsReferenceEvents() {
  const teamIds = allowedTeamIds('edit');
  if (!state.isSuper && !teamIds.length) {
    state.newsReferenceEvents = [];
    renderNewsReferenceOptions();
    return;
  }
  let query = supabase.from('events')
    .select('id,title,team_id,starts_at,status,external_url')
    .neq('status', 'archived')
    .order('starts_at', { ascending: false });
  if (!state.isSuper) query = query.in('team_id', teamIds);
  const { data, error } = await query;
  state.newsReferenceEvents = error ? [] : data ?? [];
  if (error) status('Termine für den News-Bezug konnten nicht geladen werden: ' + error.message, 'error');
  renderNewsReferenceOptions();
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

const panelDescriptions: Record<string, string> = {
  dashboard: 'Dein Überblick über Mannschaften, Spiele und Aufgaben.',
  matches: 'Spieltage vorbereiten, Ergebnisse eintragen und den Liveticker pflegen.',
  teams: 'Mannschaftsdaten und Informationen für die Website verwalten.',
  players: 'Spielerkader prüfen und bearbeiten.',
  'btv-import': 'Amtliche BTV-Spieltermine prüfen und Änderungen nachvollziehen.',
  'manual-results': 'Fehlende Mannschaftsergebnisse geschützt nachtragen.',
  'official-rubbers': 'Verifizierte Einzel- und Doppelberichte ansehen.',
  news: 'Neuigkeiten und Spielberichte erstellen und aktualisieren.',
  galleries: 'Fotos und Bilder für deine Mannschaft verwalten.',
  content: 'Seiten, Sponsoren und Vereinsinformationen pflegen.',
  facility: 'Den aktuellen Anlagenstatus ändern.',
  seasons: 'Saisons anlegen und verwalten.',
  users: 'Zugänge einladen und Teamrechte verwalten.',
  audit: 'Änderungen an Daten und Inhalten prüfen.',
  settings: 'Zentrale Einstellungen der Website bearbeiten.',
  account: 'Deine persönlichen Kontoeinstellungen ändern.',
};

function panelButtonLabel(button: HTMLButtonElement) {
  const icon = button.querySelector('.admin-nav__symbol')?.textContent?.trim() || '';
  return (button.textContent || '').replace(icon, '').trim();
}

function showPanel(name: string) {
  if (name === 'manual-results' && !state.isSuper) return;
  if (name === 'official-rubbers' && !state.isSuper) return;
  const activeButton = Array.from(document.querySelectorAll<HTMLButtonElement>('.admin-nav button[data-panel]'))
    .find((button) => button.dataset.panel === name && !button.classList.contains('hidden'));
  const target = document.getElementById(`panel-${name}`);
  if (!activeButton || !target || target.classList.contains('hidden')) return;

  document.querySelectorAll<HTMLElement>('.admin-panel').forEach((panel) => {
    panel.classList.toggle('active', panel === target);
  });
  document.querySelectorAll<HTMLButtonElement>('.admin-nav button[data-panel]').forEach((button) => {
    const active = button === activeButton;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  const title = $('#admin-title');
  const description = $('#admin-section-description');
  const panelPicker = $<HTMLSelectElement>('#admin-panel-select');
  if (title) title.textContent = panelButtonLabel(activeButton) || 'Mein TSV';
  if (description) description.textContent = panelDescriptions[name] || '';
  if (panelPicker) panelPicker.value = name;
}

function applyDashboardTeamFilters() {
  const search = ($<HTMLInputElement>('#dashboard-team-search')?.value || '').trim().toLocaleLowerCase('de');
  const filter = $<HTMLSelectElement>('#dashboard-team-filter')?.value || 'all';
  const cards = Array.from(document.querySelectorAll<HTMLElement>('#dashboard-teams [data-dashboard-team-card]'));
  let visible = 0;

  cards.forEach((card) => {
    const teamName = card.querySelector('h3')?.textContent?.toLocaleLowerCase('de') || '';
    const match = !search || teamName.includes(search);
    const statusMatch = filter === 'all' || (filter === 'live' ? card.dataset.isLive === 'true' : card.dataset.hasNext === 'true');
    const show = match && statusMatch;
    card.classList.toggle('hidden', !show);
    if (show) visible++;
  });

  const count = $('#dashboard-team-count');
  if (count) count.textContent = `${visible} von ${cards.length} Mannschaften`;
  $('#dashboard-team-empty')?.classList.toggle('hidden', visible !== 0 || cards.length === 0);
}

function bindNav() {
  document.querySelectorAll<HTMLElement>('.admin-nav__group').forEach((group) => {
    const visibleButtons = Array.from(group.querySelectorAll<HTMLButtonElement>('button[data-panel]'))
      .filter((button) => !button.classList.contains('hidden'));
    group.classList.toggle('hidden', visibleButtons.length === 0);
  });

  const picker = $<HTMLSelectElement>('#admin-panel-select');
  if (picker) {
    picker.innerHTML = Array.from(document.querySelectorAll<HTMLElement>('.admin-nav__group'))
      .filter((group) => !group.classList.contains('hidden'))
      .map((group) => {
        const title = group.querySelector('.admin-nav__label')?.textContent?.trim() || 'Bereiche';
        const options = Array.from(group.querySelectorAll<HTMLButtonElement>('button[data-panel]'))
          .filter((button) => !button.classList.contains('hidden'))
          .map((button) => `<option value="${button.dataset.panel}">${escapeHtml(panelButtonLabel(button))}</option>`)
          .join('');
        return `<optgroup label="${escapeHtml(title)}">${options}</optgroup>`;
      }).join('');
    picker.value = 'dashboard';
    picker.addEventListener('change', () => showPanel(picker.value));
  }

  document.querySelectorAll<HTMLButtonElement>('.admin-nav button[data-panel]').forEach((button) => {
    button.addEventListener('click', () => button.dataset.panel && showPanel(button.dataset.panel));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-admin-jump]').forEach((button) => {
    button.addEventListener('click', () => button.dataset.adminJump && showPanel(button.dataset.adminJump));
  });
  $<HTMLButtonElement>('#admin-logout')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    button.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      status('Abmeldung fehlgeschlagen: ' + error.message, 'error');
      button.disabled = false;
      return;
    }
    window.location.assign(`${import.meta.env.BASE_URL}admin/`);
  });
  $<HTMLInputElement>('#dashboard-team-search')?.addEventListener('input', applyDashboardTeamFilters);
  $<HTMLSelectElement>('#dashboard-team-filter')?.addEventListener('change', applyDashboardTeamFilters);
}

async function refreshDashboard() {
  const target = $('#dashboard-teams');
  const liveTarget = $('#dashboard-live-action');
  if (!target || !liveTarget) return;

  const teams = allowedTeams('tick');
  if (!teams.length) {
    liveTarget.innerHTML = '<div class="dashboard-empty"><strong>Noch keine Mannschaft zugeordnet.</strong><p class="muted">Bitte wende dich an einen SuperAdmin.</p></div>';
    target.innerHTML = '<p class="muted">Noch keine Mannschaft zugeordnet.</p>';
    for (const id of ['admin-stat-teams', 'admin-stat-upcoming', 'admin-stat-live']) {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    }
    applyDashboardTeamFilters();
    return;
  }

  const teamSeasonIds = allowedTeamSeasons('tick').map((ts) => ts.id);
  const now = new Date();
  const recentStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const [{ data: matchRows }, { data: liveRows }] = await Promise.all([
    teamSeasonIds.length
      ? supabase.from('matches').select('*').in('team_season_id', teamSeasonIds).gte('starts_at', recentStart.toISOString()).order('starts_at').limit(80)
      : Promise.resolve({ data: [] }),
    supabase.from('match_live_state').select('*').eq('status', 'live'),
  ]);

  const matches = matchRows ?? [];
  const liveMap = new Map((liveRows ?? []).map((row) => [row.match_id, row]));
  const teamForMatch = (match: Row) => {
    const ts = state.teamSeasons.find((row) => row.id === match.team_season_id);
    return state.teams.find((row) => row.id === ts?.team_id);
  };

  const relevantMatches = matches.filter((match) => {
    const team = teamForMatch(match);
    return !!team && teams.some((allowed) => allowed.id === team.id);
  });
  const upcomingCount = relevantMatches.filter((match) =>
    liveMap.has(match.id) || new Date(match.starts_at).getTime() >= now.getTime()
  ).length;
  const liveCount = relevantMatches.filter((match) => liveMap.has(match.id)).length;
  for (const [id, value] of [
    ['admin-stat-teams', teams.length],
    ['admin-stat-upcoming', upcomingCount],
    ['admin-stat-live', liveCount],
  ] as const) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  const featured = relevantMatches.find((match) => liveMap.has(match.id))
    ?? relevantMatches.find((match) => new Date(match.starts_at).getTime() >= now.getTime())
    ?? null;

  if (featured) {
    const team = teamForMatch(featured);
    const live = liveMap.get(featured.id);
    const isLive = !!live;
    const when = formatDateTime(featured.starts_at);
    liveTarget.innerHTML = `
      <article class="dashboard-live-card ${isLive ? 'is-live' : ''}">
        <div>
          <span class="dashboard-live-badge">${isLive ? '● LIVE' : 'NÄCHSTES SPIEL'}</span>
          <h3>${escapeHtml(team?.name || 'Mannschaft')} · gegen ${escapeHtml(featured.opponent)}</h3>
          <p>${escapeHtml(when)} · ${featured.is_home ? 'Heimspiel' : 'Auswärtsspiel'}</p>
        </div>
        <button class="button button--hot dashboard-live-button" type="button" data-dashboard-match="${featured.id}">
          ${isLive ? 'Liveticker jetzt öffnen' : 'Liveticker vorbereiten'}
        </button>
      </article>`;
  } else {
    liveTarget.innerHTML = `
      <div class="dashboard-empty">
        <strong>Aktuell steht kein bevorstehendes Spiel an.</strong>
        <p class="muted">Sobald ein Spiel eingetragen ist, erscheint hier automatisch der direkte Liveticker-Einstieg.</p>
      </div>`;
  }

  target.innerHTML = teams.map((team) => {
    const ts = currentTeamSeason(team.id);
    const membership = ownMemberships().find((m) => m.team_id === team.id);
    const editable = canEditTeamId(team.id);
    const roleLabel = state.isSuper
      ? 'SuperAdmin'
      : membership?.role === 'ticker'
        ? 'Nur Liveticker'
        : membership?.role === 'manager'
          ? 'Manager'
          : 'Editor';

    const teamMatches = relevantMatches.filter((match) => teamForMatch(match)?.id === team.id);
    const next = teamMatches.find((match) => liveMap.has(match.id))
      ?? teamMatches.find((match) => new Date(match.starts_at).getTime() >= now.getTime())
      ?? null;
    const nextLive = next ? liveMap.get(next.id) : null;

    return `
      <article class="dashboard-team-card" data-dashboard-team-card data-has-next="${next ? 'true' : 'false'}" data-is-live="${nextLive ? 'true' : 'false'}">
        <div class="dashboard-team-card__head">
          <div>
            <p class="eyebrow">${escapeHtml(ts?.league || 'Mannschaft')}</p>
            <h3>${escapeHtml(team.name)}</h3>
            <p class="muted">${escapeHtml(ts?.group_name || '')}</p>
          </div>
          <span class="status-pill">${escapeHtml(roleLabel)}</span>
        </div>

        ${next ? `
          <div class="dashboard-next-match">
            <span>${nextLive ? '● LIVE' : 'Nächstes Spiel'}</span>
            <strong>gegen ${escapeHtml(next.opponent)}</strong>
            <small>${escapeHtml(formatDateTime(next.starts_at))} · ${next.is_home ? 'Heim' : 'Auswärts'}</small>
          </div>
        ` : '<p class="muted">Kein kommendes Spiel eingetragen.</p>'}

        <div class="dashboard-actions">
          ${next ? `<button class="button button--hot" type="button" data-dashboard-match="${next.id}">${nextLive ? 'Liveticker öffnen' : 'Zum Liveticker'}</button>` : '<button class="button secondary" type="button" data-dashboard-panel="matches">Spiele öffnen</button>'}
          ${editable ? `
            <button class="button secondary" type="button" data-dashboard-team="${team.id}" data-dashboard-panel="teams">Mannschaft pflegen</button>
            <button class="button ghost" type="button" data-dashboard-team="${team.id}" data-dashboard-panel="players">Kader</button>
            <button class="button ghost" type="button" data-dashboard-team="${team.id}" data-dashboard-panel="galleries">Bilder</button>
          ` : ''}
        </div>
      </article>`;
  }).join('');
  applyDashboardTeamFilters();

  const openMatch = async (matchId: string) => {
    showPanel('matches');
    // Dashboard shortcuts may point to games hidden by the current filter.
    if (!document.querySelector<HTMLElement>(`[data-match-card="${matchId}"]`)) {
      const filter = $<HTMLSelectElement>('#matches-admin-filter');
      if (filter && filter.value !== 'all') {
        filter.value = 'all';
        await refreshMatches();
      }
    }
    const gameSelect = $<HTMLSelectElement>('#matches-admin-game');
    if (gameSelect && gameSelect.value !== matchId) {
      if (!Array.from(gameSelect.options).some((option) => option.value === matchId)) {
        const filter = $<HTMLSelectElement>('#matches-admin-filter');
        if (filter) filter.value = 'all';
        await refreshMatches();
      }
      gameSelect.value = matchId;
      await refreshMatches();
    }
    window.setTimeout(() => {
      const card = document.querySelector<HTMLElement>(`[data-match-card="${matchId}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.classList.add('match-card--focus');
      window.setTimeout(() => card.classList.remove('match-card--focus'), 2200);
    }, 80);
  };

  document.querySelectorAll<HTMLButtonElement>('[data-dashboard-match]').forEach((button) => {
    button.addEventListener('click', () => {
      const matchId = button.dataset.dashboardMatch;
      if (matchId) openMatch(matchId);
    });
  });

  target.querySelectorAll<HTMLButtonElement>('[data-dashboard-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = button.dataset.dashboardPanel;
      const teamId = button.dataset.dashboardTeam;
      if (!panel) return;

      if (teamId && panel === 'teams') {
        const select = $<HTMLSelectElement>('#team-select');
        const ts = currentTeamSeason(teamId);
        const season = state.seasons.find((row) => row.id === ts?.season_id);
        if (season?.code) teamSeasonFilterCode = season.code;
        if (select && ts) renderAdminTeamSeasonFilter(ts.id);
      }

      if (teamId && panel === 'players') {
        const ts = currentTeamSeason(teamId);
        const season = state.seasons.find((row) => row.id === ts?.season_id);
        if (season?.code) rosterSeasonFilterCode = season.code;
        if (ts) renderAdminRosterSeasonFilter(ts.id);
        refreshPlayers();
      }

      if (teamId && panel === 'galleries') {
        const select = $<HTMLSelectElement>('#gallery-team');
        if (select) select.value = teamId;
        renderGalleryMatchOptions();
      }

      showPanel(panel);
    });
  });
}

function fillTeamForm() {
  const select = $<HTMLSelectElement>('#team-select');
  if (!select) return;
  const ts = state.teamSeasons.find((row) => row.id === select.value);
  const team = state.teams.find((t) => t.id === ts?.team_id);
  if (!team || !ts) return;
  const season = state.seasons.find((row) => row.id === ts.season_id);
  ($<HTMLInputElement>('#team-name')!).value = team.name ?? '';
  ($<HTMLInputElement>('#team-short-name')!).value = team.short_name ?? '';
  ($<HTMLTextAreaElement>('#team-description')!).value = team.description ?? '';
  ($<HTMLInputElement>('#team-league')!).value = ts?.league ?? '';
  ($<HTMLInputElement>('#team-group')!).value = ts?.group_name ?? '';
  ($<HTMLInputElement>('#team-btv-url')!).value = ts?.btv_url ?? '';
  const preview = $('#team-image-preview');
  if (preview) {
    const path = ts.team_image_path || team.image_path || defaultTeamImagePath(team);
    const isSeasonImage = !!ts.team_image_path;
    const isDefault = path === defaultTeamImagePath(team);
    preview.innerHTML = path
      ? `<img src="${escapeHtml(mediaUrl(path))}" alt="Mannschaftsbild ${escapeHtml(team.name)} ${escapeHtml(season?.name || '')}" /><div><strong>${isSeasonImage ? `Saisonbild · ${escapeHtml(season?.name || '')}` : isDefault ? 'Standardbild' : 'Saisonübergreifendes Bild'}</strong><p class="muted">${isSeasonImage ? 'Dieses Bild gilt ausschließlich für die ausgewählte Saison.' : 'Für diese Saison ist noch kein eigenes Bild hinterlegt.'}</p></div>`
      : '<p class="muted">Noch kein Mannschaftsbild vorhanden.</p>';
  }
}

async function saveTeam(event: Event) {
  event.preventDefault();
  const teamSeasonId = $<HTMLSelectElement>('#team-select')?.value;
  const ts = state.teamSeasons.find((row) => row.id === teamSeasonId);
  const teamId = ts?.team_id;
  if (!teamId || !ts) return;
  const oldImagePath = ts.team_image_path || null;
  const teamUpdate = {
    name: $<HTMLInputElement>('#team-name')?.value.trim(),
    short_name: $<HTMLInputElement>('#team-short-name')?.value.trim() || null,
    description: $<HTMLTextAreaElement>('#team-description')?.value.trim() || null,
  };
  const { error: teamError } = await supabase.from('teams').update(teamUpdate).eq('id', teamId);
  if (teamError) return status(teamError.message, 'error');

  const { error: seasonError } = await supabase.from('team_seasons').update({
    league: $<HTMLInputElement>('#team-league')?.value.trim() || null,
    group_name: $<HTMLInputElement>('#team-group')?.value.trim() || null,
    btv_url: $<HTMLInputElement>('#team-btv-url')?.value.trim() || null,
  }).eq('id', ts.id);
  if (seasonError) return status(seasonError.message, 'error');

  const file = $<HTMLInputElement>('#team-image')?.files?.[0];
  if (file) {
    const image = await optimizeImage(file);
    const path = `teams/${teamId}/seasons/${ts.id}/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(path, image, { upsert: false });
    if (uploadError) return status(uploadError.message, 'error');
    const { error: imageError } = await supabase.from('team_seasons').update({ team_image_path: path }).eq('id', ts.id);
    if (imageError) return status(imageError.message, 'error');

    if (oldImagePath && oldImagePath !== path && oldImagePath.startsWith(`teams/${teamId}/seasons/${ts.id}/`)) {
      await supabase.storage.from('media').remove([oldImagePath]);
    }
  }

  await loadCore();
  renderSelectors();
  const teamSelect = $<HTMLSelectElement>('#team-select');
  if (teamSelect) teamSelect.value = ts.id;
  fillTeamForm();
  await refreshDashboard();
  status('Mannschaft gespeichert.', 'success');
}

async function resetTeamImage() {
  const teamSeasonId = $<HTMLSelectElement>('#team-select')?.value;
  const ts = state.teamSeasons.find((row) => row.id === teamSeasonId);
  const team = state.teams.find((row) => row.id === ts?.team_id);
  if (!ts || !team) return;
  const currentPath = ts.team_image_path;
  const { error } = await supabase.from('team_seasons').update({ team_image_path: null }).eq('id', ts.id);
  if (error) return status(error.message, 'error');

  if (currentPath && currentPath.startsWith(`teams/${team.id}/seasons/${ts.id}/`)) {
    await supabase.storage.from('media').remove([currentPath]);
  }

  await loadCore();
  renderSelectors();
  const teamSelect = $<HTMLSelectElement>('#team-select');
  if (teamSelect) teamSelect.value = ts.id;
  fillTeamForm();
  status('Saisonbild entfernt. Das allgemeine Mannschaftsbild wird wieder verwendet.', 'success');
}

async function refreshPlayers() {
  const tsId = $<HTMLSelectElement>('#players-team-season')?.value;
  const target = $('#players-list');
  if (!tsId || !target) return;
  const context = $('#players-season-context');
  const selected = state.teamSeasons.find((row) => row.id === tsId);
  const season = state.seasons.find((row) => row.id === selected?.season_id);
  if (context) context.innerHTML = `<strong>Saison:</strong> ${escapeHtml(season?.name || 'nicht zugeordnet')}`;

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

// A roster is obtained by an authorized club editor from an official BTV nMM.
// Never collect ranks, birthdays, phone numbers or upload this text to GitHub.
let checkedRoster: { teamSeasonId: string; names: string[]; raw: string } | null = null;
function clearBulkRosterPreview() {
  checkedRoster = null;
  const submit = $<HTMLButtonElement>('#roster-bulk-submit');
  if (submit) submit.disabled = true;
  const preview = $('#roster-bulk-preview');
  if (preview) preview.textContent = 'Noch keine Namen geprüft.';
}
function checkBulkRoster() {
  clearBulkRosterPreview();
  const textarea = $<HTMLTextAreaElement>('#roster-bulk-names');
  const tsId = $<HTMLSelectElement>('#players-team-season')?.value || '';
  const ts = state.teamSeasons.find((row) => row.id === tsId);
  const preview = $('#roster-bulk-preview');
  if (!textarea || !preview || !ts || !canEditTeamId(ts.team_id))
    return status('Keine berechtigte Mannschaft/Saison ausgewählt.', 'error');
  const rows = textarea.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length || rows.length > 100) {
    preview.textContent = 'Bitte 1 bis 100 Namen eingeben.';
    return;
  }
  const unique = new Map<string,string>();
  for (const name of rows) {
    if (name.length < 3 || name.length > 90 || /[0-9@<>\t]/u.test(name) || /\s{3,}/u.test(name)) {
      preview.textContent = 'Ungültige Zeile erkannt. Nur vollständige Namen, keine Spielernummern, Ränge oder Kontaktdaten einfügen.';
      return;
    }
    const normalized = name.normalize('NFKC').replace(/\s+/g, ' ').trim();
    unique.set(normalized.toLocaleLowerCase('de-DE'), normalized);
  }
  const names = [...unique.values()];
  checkedRoster = { teamSeasonId: tsId, names, raw: textarea.value };
  preview.innerHTML = `<strong>${names.length} Namen geprüft.</strong> ${rows.length - names.length} doppelte Zeilen entfernt.<br><span>Vorschau: ${escapeHtml(names.slice(0, 8).join(' · '))}${names.length > 8 ? ' …' : ''}</span><br>Alle Einträge werden zunächst nichtöffentlich gespeichert.`;
  const submit = $<HTMLButtonElement>('#roster-bulk-submit');
  if (submit) submit.disabled = false;
}
async function importBulkRoster(event: Event) {
  event.preventDefault();
  const namesInput = $<HTMLTextAreaElement>('#roster-bulk-names');
  const verified = $<HTMLInputElement>('#roster-bulk-verified');
  const tsId = $<HTMLSelectElement>('#players-team-season')?.value;
  const ts = state.teamSeasons.find((row) => row.id === tsId);
  const submit = $<HTMLButtonElement>('#roster-bulk-submit');
  if (!ts || !canEditTeamId(ts.team_id) || !checkedRoster || checkedRoster.teamSeasonId !== ts.id
    || checkedRoster.raw !== namesInput?.value || !verified?.checked) {
    return status('Bitte die offiziellen Namen und die ausgewählte Mannschaft erneut prüfen.', 'error');
  }
  if (!window.confirm(`${checkedRoster.names.length} Namen in den internen Kader dieser Mannschaft/Saison übernehmen? Öffentliche Sichtbarkeit bleibt ausgeschaltet.`)) return;
  const names = [...checkedRoster.names];
  if (submit) submit.disabled = true;
  let inserted = 0, existing = 0;
  for (const name of names) {
    const { data, error } = await supabase.rpc('import_team_player_name', {
      p_team_season_id: ts.id,
      p_display_name: name,
    });
    if (error) {
      status(`Import nach ${inserted} neuen und ${existing} bereits vorhandenen Namen gestoppt: ${error.message}`, 'error');
      await refreshPlayers();
      clearBulkRosterPreview();
      return;
    }
    if (data === true) inserted++;
    else existing++;
  }
  namesInput!.value = '';
  verified.checked = false;
  clearBulkRosterPreview();
  await refreshPlayers();
  status(`BTV-Kaderimport abgeschlossen: ${inserted} intern angelegt, ${existing} bereits vorhanden. Keine öffentliche Freigabe erfolgt.`, 'success');
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

// Keep only unsaved browser edits in memory; never upload drafts to GitHub.
const pendingMatchDrafts = new Map<string, string>();
const matchDraftKey = (matchId: string, encounterId: string, field: string) => [matchId, encounterId, field].join(':');
const trackedMatchFields = ['data-enc-name1', 'data-enc-name2',
  'data-ticker-message', 'data-match-venue-name', 'data-match-venue-address'];
function clearMatchDraft(matchId: string, encounterId: string, field: string) {
  pendingMatchDrafts.delete(matchDraftKey(matchId, encounterId, field));
  const warning = document.querySelector<HTMLElement>(`[data-match-card="${matchId}"] [data-draft-warning]`);
  if (warning) warning.classList.toggle('hidden',
    ![...pendingMatchDrafts.keys()].some((key) => key.startsWith(matchId + ':')));
}
function trackMatchDrafts(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-match-card]').forEach((matchCard) => {
    const matchId = matchCard.dataset.matchCard!;
    const warning = matchCard.querySelector<HTMLElement>('[data-draft-warning]');
    const refreshWarning = () => {
      const hasDraft = [...pendingMatchDrafts.keys()].some((key) => key.startsWith(matchId + ':'));
      if (warning) warning.classList.toggle('hidden', !hasDraft);
    };
    matchCard.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(trackedMatchFields.map(
      (field) => `[${field}]`).join(',')).forEach((input) => {
      const field = trackedMatchFields.find((name) => input.hasAttribute(name))!;
      const encounterId = input.closest<HTMLElement>('[data-encounter-id]')?.dataset.encounterId || 'match';
      const key = matchDraftKey(matchId, encounterId, field);
      if (pendingMatchDrafts.has(key)) input.value = pendingMatchDrafts.get(key)!;
      input.addEventListener('input', () => {
        pendingMatchDrafts.set(key, input.value);
        refreshWarning();
      });
    });
    refreshWarning();
  });
}
window.addEventListener('beforeunload', (event) => {
  if (!pendingMatchDrafts.size) return;
  event.preventDefault();
});

// Zulässige Satzstände aus Sicht TSV : Gegner. Der dritte Satz ist ein Match-Tiebreak.
const regularSetScores = [
  '6:0', '0:6', '6:1', '1:6', '6:2', '2:6', '6:3', '3:6',
  '6:4', '4:6', '7:5', '5:7', '7:6', '6:7',
] as const;
const matchTieBreakScores = [
  '10:0', '0:10', '10:1', '1:10', '10:2', '2:10', '10:3', '3:10',
  '10:4', '4:10', '10:5', '5:10', '10:6', '6:10', '10:7', '7:10',
  '10:8', '8:10', '11:9', '9:11', '12:10', '10:12', '13:11', '11:13',
  '14:12', '12:14',
] as const;

function parseEncounterSetScores(resultText: string | null | undefined): string[] {
  // Freie Zwischenstände und Schnellwahl-Satzergebnisse werden einheitlich gelesen.
  return summarizeSetResult(resultText).scores;
}

function formatEncounterSetScores(scores: string[]) {
  return scores.filter(Boolean).join(' ') || null;
}

let openMobileEncounterId: string | null = null;
let focusedEncounterId: string | null = null;

async function refreshMatches() {
  const mobileLayout = window.matchMedia('(max-width: 760px)').matches;
  const ids = allowedTeamSeasons('tick').map((ts) => ts.id);
  const target = $('#matches-admin-list');
  if (!target) return;

  if (!ids.length) {
    target.innerHTML = '<p class="muted">Noch keine Mannschaft zugeordnet.</p>';
    return;
  }

  const { data } = await supabase
    .from('matches')
    .select('*')
    .in('team_season_id', ids)
    .order('starts_at', { ascending: false });

  state.matches = data ?? [];
  renderGalleryMatchOptions();

  const matchIds = state.matches.map((match) => match.id);
  const [{ data: liveStates }, { data: encounters }, { data: rosterLinks }] = await Promise.all([
    matchIds.length
      ? supabase.from('match_live_state').select('*').in('match_id', matchIds)
      : Promise.resolve({ data: [] }),
    matchIds.length
      ? supabase.from('match_encounters').select('*').in('match_id', matchIds).order('sort_order').order('position')
      : Promise.resolve({ data: [] }),
    supabase.from('team_players').select('*').in('team_season_id', ids).order('sort_order'),
  ]);

  const playerIds = [...new Set((rosterLinks ?? []).map((row) => row.player_id))];
  const { data: players } = playerIds.length
    ? await supabase.from('players').select('id,display_name,active').in('id', playerIds)
    : { data: [] as Row[] };

  const playerMap = new Map((players ?? []).map((player) => [player.id, player]));
  const liveMap = new Map((liveStates ?? []).map((row) => [row.match_id, row]));
  const encounterMap = new Map<string, Row[]>();

  (encounters ?? []).forEach((row) => {
    const list = encounterMap.get(row.match_id) ?? [];
    list.push(row);
    encounterMap.set(row.match_id, list);
  });

  const now = Date.now();
  state.matches.sort((a, b) => {
    const aLive = liveMap.get(a.id)?.status === 'live';
    const bLive = liveMap.get(b.id)?.status === 'live';
    if (aLive !== bLive) return aLive ? -1 : 1;

    const at = new Date(a.starts_at).getTime();
    const bt = new Date(b.starts_at).getTime();
    const aFuture = at >= now;
    const bFuture = bt >= now;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return aFuture ? at - bt : bt - at;
  });

  const playerOptions = (match: Row, selectedId?: string | null) => {
    const rows = (rosterLinks ?? [])
      .filter((link) => link.team_season_id === match.team_season_id)
      .map((link) => playerMap.get(link.player_id))
      .filter((player): player is Row => !!player && player.active !== false);

    return '<option value="">TSV-Spieler wählen</option>' + rows.map((player) =>
      `<option value="${player.id}" ${player.id === selectedId ? 'selected' : ''}>${escapeHtml(player.display_name)}</option>`
    ).join('');
  };

  const opponentOptions = (match: Row, selected?: number | null) => {
    const max = match.lineup_format === '4_2' ? 4 : 6;
    return '<option value="">Gegner wählen</option>' + Array.from({ length: max }, (_, index) => index + 1)
      .map((slot) => `<option value="${slot}" ${slot === Number(selected) ? 'selected' : ''}>Gegner ${slot}</option>`)
      .join('');
  };

  const renderTsvSide = (match: Row, encounter: Row) => `
    <div class="encounter-side encounter-side--tsv">
      <img src="${escapeHtml(mediaUrl('branding/tennis-logo.png'))}" alt="TSV Feldkirchen Tennis" />
      <div class="encounter-side__fields">
        <strong>TSV Feldkirchen</strong>
        <select data-enc-player1 aria-label="TSV-Spieler 1 aus Kader wählen">${playerOptions(match, encounter.tsv_player_1_id)}</select>
        <input data-enc-name1 type="text" maxlength="120" autocomplete="off" autocapitalize="words" enterkeyhint="done"
          aria-label="TSV-Spieler 1 – Name direkt eingeben"
          value="${escapeHtml(encounter.tsv_player_1_name || playerMap.get(encounter.tsv_player_1_id)?.display_name || '')}"
          placeholder="Oder Namen direkt eingeben" />
        ${encounter.discipline === 'doubles'
          ? `<select data-enc-player2 aria-label="TSV-Spieler 2 aus Kader wählen">${playerOptions(match, encounter.tsv_player_2_id)}</select>
             <input data-enc-name2 type="text" maxlength="120" autocomplete="off" autocapitalize="words" enterkeyhint="done"
               aria-label="TSV-Spieler 2 – Name direkt eingeben"
               value="${escapeHtml(encounter.tsv_player_2_name || playerMap.get(encounter.tsv_player_2_id)?.display_name || '')}"
               placeholder="Oder Namen direkt eingeben" />`
          : ''}
      </div>
    </div>`;

  const renderOpponentSide = (match: Row, encounter: Row) => {
    const first = encounter.opponent_slot_1 || (encounter.discipline === 'singles' ? encounter.position : null);
    return `
      <div class="encounter-side encounter-side--opponent">
        <span class="encounter-opponent-mark">G</span>
        <div class="encounter-side__fields">
          <strong>${escapeHtml(match.opponent)}</strong>
          ${encounter.discipline === 'singles'
            ? `<span class="encounter-opponent-label">Gegner ${first || encounter.position}</span>`
            : `<select data-enc-opponent1>${opponentOptions(match, first)}</select>
               <select data-enc-opponent2>${opponentOptions(match, encounter.opponent_slot_2)}</select>`}
        </div>
      </div>`;
  };

  const renderEncounter = (match: Row, encounter: Row) => {
    const tsvSide = renderTsvSide(match, encounter);
    const opponentSide = renderOpponentSide(match, encounter);
    const summary = summarizeSetResult(encounter.result_text);
    const orientedSets = homeAwaySetScore(summary, !!match.is_home);
    const statusLabel = encounter.status === 'live' ? 'LIVE' : encounter.status === 'finished' ? 'Beendet' : 'Geplant';

    const perMatchEncounters = encounterMap.get(match.id) ?? [];
    const focusedByDefault = perMatchEncounters.find((row) => row.status === 'live')
      ?? perMatchEncounters.find((row) => row.status === 'scheduled')
      ?? perMatchEncounters[0];
    const isOpen = focusedEncounterId
      ? focusedEncounterId === encounter.id
      : (openMobileEncounterId === encounter.id || focusedByDefault?.id === encounter.id);
    const playerLabel = [encounter.tsv_player_1_name, encounter.tsv_player_2_name].filter(Boolean).join(' / ');
    const setScores = parseEncounterSetScores(encounter.result_text);
    const firstSetCompleted = !!setScores[0] && validateSetScore(setScores[0], 0).complete;
    const afterTwoSets = summarizeSetResult(`${setScores[0]} ${setScores[1]}`);
    const thirdSetAllowed = afterTwoSets.tsvSets === 1 && afterTwoSets.opponentSets === 1;
    return `
      <details class="encounter-card ${encounter.status === 'live' ? 'is-live' : ''}" data-encounter-id="${encounter.id}" ${isOpen ? 'open' : ''}>
        <summary class="encounter-card__head">
          <span class="encounter-card__heading">
            <strong>${encounter.discipline === 'singles' ? 'Einzel' : 'Doppel'} ${encounter.position}</strong>
            <small>${escapeHtml(playerLabel || 'TSV-Spieler noch nicht eingetragen')}</small>
          </span>
          <span class="encounter-card__score ${encounter.status === 'finished' ? 'is-finished' : ''}">
            <small>${encounter.status === 'finished' ? 'Endstand' : 'Sätze'}</small>
            <strong>${summary.hasResult ? `${summary.tsvSets} : ${summary.opponentSets}` : '– : –'}</strong>
          </span>
          <span class="status-pill ${encounter.status === 'live' ? 'live' : ''}">${statusLabel}</span>
        </summary>
        <div class="encounter-card__body">
        <div class="encounter-result-row">
          <div class="encounter-set-editor" role="group" aria-label="Satz-Ergebnisse für ${encounter.discipline === 'singles' ? 'Einzel' : 'Doppel'} ${encounter.position}">
            <div class="encounter-set-editor__heading"><strong>Ergebnis</strong><span>TSV : Gegner</span></div>
            <div class="encounter-set-grid">
              ${['1. Satz', '2. Satz', '3. Satz'].map((label, index) => `
                <button class="encounter-set-button ${setScores[index] ? 'has-score' : ''}"
                  type="button" data-enc-set="${index}" aria-label="${label}${index === 2 ? ' Match-Tiebreak' : ''}: ${setScores[index] || 'noch kein Ergebnis'}"
                  ${(index === 1 && !firstSetCompleted) || (index === 2 && !thirdSetAllowed)
                    ? 'disabled title="Bitte zuerst den vorherigen Satz beenden"' : ''}>
                  <span>${label}</span><strong>${setScores[index] || '–'}</strong>
                  ${setScores[index] && !validateSetScore(setScores[index], index).complete
                    ? '<small>Zwischenstand</small>'
                    : index === 2 ? '<small>Match-Tiebreak</small>' : ''}
                </button>`).join('')}
            </div>
            <input type="hidden" data-enc-result value="${escapeHtml(encounter.result_text || '')}" />
            <p class="encounter-set-status" aria-live="polite">
              ${summary.hasResult
                ? `<strong>${encounter.status === 'finished' ? 'Endstand' : 'Zwischenstand'}: TSV ${summary.tsvSets} : ${summary.opponentSets} Gegner</strong>
                   <span>Heim ${orientedSets.homeSets} : ${orientedSets.awaySets} Gast</span>`
                : '<span>Noch kein Satz eingetragen.</span>'}
              ${summary.winner && encounter.status === 'finished'
                ? `<span class="encounter-set-status__winner">${summary.winner === 'tsv' ? 'TSV Feldkirchen' : escapeHtml(match.opponent)} gewinnt</span>`
                : encounter.status === 'scheduled' && summary.hasResult ? '<span>Mit „Live anzeigen“ den Zwischenstand veröffentlichen.</span>' : ''}
            </p>
            ${encounter.result_text && !setScores.some(Boolean) ? `<p class="encounter-set-legacy">Bisheriges Ergebnis: ${escapeHtml(encounter.result_text)}</p>` : ''}
          </div>
          <div class="encounter-actions">
            ${encounter.status === 'scheduled' ? '<button class="button button--hot" type="button" data-enc-live>Live anzeigen</button>' : ''}
            ${encounter.status === 'live' ? '<span class="encounter-live-notice">● Live – Zwischenstände werden angezeigt</span>' : ''}
            ${encounter.status === 'finished' ? '<span class="encounter-finished-notice">✓ Sieger automatisch ermittelt</span>' : ''}
            ${encounter.status !== 'scheduled' || encounter.winner || encounter.result_text ? '<button class="button ghost" type="button" data-enc-reset>Zurücksetzen</button>' : ''}
          </div>
        </div>
        <details class="encounter-lineup" ${!playerLabel ? 'open' : ''}>
          <summary>Aufstellung &amp; Gegner bearbeiten</summary>
          <p class="muted">TSV-Spieler aus dem Kader auswählen oder den Namen direkt eintragen.</p>
          <div class="encounter-sides">
            ${match.is_home ? tsvSide : opponentSide}
            <span class="encounter-vs">VS</span>
            ${match.is_home ? opponentSide : tsvSide}
          </div>
        </details>
        <p data-enc-feedback class="encounter-feedback" role="status" aria-live="polite"></p>
        </div>
      </details>`;
  };

  const filter = $<HTMLSelectElement>('#matches-admin-filter')?.value || 'focus';
  const visibleMatches = state.matches.filter((match) => {
    const matchStatus = liveMap.get(match.id)?.status || 'scheduled';
    if (filter === 'all') return true;
    if (filter === 'finished') return matchStatus === 'finished';
    // Include recent games so a delayed ticker update is still easy to find.
    return matchStatus === 'live' || (matchStatus !== 'finished' && new Date(match.starts_at).getTime() >= now - 7 * 86400000);
  });
  const gameSelect = $<HTMLSelectElement>('#matches-admin-game');
  const priorChoice = gameSelect?.dataset.initialized === 'true'
    ? gameSelect.value : mobileLayout ? 'auto' : 'all';
  if (gameSelect) {
    gameSelect.innerHTML = '<option value="auto">Laufendes oder nächstes Spiel</option>' +
      '<option value="all">Alle angezeigten Spiele</option>' + visibleMatches.map((match) => {
        const ts = state.teamSeasons.find((row) => row.id === match.team_season_id);
        const team = state.teams.find((row) => row.id === ts?.team_id);
        return `<option value="${match.id}">${escapeHtml(team?.name || 'TSV')} · ${escapeHtml(match.opponent)} · ${escapeHtml(formatDateTime(match.starts_at))}</option>`;
      }).join('');
    gameSelect.value = priorChoice && [...gameSelect.options].some((option) => option.value === priorChoice)
      ? priorChoice : 'auto';
    gameSelect.dataset.initialized = 'true';
  }
  const selectedGame = gameSelect?.value || 'all';
  const autoMatch = visibleMatches.find((match) => liveMap.get(match.id)?.status === 'live')
    ?? visibleMatches.find((match) => new Date(match.starts_at).getTime() >= now)
    ?? visibleMatches[0];
  const displayMatches = selectedGame === 'all' ? visibleMatches
    : selectedGame === 'auto' ? (autoMatch ? [autoMatch] : [])
    : visibleMatches.filter((match) => match.id === selectedGame);
  const summary = $('#matches-filter-summary');
  if (summary) summary.textContent = `${displayMatches.length} von ${visibleMatches.length} passenden Spielen geöffnet. Über „Spieltag auswählen“ kannst du wechseln.`;

  target.innerHTML = displayMatches.map((match) => {
    const ts = state.teamSeasons.find((row) => row.id === match.team_season_id);
    const team = state.teams.find((row) => row.id === ts?.team_id);
    const live: any = liveMap.get(match.id) || { status: 'scheduled', home_score: 0, away_score: 0 };
    const rows = encounterMap.get(match.id) ?? [];
    const singles = rows.filter((row) => row.discipline === 'singles');
    const doubles = rows.filter((row) => row.discipline === 'doubles');
    const clubScore = match.is_home ? live.home_score : live.away_score;
    const opponentScore = match.is_home ? live.away_score : live.home_score;
    const format = match.lineup_format === '4_2' ? '4_2' : '6_3';
    const expected = format === '4_2' ? 6 : 9;
    const finished = rows.filter((row) => row.status === 'finished').length;
    const active = rows.filter((row) => row.status === 'live').length;
    const pct = Math.round((finished / expected) * 100);
    const nextNumber = Math.max(0, expected - finished - active);

    return `<article class="card flat match-admin-card" data-match-card="${match.id}">
      <p class="match-draft-warning hidden" data-draft-warning role="status">Noch nicht gespeicherte Eingaben vorhanden – bitte Eingabefeld verlassen, bevor du die Seite schließt.</p>
      <div class="page-head">
        <div>
          <p class="eyebrow">${escapeHtml(team?.name || '')}</p>
          <h3>${escapeHtml(match.opponent)}</h3>
          <p class="muted">${escapeHtml(formatDateTime(match.starts_at))} · ${match.is_home ? 'Heimspiel' : 'Auswärtsspiel'} · ${format === '4_2' ? '4 Einzel + 2 Doppel' : '6 Einzel + 3 Doppel'}</p>
          <p class="muted"><strong>Spielort:</strong> ${escapeHtml(match.venue_name || 'Noch nicht eingetragen')}${match.venue_address ? ' · '+escapeHtml(match.venue_address) : ''}</p>
        </div>
        <div class="match-admin-score">
          <span class="status-pill ${live.status === 'live' ? 'live' : ''}">${live.status === 'live' ? 'LIVE' : live.status === 'finished' ? 'Beendet' : 'Geplant'}</span>
          <strong>TSV ${clubScore} : ${opponentScore}</strong>
        </div>
      </div>

      <details class="match-admin-venue">
        <summary>Tatsächlichen Spielort / Halle bearbeiten</summary>
        <p class="muted">Heimspiel bleibt Heimspiel – auch bei Hallenspielen außerhalb Feldkirchens.</p>
        <div class="match-admin-venue__fields">
          <label>Halle / Anlage
            <input type="text" maxlength="200" data-match-venue-name value="${escapeHtml(match.venue_name || '')}" placeholder="Halle oder Anlage" />
          </label>
          <label>Straße / PLZ / Ort
            <input type="text" maxlength="260" data-match-venue-address value="${escapeHtml(match.venue_address || '')}" placeholder="Bestätigte Adresse" />
          </label>
        </div>
        <p class="muted">Bei unklarer Adresse das Feld leer lassen. Der Routenbutton kann dann nur nach dem Hallennamen suchen.</p>
        <button type="button" class="button secondary" data-save-match-venue>Spielort speichern</button>
      </details>
      <div class="phase8-encounter-summary" role="status">
        <div class="match-admin-progress-head">
          <strong>${finished} / ${expected} abgeschlossen</strong>
          <span>${active ? `${active} LIVE · ` : ''}${nextNumber} noch offen</span>
        </div>
        <div class="phase8-progress" aria-label="${finished} von ${expected} Begegnungen abgeschlossen"><span style="width:${pct}%"></span></div>
        <p>Satzergebnisse antippen – der Zwischenstand und der Sieger werden automatisch berechnet.</p>
      </div>
      <div class="match-admin-toolbar">
        <div class="match-admin-toolbar__primary">
          <button class="button button--hot" data-live-action="start" type="button" ${live.status === 'live' ? 'disabled' : ''}>${live.status === 'live' ? 'Spieltag ist live' : 'Spieltag live starten'}</button>
          <a class="button secondary" href="/live/?match=${match.id}" target="_blank" rel="noopener noreferrer">Live-Seite ansehen ↗</a>
        </div>
        <details class="match-admin-more">
          <summary>Weitere Spieltag-Aktionen</summary>
          <div class="actions match-admin-main-actions">
            <button class="button ghost" data-live-action="finish" type="button" ${live.status === 'finished' ? 'disabled' : ''}>Spieltag beenden</button>
            ${live.status === 'live' ? '<button class="button danger" data-live-action="reset" type="button">Versehentlichen Start zurücksetzen</button>' : ''}
          </div>
        </details>
      </div>

      ${rows.length ? `
        <section class="encounter-editor">
          <div class="encounter-editor__title">
            <div><p class="eyebrow">Begegnungen</p><h4>Einzel & Doppel</h4></div>
            <details>
              <summary>Format ändern</summary>
              <div class="encounter-format-controls">
                <select data-match-format>
                  <option value="6_3" ${format === '6_3' ? 'selected' : ''}>6 Einzel + 3 Doppel</option>
                  <option value="4_2" ${format === '4_2' ? 'selected' : ''}>4 Einzel + 2 Doppel</option>
                </select>
                <button class="button ghost" type="button" data-configure-match>Neu aufbauen</button>
              </div>
            </details>
          </div>
          <div class="encounter-section"><h4>Einzel</h4>${singles.map((row) => renderEncounter(match, row)).join('')}</div>
          <div class="encounter-section"><h4>Doppel</h4>${doubles.map((row) => renderEncounter(match, row)).join('')}</div>
        </section>
      ` : `
        <div class="encounter-setup">
          <div><strong>Begegnungen vorbereiten</strong><p class="muted">Lege mit einem Klick alle Einzel und Doppel für diesen Spieltag an.</p></div>
          <select data-match-format>
            <option value="6_3" ${format === '6_3' ? 'selected' : ''}>6 Einzel + 3 Doppel</option>
            <option value="4_2" ${format === '4_2' ? 'selected' : ''}>4 Einzel + 2 Doppel</option>
          </select>
          <button class="button button--hot" type="button" data-configure-match>Begegnungen anlegen</button>
        </div>
      `}

      <details class="match-ticker-message match-ticker-message--details">
        <summary>Tickermeldung veröffentlichen <small>Optional: Infos vom Spieltag</small></summary>
        <div class="match-ticker-message__content">
          <label for="ticker-message-${match.id}">Meldungstext</label>
          <textarea id="ticker-message-${match.id}" data-ticker-message placeholder="z. B. Nach den Einzeln steht es 4:2 für den TSV."></textarea>
          <button class="button" data-publish-ticker type="button">Meldung veröffentlichen</button>
          <p data-ticker-feedback class="encounter-feedback" role="status" aria-live="polite"></p>
        </div>
      </details>
    </article>`;
  }).join('') || '<p class="muted">In dieser Auswahl sind keine Spiele vorhanden. Wähle bei Bedarf „Alle Spiele“.</p>';
  trackMatchDrafts(target);

  const updateEncounter = async (encounterId: string, patch: Row) => {
    const { error } = await supabase
      .from('match_encounters')
      .update({ ...patch, updated_by: state.user.id, updated_at: new Date().toISOString() })
      .eq('id', encounterId);
    if (error) {
      status(error.message, 'error');
      const feedback = target.querySelector<HTMLElement>(`[data-encounter-id="${encounterId}"] [data-enc-feedback]`);
      if (feedback) {
        feedback.textContent = 'Speichern fehlgeschlagen: ' + error.message;
        feedback.dataset.tone = 'error';
      }
    }
    return !error;
  };

  const refreshChangedEncounter = async (encounterId: string, message: string) => {
    openMobileEncounterId = encounterId;
    focusedEncounterId = encounterId;
    await refreshMatches();
    const details = target.querySelector<HTMLDetailsElement>(`[data-encounter-id="${encounterId}"]`);
    if (details) {
      if (mobileLayout) {
        details.open = true;
        details.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }
      const feedback = details.querySelector<HTMLElement>('[data-enc-feedback]');
      if (feedback) {
        feedback.textContent = message;
        feedback.dataset.tone = 'success';
      }
    }
    status(message, 'success');
  };

  target.querySelectorAll<HTMLElement>('[data-match-card]').forEach((card) => {
    const matchId = card.dataset.matchCard!;
    const match = state.matches.find((row) => row.id === matchId);
    const live: any = liveMap.get(matchId) || { match_id: matchId, status: 'scheduled', home_score: 0, away_score: 0 };

    card.querySelector<HTMLButtonElement>('[data-save-match-venue]')?.addEventListener('click', async () => {
      if (!match) return;
      const venueName = card.querySelector<HTMLInputElement>('[data-match-venue-name]')?.value.trim() || '';
      const venueAddress = card.querySelector<HTMLInputElement>('[data-match-venue-address]')?.value.trim() || '';
      if (!venueName && venueAddress) return status('Bitte auch den Namen der Halle oder Anlage eintragen.', 'error');
      const { error } = await supabase.from('matches')
        .update({ venue_name: venueName || null, venue_address: venueAddress || null })
        .eq('id', matchId).eq('team_season_id', match.team_season_id);
      if (error) return status('Spielort konnte nicht gespeichert werden: ' + error.message, 'error');
      clearMatchDraft(matchId, 'match', 'data-match-venue-name');
      clearMatchDraft(matchId, 'match', 'data-match-venue-address');
      status('Der tatsächliche Spielort wurde gespeichert. Heim- oder Auswärtsspiel bleibt unverändert.', 'success');
      refreshMatches();
    });

    card.querySelector<HTMLButtonElement>('[data-configure-match]')?.addEventListener('click', async () => {
      const selected = card.querySelector<HTMLSelectElement>('[data-match-format]')?.value || '6_3';
      const existing = encounterMap.get(matchId) ?? [];
      if (existing.length && !confirm('Das Begegnungsformat neu aufbauen? Die bisherige Aufstellung und Ergebnisse dieses Spiels werden dabei zurückgesetzt.')) return;
      const { error } = await supabase.rpc('configure_match_encounters', {
        target_match: matchId,
        target_format: selected,
      });
      if (error) return status(error.message, 'error');
      status(selected === '4_2' ? '4 Einzel und 2 Doppel angelegt.' : '6 Einzel und 3 Doppel angelegt.', 'success');
      refreshMatches();
    });

    card.querySelectorAll<HTMLButtonElement>('[data-live-action]').forEach((button) => button.addEventListener('click', async () => {
      const action = button.dataset.liveAction;
      if (button.disabled) return;
      if (action === 'finish' && !window.confirm('Den ganzen Spieltag wirklich beenden?')) return;
      if (action === 'reset' && !window.confirm('Den Liveticker wirklich auf „Geplant“ zurücksetzen? Aufstellungen und gespeicherte Ergebnisse bleiben erhalten.')) return;
      button.disabled = true;
      const patch = action === 'start'
        ? { status: 'live', started_at: live.started_at || new Date().toISOString(), finished_at: null, updated_by: state.user.id }
        : action === 'reset'
          ? { status: 'scheduled', started_at: null, finished_at: null, updated_by: state.user.id }
          : { status: 'finished', finished_at: new Date().toISOString(), updated_by: state.user.id };
      const { error } = await supabase.from('match_live_state').update(patch).eq('match_id', matchId);
      if (error) {
        status(error.message, 'error');
        button.disabled = false;
      } else {
        status(action === 'start' ? 'Spieltag ist jetzt live.' : action === 'reset' ? 'Liveticker wurde auf „Geplant“ zurückgesetzt.' : 'Spieltag beendet.', 'success');
        await refreshMatches();
      }
    }));

    card.querySelectorAll<HTMLElement>('[data-encounter-id]').forEach((encounterCard) => {
      const encounterId = encounterCard.dataset.encounterId!;
      const encounter = (encounterMap.get(matchId) ?? []).find((row) => row.id === encounterId);
      if (!encounter || !match) return;

      if (encounterCard instanceof HTMLDetailsElement) {
        encounterCard.addEventListener('toggle', () => {
          if (!encounterCard.isConnected) return;
          if (encounterCard.open) {
            focusedEncounterId = encounterId;
            openMobileEncounterId = encounterId;
            if (mobileLayout) {
              card.querySelectorAll<HTMLDetailsElement>('details.encounter-card').forEach((other) => {
                if (other !== encounterCard) other.open = false;
              });
            }
          }
        });
      }
      const localFeedback = (message: string, tone: 'success' | 'error' = 'success') => {
        const feedback = encounterCard.querySelector<HTMLElement>('[data-enc-feedback]');
        if (feedback) {
          feedback.textContent = message;
          feedback.dataset.tone = tone;
        }
        status(message, tone);
      };

      const ensureMatchLive = async () => {
        if (live.status === 'live') return true;
        const { error } = await supabase.from('match_live_state').update({
          status: 'live',
          started_at: live.started_at || new Date().toISOString(),
          finished_at: null,
          updated_by: state.user.id,
        }).eq('match_id', matchId);
        if (error) {
          status(error.message, 'error');
          return false;
        }
        return true;
      };

      encounterCard.querySelector<HTMLSelectElement>('[data-enc-player1]')?.addEventListener('change', async (event) => {
        const select = event.currentTarget as HTMLSelectElement;
        const player = playerMap.get(select.value);
        if (await updateEncounter(encounterId, {
          tsv_player_1_id: select.value || null,
          tsv_player_1_name: player?.display_name || null,
        })) {
          const nameInput = encounterCard.querySelector<HTMLInputElement>('[data-enc-name1]');
          if (nameInput) nameInput.value = player?.display_name || '';
          clearMatchDraft(matchId, encounterId, 'data-enc-name1');
          localFeedback('Aufstellung gespeichert.');
        }
      });

      encounterCard.querySelector<HTMLSelectElement>('[data-enc-player2]')?.addEventListener('change', async (event) => {
        const select = event.currentTarget as HTMLSelectElement;
        const player = playerMap.get(select.value);
        if (await updateEncounter(encounterId, {
          tsv_player_2_id: select.value || null,
          tsv_player_2_name: player?.display_name || null,
        })) {
          const nameInput = encounterCard.querySelector<HTMLInputElement>('[data-enc-name2]');
          if (nameInput) nameInput.value = player?.display_name || '';
          clearMatchDraft(matchId, encounterId, 'data-enc-name2');
          localFeedback('Aufstellung gespeichert.');
        }
      });

      // A roster is not required to start a match day. Direct names are stored
      // in the encounter itself and deliberately clear any old player reference.
      for (const position of [1, 2] as const) {
        encounterCard.querySelector<HTMLInputElement>(`[data-enc-name${position}]`)?.addEventListener('change', async (event) => {
          const input = event.currentTarget as HTMLInputElement;
          const name = input.value.trim();
          if (name.length === 1) return status('Bitte einen vollständigen Spielernamen eintragen.', 'error');
          const patch = position === 1
            ? { tsv_player_1_id: null, tsv_player_1_name: name || null }
            : { tsv_player_2_id: null, tsv_player_2_name: name || null };
          if (await updateEncounter(encounterId, patch)) {
            const select = encounterCard.querySelector<HTMLSelectElement>(`[data-enc-player${position}]`);
            if (select) select.value = '';
            clearMatchDraft(matchId, encounterId, `data-enc-name${position}`);
            localFeedback(name ? 'TSV-Spieler gespeichert.' : 'Spielername entfernt.');
          }
        });
      }

      encounterCard.querySelector<HTMLSelectElement>('[data-enc-opponent1]')?.addEventListener('change', async (event) => {
        const value = Number((event.currentTarget as HTMLSelectElement).value) || null;
        if (await updateEncounter(encounterId, { opponent_slot_1: value })) localFeedback('Gegner gespeichert.');
      });

      encounterCard.querySelector<HTMLSelectElement>('[data-enc-opponent2]')?.addEventListener('change', async (event) => {
        const value = Number((event.currentTarget as HTMLSelectElement).value) || null;
        if (await updateEncounter(encounterId, { opponent_slot_2: value })) localFeedback('Gegner gespeichert.');
      });

      encounterCard.querySelectorAll<HTMLButtonElement>('[data-enc-set]').forEach((setButton) => {
        setButton.addEventListener('click', () => {
          const setIndex = Number(setButton.dataset.encSet);
          const dialog = $<HTMLDialogElement>('#encounter-set-dialog');
          const title = $('#encounter-set-dialog-title');
          const subtitle = $('#encounter-set-dialog-subtitle');
          const options = $('#encounter-set-dialog-options');
          const feedback = $('#encounter-set-dialog-feedback');
          const manualDetails = $<HTMLDetailsElement>('#encounter-set-dialog-manual');
          const manualForm = $<HTMLFormElement>('#encounter-set-dialog-manual-form');
          const manualTsv = $<HTMLInputElement>('#encounter-set-manual-tsv');
          const manualOpponent = $<HTMLInputElement>('#encounter-set-manual-opponent');
          const manualHint = $('#encounter-set-dialog-manual-hint');
          const manualError = $('#encounter-set-dialog-manual-error');
          if (!dialog || !title || !subtitle || !options || !feedback || !manualDetails || !manualForm
            || !manualTsv || !manualOpponent || !manualHint || !manualError || !Number.isInteger(setIndex)) return;
          if (dialog.open) dialog.close();

          const initial = parseEncounterSetScores(encounterCard.querySelector<HTMLInputElement>('[data-enc-result]')?.value);
          const oldValue = initial[setIndex] || '';
          const scores = setIndex === 2 ? matchTieBreakScores : regularSetScores;
          title.textContent = setIndex === 2 ? '3. Satz · Match-Tiebreak' : `${setIndex + 1}. Satz auswählen`;
          subtitle.textContent = `${encounter.discipline === 'singles' ? 'Einzel' : 'Doppel'} ${encounter.position} · Ergebnis aus Sicht TSV : Gegner`;
          feedback.textContent = '';
          feedback.classList.add('hidden');
          manualError.textContent = '';
          manualError.classList.add('hidden');
          manualDetails.open = !!oldValue && !scores.some((score) => score === oldValue);
          const [initialTsv, initialOpponent] = oldValue ? oldValue.split(':') : ['', ''];
          const maxScore = setIndex === 2 ? 99 : 7;
          manualTsv.max = String(maxScore);
          manualOpponent.max = String(maxScore);
          manualTsv.value = initialTsv || '';
          manualOpponent.value = initialOpponent || '';
          manualHint.textContent = setIndex === 2
            ? 'Match-Tiebreak: bis 10 Punkte mit 2 Punkten Vorsprung, bei Bedarf länger.'
            : 'Satz: z. B. 3:2 oder 5:5; bei 6 gewonnenen Spielen entscheidet der gültige Endstand.';
          options.innerHTML = scores.map((score) => `
            <button type="button" class="encounter-set-option ${score === oldValue ? 'selected' : ''}"
              data-set-score-choice="${score}" aria-pressed="${score === oldValue}">${score}</button>
          `).join('');

          const commitSetScore = async (score: string) => {
            const next = [...initial];
            if (score === oldValue) {
              dialog.close();
              return;
            }
            if (!score && next.slice(setIndex + 1).some(Boolean)
              && !window.confirm('Wenn du diesen Satz löschst, werden auch die folgenden Sätze entfernt. Fortfahren?')) return;
            next[setIndex] = score;
            if (!score) next.splice(setIndex + 1, 2 - setIndex, ...Array(2 - setIndex).fill(''));
            const normalized = summarizeSetResult(formatEncounterSetScores(next));
            if (score && normalized.scores[setIndex] !== score) {
              manualError.textContent = 'Ungültiges Satzergebnis. Bitte den Stand prüfen.';
              manualError.classList.remove('hidden');
              manualDetails.open = true;
              return;
            }
            if (next.slice(setIndex + 1).some((value, offset) => value && value !== normalized.scores[setIndex + 1 + offset])
              && !window.confirm('Dieser Satz ist noch nicht beendet. Bereits eingetragene Folgesätze werden entfernt. Fortfahren?')) return;
            const resultText = formatEncounterSetScores(normalized.scores);
            const buttons = dialog.querySelectorAll<HTMLButtonElement>('button');
            buttons.forEach((button) => { button.disabled = true; });
            feedback.classList.remove('hidden');
            feedback.textContent = 'Ergebnis wird gespeichert …';
            try {
              if ((normalized.complete || encounter.status === 'finished') && !(await ensureMatchLive())) {
                feedback.textContent = 'Der Spieltag konnte nicht live geschaltet werden.';
                return;
              }
              const now = new Date().toISOString();
              const patch = {
                result_text: resultText,
                status: normalized.complete ? 'finished' : encounter.status === 'finished' ? 'live' : encounter.status,
                winner: normalized.winner,
                finished_at: normalized.complete ? now : null,
                ...(normalized.complete ? { started_at: encounter.started_at || now } : {}),
              };
              if (await updateEncounter(encounterId, patch)) {
                const hidden = encounterCard.querySelector<HTMLInputElement>('[data-enc-result]');
                if (hidden) hidden.value = resultText || '';
                dialog.close();
                await refreshChangedEncounter(encounterId, normalized.complete
                  ? `Endstand ${normalized.tsvSets}:${normalized.opponentSets} – ${normalized.winner === 'tsv' ? 'TSV Feldkirchen' : 'Gegner'} gewinnt.`
                  : 'Zwischenstand gespeichert.');
                target.querySelector<HTMLButtonElement>(
                  `[data-encounter-id="${encounterId}"] [data-enc-set="${setIndex}"]`
                )?.focus({ preventScroll: true });
              } else {
                feedback.textContent = 'Speichern fehlgeschlagen. Bitte erneut versuchen.';
              }
            } finally {
              if (dialog.open) buttons.forEach((button) => { button.disabled = false; });
            }
          };

          manualForm.onsubmit = (event) => {
            event.preventDefault();
            if (dialog.querySelector<HTMLButtonElement>('[data-set-score-choice]:disabled')) return;
            const tsvText = manualTsv.value.trim();
            const opponentText = manualOpponent.value.trim();
            if (!/^\d{1,2}$/.test(tsvText) || !/^\d{1,2}$/.test(opponentText)) {
              manualError.textContent = 'Bitte für TSV und Gegner jeweils eine ganze Zahl von 0 bis ' + maxScore + ' eingeben.';
              manualError.classList.remove('hidden');
              return;
            }
            const enteredScore = `${Number(tsvText)}:${Number(opponentText)}`;
            const validation = validateSetScore(enteredScore, setIndex);
            if (!validation.valid) {
              manualError.textContent = validation.message;
              manualError.classList.remove('hidden');
              return;
            }
            manualError.textContent = '';
            manualError.classList.add('hidden');
            void commitSetScore(enteredScore);
          };
          dialog.onclick = (event) => {
            if (!(event.target instanceof Element)) return;
            if (event.target.closest('[data-set-score-close]')) {
              dialog.close();
              return;
            }
            if (event.target.closest('[data-set-score-clear]')) {
              void commitSetScore('');
              return;
            }
            const choice = event.target.closest<HTMLButtonElement>('[data-set-score-choice]');
            if (choice && !choice.disabled) void commitSetScore(choice.dataset.setScoreChoice || '');
          };
          dialog.oncancel = (event) => {
            if (dialog.querySelector<HTMLButtonElement>('[data-set-score-choice]:disabled')) event.preventDefault();
          };
          dialog.showModal();
          if (manualDetails.open) manualTsv.focus();
          else (dialog.querySelector<HTMLButtonElement>('[data-set-score-choice].selected')
            || dialog.querySelector<HTMLButtonElement>('[data-set-score-choice]'))?.focus();
        });
      });

      const liveButton = encounterCard.querySelector<HTMLButtonElement>('[data-enc-live]');
      liveButton?.addEventListener('click', async () => {
        if (liveButton.disabled) return;
        liveButton.disabled = true;
        try {
          if (!(await ensureMatchLive())) return;
          if (await updateEncounter(encounterId, {
            status: 'live',
            started_at: encounter.started_at || new Date().toISOString(),
            finished_at: null,
            winner: null,
          })) {
            await refreshChangedEncounter(encounterId,
              'Begegnung ist jetzt live. Eingegebene Satzstände sind öffentlich sichtbar.');
          }
        } finally {
          if (liveButton.isConnected) liveButton.disabled = false;
        }
      });

      encounterCard.querySelector<HTMLButtonElement>('[data-enc-reset]')?.addEventListener('click', async () => {
        if (!confirm('Diese einzelne Begegnung zurücksetzen?')) return;
        if (await updateEncounter(encounterId, {
          status: 'scheduled',
          winner: null,
          result_text: null,
          started_at: null,
          finished_at: null,
        })) {
          await refreshChangedEncounter(encounterId, 'Begegnung zurückgesetzt.');
        }
      });
    });

    const publishButton = card.querySelector<HTMLButtonElement>('[data-publish-ticker]');
    publishButton?.addEventListener('click', async () => {
      if (publishButton.disabled) return;
      const area = card.querySelector<HTMLTextAreaElement>('[data-ticker-message]');
      const message = area?.value.trim();
      if (!message) return status('Bitte zuerst eine Tickermeldung eingeben.', 'error');
      publishButton.disabled = true;
      publishButton.textContent = 'Wird veröffentlicht …';
      try {
        const { data: current, error: stateError } = await supabase.from('match_live_state')
          .select('home_score,away_score').eq('match_id', matchId).single();
        if (stateError) return status('Spielstand nicht abrufbar: ' + stateError.message, 'error');
        const { error } = await supabase.from('live_ticker_entries').insert({
          match_id: matchId,
          author_id: state.user.id,
          message,
          entry_type: 'update',
          home_score: current?.home_score ?? null,
          away_score: current?.away_score ?? null,
        });
        if (error) status(error.message, 'error');
        else {
          if (area) area.value = '';
          clearMatchDraft(matchId, 'match', 'data-ticker-message');
          status('Tickermeldung veröffentlicht.', 'success');
          const feedback = card.querySelector<HTMLElement>('[data-ticker-feedback]');
          if (feedback) feedback.textContent = 'Tickermeldung veröffentlicht.';
        }
      } finally {
        publishButton.disabled = false;
        publishButton.textContent = 'Meldung veröffentlichen';
      }
    });
  });

  renderNewsReferenceOptions();
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
    venue_name: $<HTMLInputElement>('#match-venue-name')?.value.trim() || null,
    venue_address: $<HTMLInputElement>('#match-venue-address')?.value.trim() || null,
    lineup_format: $<HTMLSelectElement>('#match-lineup-format')?.value || '6_3',
    external_url: $<HTMLInputElement>('#match-url')?.value.trim() || null,
    is_published: true,
  });
  if (error) return status(error.message, 'error');
  ($<HTMLFormElement>('#match-form'))?.reset();
  ($<HTMLInputElement>('#match-home'))!.checked = true;
  status('Spiel angelegt.', 'success');
  refreshMatches();
}

const editorialInput = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
async function refreshNews(){
 const target=document.getElementById('news-admin-list');if(!target)return;
 const ids=allowedTeamIds('edit');
 if(!state.isSuper&&!ids.length){target.textContent='Keine Redaktionsberechtigung.';return;}
 let query=supabase.from('news').select('*').order('created_at',{ascending:false});
 if(!state.isSuper)query=query.in('team_id',ids);
 const {data,error}=await query;
 if(error){target.textContent='Beiträge derzeit nicht abrufbar.';status(error.message,'error');return;}
 const rows=data??[];
 const eventResult=rows.length?await supabase.from('events').select('*').in('external_url',rows.map(row=>`news:${row.id}`)):{data:[],error:null};
 const eventMap=new Map((eventResult.data??[]).map(row=>[String(row.external_url).replace('news:',''),row]));
 const local=(stamp: string | null)=>{if(!stamp)return'';const d=new Date(stamp);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
 target.innerHTML=rows.length?`<div class="admin-edit-list">${rows.map(row=>{const appointment=eventMap.get(row.id);return `<div class="admin-edit-item" data-news-id="${row.id}"><div><strong>${escapeHtml(row.title)}</strong><p class="muted">${escapeHtml(row.status)} · ${escapeHtml(state.teams.find(t=>t.id===row.team_id)?.name||'Verein')}${appointment?` · Termin: ${escapeHtml(formatDateTime(appointment.starts_at))}`:''}</p></div><div class="actions"><button type="button" class="button ghost" data-edit-news>Bearbeiten</button><button type="button" class="button danger" data-delete-news>Löschen</button></div></div>`}).join('')}</div>`:'<p class="muted">Noch keine Beiträge vorhanden.</p>';
 target.querySelectorAll('[data-edit-news]').forEach(button=>button.addEventListener('click',()=>{
   const item=rows.find(row=>row.id===button.closest('[data-news-id]')?.getAttribute('data-news-id'));if(!item)return;
   editorialInput('news-edit-id').value=item.id;
   editorialInput('news-title').value=item.title||'';
   editorialInput('news-excerpt').value=item.excerpt||'';
   editorialInput('news-body').value=item.body||'';
   editorialInput('news-team').value=item.team_id||'';
   renderNewsReferenceOptions(item.match_id || (item.related_event_id ? `event:${item.related_event_id}` : ''));
   editorialInput('news-status').value=item.status||'draft';
   const appointment=eventMap.get(item.id);
   editorialInput('news-event-start').value=local(appointment?.starts_at||null);
   editorialInput('news-event-end').value=local(appointment?.ends_at||null);
   editorialInput('news-event-location').value=appointment?.location_name||'';
   document.getElementById('news-cancel-edit')?.classList.remove('hidden');
   document.getElementById('news-form')?.scrollIntoView({block:'start'});
   status('Beitrag zur Bearbeitung geladen.','info');
 }));
 target.querySelectorAll('[data-delete-news]').forEach(button=>button.addEventListener('click',async()=>{
   const id=button.closest('[data-news-id]')?.getAttribute('data-news-id');
   const item=rows.find(row=>row.id===id);if(!id||!item)return;
   if(!window.confirm(`Beitrag „${item.title}“ wirklich löschen?`))return;
   const appointment=eventMap.get(id);
   if(appointment){const removed=await supabase.from('events').delete().eq('id',appointment.id);if(removed.error)return status(removed.error.message,'error');}
   const {error}=await supabase.from('news').delete().eq('id',id);
   if(error)return status(error.message,'error');
   status('Beitrag gelöscht.','success');await refreshNews();await refreshNewsReferenceEvents();
 }));
}

async function addNews(event: Event){
 event.preventDefault();
 const editId=editorialInput('news-edit-id')?.value||null;
 const title=editorialInput('news-title')?.value.trim()||'';
 const teamId=editorialInput('news-team')?.value||null;
 const referenceValue=editorialInput('news-match')?.value||'';
 const relatedEventId=referenceValue.startsWith('event:')?referenceValue.slice(6):null;
 const matchId=relatedEventId?null:(referenceValue||null);
 const publication=editorialInput('news-status')?.value||'draft';
 const body=editorialInput('news-body')?.value.trim()||'';
 const eventStart=editorialInput('news-event-start')?.value||'';
 const eventEnd=editorialInput('news-event-end')?.value||'';
 if(!title||!body)return status('Titel und Text fehlen.','error');
 if(eventEnd&&!eventStart)return status('Für ein Ende muss auch ein Beginn eingetragen sein.','error');
 if(eventStart&&eventEnd&&new Date(eventEnd).getTime()<new Date(eventStart).getTime())return status('Das Terminende darf nicht vor dem Beginn liegen.','error');
 if(!state.isSuper&&(!teamId||!canEditTeamId(teamId)))return status('Keine Redaktionsberechtigung.','error');
 if(matchId){
   const match=state.matches.find(m=>m.id===matchId);
   const ts=state.teamSeasons.find(x=>x.id===match?.team_season_id);
   if(!match||ts?.team_id!==teamId)return status('Das Spiel gehört nicht zu dieser Mannschaft.','error');
 }
 if(relatedEventId){
   const related=state.newsReferenceEvents.find(e=>e.id===relatedEventId);
   if(!related||(related.team_id||null)!==teamId)return status('Der Termin gehört nicht zu dieser Mannschaft.','error');
 }
 let originalPublishDate: string | null = null;
 if (editId && publication === 'published') {
   const existing = await supabase.from('news').select('published_at').eq('id', editId).maybeSingle();
   if (existing.error) return status(existing.error.message,'error');
   originalPublishDate = existing.data?.published_at || null;
 }
 const patch={title,body,excerpt:editorialInput('news-excerpt')?.value.trim()||null,team_id:teamId,match_id:matchId,related_event_id:relatedEventId,status:publication,published_at:publication==='published'?(originalPublishDate||new Date().toISOString()):null};
 const result=editId?await supabase.from('news').update(patch).eq('id',editId).select('id').single():await supabase.from('news').insert({...patch,slug:`${slugify(title)}-${Date.now().toString(36)}`,author_id:state.user.id}).select('id').single();
 if(result.error||!result.data)return status(result.error?.message||'Speichern fehlgeschlagen.','error');
 const newsId=result.data.id;
 const linked=await supabase.from('events').select('id').eq('external_url',`news:${newsId}`).maybeSingle();
 if(linked.error)return status(`Beitrag gespeichert, Termin konnte nicht geprüft werden: ${linked.error.message}`,'error');
 if(eventStart){
   const eventPatch={title,description:body,category:'club',starts_at:new Date(eventStart).toISOString(),ends_at:eventEnd?new Date(eventEnd).toISOString():null,location_name:editorialInput('news-event-location')?.value.trim()||null,team_id:teamId,status:publication==='published'?'published':publication==='archived'?'archived':'draft',external_url:`news:${newsId}`};
   const eventResult=linked.data?await supabase.from('events').update(eventPatch).eq('id',linked.data.id):await supabase.from('events').insert({...eventPatch,slug:`news-${newsId}`,created_by:state.user.id});
   if(eventResult.error)return status(`Beitrag gespeichert, Kalendertermin fehlgeschlagen: ${eventResult.error.message}`,'error');
 }else if(linked.data){
   const removed=await supabase.from('events').delete().eq('id',linked.data.id);
   if(removed.error)return status(`Beitrag gespeichert, alter Kalendertermin konnte nicht entfernt werden: ${removed.error.message}`,'error');
 }
 const photo=document.getElementById('news-image');
 if(photo instanceof HTMLInputElement&&photo.files?.[0]){
   let image;try{image=await optimizeImage(photo.files[0]);}catch{return status('Text gespeichert, Bildverarbeitung fehlgeschlagen.','error');}
   const path=`${teamId?`teams/${teamId}`:'site'}/news/${result.data.id}/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`;
   const upload=await supabase.storage.from('media').upload(path,image);
   if(upload.error)return status(`Text gespeichert, Bildfehler: ${upload.error.message}`,'error');
   const saved=await supabase.from('news').update({hero_image_path:path}).eq('id',result.data.id);
   if(saved.error)return status(`Text gespeichert, Bildverknüpfung fehlgeschlagen: ${saved.error.message}`,'error');
 }
 const form=document.getElementById('news-form');if(form instanceof HTMLFormElement)form.reset();
 editorialInput('news-edit-id').value='';
 editorialInput('news-status').value='draft';
 document.getElementById('news-cancel-edit')?.classList.add('hidden');
 document.getElementById('news-preview')?.classList.add('hidden');
 status(editId?'Beitrag aktualisiert.':'Beitrag erstellt.','success');
 await refreshNews();
 await refreshNewsReferenceEvents();
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
  const lastUpdated = $('#facility-last-updated');
  if (lastUpdated) lastUpdated.textContent = current?.updated_at
    ? `Letzte Statusmeldung: ${formatDateTime(current.updated_at)}`
    : 'Noch keine Statusmeldung hinterlegt.';
  if (current) {
    ($<HTMLSelectElement>('#facility-status')!).value = current.status;
    ($<HTMLTextAreaElement>('#facility-message')!).value = current.message ?? '';
  }
  const target = $('#courts-admin-list');
  if (!target) return;
  target.innerHTML = (courts ?? []).map((court) => `<div class="card flat" data-court="${court.id}"><div class="page-head"><strong>${escapeHtml(court.name)}</strong><div class="actions"><select data-court-status aria-label="Platzstatus ändern"><option value="open" ${court.status === 'open' ? 'selected' : ''}>Offen</option><option value="limited" ${court.status === 'limited' ? 'selected' : ''}>Eingeschränkt</option><option value="closed" ${court.status === 'closed' ? 'selected' : ''}>Gesperrt</option><option value="unknown" ${court.status === 'unknown' ? 'selected' : ''}>Unbekannt</option></select><input data-court-message aria-label="Hinweis zum Platz" value="${escapeHtml(court.status_message || '')}" placeholder="Hinweis" /><button class="button ghost" data-save-court>Speichern</button></div></div></div>`).join('');
  target.querySelectorAll<HTMLElement>('[data-court]').forEach((row) => row.querySelector<HTMLButtonElement>('[data-save-court]')?.addEventListener('click', async () => {
    const { error } = await supabase.from('courts').update({
      status: row.querySelector<HTMLSelectElement>('[data-court-status]')?.value,
      status_message: row.querySelector<HTMLInputElement>('[data-court-message]')?.value.trim() || null,
    }).eq('id', row.dataset.court).select('id');
    if (error) status(error.message, 'error'); else { status('Platzstatus gespeichert.', 'success'); await loadFacility(); }
  }));
}

async function saveFacility(event: Event) {
  event.preventDefault();
  const { error } = await supabase.from('facility_status').update({
    status: $<HTMLSelectElement>('#facility-status')?.value,
    message: $<HTMLTextAreaElement>('#facility-message')?.value.trim() || null,
    updated_by: state.user.id,
    updated_at: new Date().toISOString(),
  }).eq('id', true).select('id');
  if (error) status(error.message, 'error'); else { status('Anlagenstatus gespeichert.', 'success'); await loadFacility(); }
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

async function loadClubEntries(){
 if(!state.isSuper)return;
 const [sr,or]=await Promise.all([
  supabase.from('sponsors').select('*').order('sort_order'),
  supabase.from('officials').select('*').order('sort_order')
 ]);
 const sponsorTarget=document.getElementById('sponsors-admin-list');
 if(sponsorTarget){
   if(sr.error){sponsorTarget.textContent='Sponsoren konnten nicht geladen werden.';}
   else{
     const rows=sr.data??[];
     sponsorTarget.innerHTML=rows.length?rows.map(x=>`<div class="admin-edit-item" data-sponsor-id="${x.id}"><div><strong>${escapeHtml(x.name)}</strong><p class="match-meta">${x.active?'Aktiv':'Ausgeblendet'}</p></div><button class="button ghost" type="button" data-edit-sponsor>Bearbeiten</button></div>`).join(''):'<p class="muted">Noch keine Sponsoren vorhanden.</p>';
     sponsorTarget.querySelectorAll('[data-edit-sponsor]').forEach(button=>button.addEventListener('click',()=>{
       const x=rows.find(row=>row.id===button.closest('[data-sponsor-id]')?.getAttribute('data-sponsor-id'));if(!x)return;
       for(const [id,val] of [['sponsor-edit-id',x.id],['sponsor-name',x.name],['sponsor-url',x.url||''],['sponsor-description',x.description||''],['sponsor-order',String(x.sort_order??0)]])editorialInput(id).value=val;
       const active=document.getElementById('sponsor-active');if(active instanceof HTMLInputElement)active.checked=!!x.active;
       document.getElementById('sponsor-cancel-edit')?.classList.remove('hidden');
       document.getElementById('sponsor-form')?.scrollIntoView({block:'start'});
     }));
   }
 }
 const officialTarget=document.getElementById('officials-admin-list');
 if(officialTarget){
   if(or.error){officialTarget.textContent='Funktionäre konnten nicht geladen werden.';}
   else{
     const rows=or.data??[];
     officialTarget.innerHTML=rows.length?rows.map(x=>`<div class="admin-edit-item" data-official-id="${x.id}"><div><strong>${escapeHtml(x.name)}</strong><p class="match-meta">${escapeHtml(x.title)} · ${x.published?'Öffentlich':'Nicht veröffentlicht'}</p></div><button class="button ghost" type="button" data-edit-official>Bearbeiten</button></div>`).join(''):'<p class="muted">Noch keine Funktionäre vorhanden.</p>';
     officialTarget.querySelectorAll('[data-edit-official]').forEach(button=>button.addEventListener('click',()=>{
       const x=rows.find(row=>row.id===button.closest('[data-official-id]')?.getAttribute('data-official-id'));if(!x)return;
       for(const [id,val] of [['official-edit-id',x.id],['official-name',x.name],['official-title',x.title],['official-email',x.email||''],['official-phone',x.phone||''],['official-order',String(x.sort_order??0)]])editorialInput(id).value=val;
       const published=document.getElementById('official-published');if(published instanceof HTMLInputElement)published.checked=!!x.published;
       document.getElementById('official-cancel-edit')?.classList.remove('hidden');
       document.getElementById('official-form')?.scrollIntoView({block:'start'});
     }));
   }
 }
}

async function addSponsor(event: Event){
 event.preventDefault();
 if(!state.isSuper)return status('Keine Berechtigung.','error');
 const editId=editorialInput('sponsor-edit-id').value||null;
 const name=editorialInput('sponsor-name').value.trim();
 if(!name)return status('Sponsorname erforderlich.','error');
 const active=document.getElementById('sponsor-active');
 const patch={name,url:editorialInput('sponsor-url').value.trim()||null,description:editorialInput('sponsor-description').value.trim()||null,sort_order:Number(editorialInput('sponsor-order').value)||0,active:active instanceof HTMLInputElement?active.checked:false};
 const result=editId?await supabase.from('sponsors').update(patch).eq('id',editId).select('id').single():await supabase.from('sponsors').insert(patch).select('id').single();
 if(result.error||!result.data)return status(result.error?.message||'Sponsor nicht gespeichert.','error');
 const input=document.getElementById('sponsor-logo');
 if(input instanceof HTMLInputElement&&input.files?.[0]){
   let image;try{image=await optimizeImage(input.files[0],1400,0.9);}catch{return status('Sponsor gespeichert, Logo ungültig.','error');}
   const path=`site/sponsors/${result.data.id}/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`;
   const upload=await supabase.storage.from('media').upload(path,image);
   if(upload.error)return status('Sponsor gespeichert, Logo-Upload fehlgeschlagen: '+upload.error.message,'error');
   const link=await supabase.from('sponsors').update({logo_path:path}).eq('id',result.data.id);
   if(link.error)return status('Sponsor gespeichert, Logo nicht verknüpft: '+link.error.message,'error');
 }
 const form=document.getElementById('sponsor-form');if(form instanceof HTMLFormElement)form.reset();
 editorialInput('sponsor-edit-id').value='';
 document.getElementById('sponsor-cancel-edit')?.classList.add('hidden');
 status(editId?'Sponsor aktualisiert.':'Sponsor angelegt.','success');
 await loadClubEntries();
}

async function addOfficial(event: Event){
 event.preventDefault();
 if(!state.isSuper)return status('Keine Berechtigung.','error');
 const editId=editorialInput('official-edit-id').value||null;
 const name=editorialInput('official-name').value.trim(), title=editorialInput('official-title').value.trim();
 if(!name||!title)return status('Name und Funktion erforderlich.','error');
 const published=document.getElementById('official-published');
 const patch={name,title,email:editorialInput('official-email').value.trim()||null,phone:editorialInput('official-phone').value.trim()||null,sort_order:Number(editorialInput('official-order').value)||0,published:published instanceof HTMLInputElement?published.checked:false};
 const result=editId?await supabase.from('officials').update(patch).eq('id',editId).select('id').single():await supabase.from('officials').insert(patch).select('id').single();
 if(result.error||!result.data)return status(result.error?.message||'Funktionär nicht gespeichert.','error');
 const input=document.getElementById('official-photo');
 if(input instanceof HTMLInputElement&&input.files?.[0]){
   let image;try{image=await optimizeImage(input.files[0],1200,0.85);}catch{return status('Funktionär gespeichert, Bild ungültig.','error');}
   const path=`site/officials/${result.data.id}/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`;
   const upload=await supabase.storage.from('media').upload(path,image);
   if(upload.error)return status('Funktionär gespeichert, Bild-Upload fehlgeschlagen: '+upload.error.message,'error');
   const link=await supabase.from('officials').update({photo_path:path}).eq('id',result.data.id);
   if(link.error)return status('Funktionär gespeichert, Bild nicht verknüpft: '+link.error.message,'error');
 }
 const form=document.getElementById('official-form');if(form instanceof HTMLFormElement)form.reset();
 editorialInput('official-edit-id').value='';
 document.getElementById('official-cancel-edit')?.classList.add('hidden');
 status(editId?'Funktionär aktualisiert.':'Funktionär angelegt.','success');
 await loadClubEntries();
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
  if (error) return status('Die Benutzerverwaltung ist momentan nicht erreichbar. Bitte erneut versuchen.', 'error');
  if (data?.ok === false || data?.error) return status(data?.error || 'Einladung fehlgeschlagen.', 'error');

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
  renderAdminTeamSeasonFilter();
  renderTeamOptions('#news-team', state.isSuper, 'edit');
  renderNewsReferenceOptions();
  renderTeamOptions('#gallery-team', false, 'edit');
  renderGalleryMatchOptions();
  renderAdminRosterSeasonFilter();
  renderTeamSeasonOptions('#match-team-season', 'edit');

  renderInviteTeamCards();

}


function bindForms() {
  document.querySelectorAll<HTMLButtonElement>('[data-team-season]').forEach((button) => button.addEventListener('click', () => {
    teamSeasonFilterCode = button.dataset.teamSeason || 'sommer-2026';
    renderAdminTeamSeasonFilter();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-roster-season]').forEach((button) => button.addEventListener('click', () => {
    rosterSeasonFilterCode = button.dataset.rosterSeason || 'sommer-2026';
    renderAdminRosterSeasonFilter();
    resetPlayerForm();
    clearBulkRosterPreview();
    void refreshPlayers();
  }));
  $<HTMLFormElement>('#team-form')?.addEventListener('submit', saveTeam);
  $<HTMLSelectElement>('#team-select')?.addEventListener('change', fillTeamForm);
  $<HTMLButtonElement>('#team-image-reset')?.addEventListener('click', resetTeamImage);
  $<HTMLFormElement>('#player-form')?.addEventListener('submit', savePlayer);
  $<HTMLTextAreaElement>('#roster-bulk-names')?.addEventListener('input', clearBulkRosterPreview);
  $<HTMLButtonElement>('#roster-bulk-check')?.addEventListener('click', checkBulkRoster);
  $<HTMLFormElement>('#roster-bulk-form')?.addEventListener('submit', importBulkRoster);
  $<HTMLSelectElement>('#players-team-season')?.addEventListener('change', () => { resetPlayerForm(); clearBulkRosterPreview(); refreshPlayers(); });
  $<HTMLButtonElement>('#player-cancel-edit')?.addEventListener('click', resetPlayerForm);
  $<HTMLFormElement>('#match-form')?.addEventListener('submit', addMatch);
  $<HTMLSelectElement>('#matches-admin-filter')?.addEventListener('change', () => { void refreshMatches(); });
  $<HTMLSelectElement>('#matches-admin-game')?.addEventListener('change', () => {
    openMobileEncounterId = null;
    void refreshMatches();
  });
  $<HTMLFormElement>('#news-form')?.addEventListener('submit', addNews);
  $<HTMLSelectElement>('#news-team')?.addEventListener('change', () => renderNewsReferenceOptions(''));
  $('#news-cancel-edit')?.addEventListener('click', () => {
    ($<HTMLFormElement>('#news-form'))?.reset();
    editorialInput('news-edit-id').value = '';
    editorialInput('news-status').value = 'draft';
    $('#news-cancel-edit')?.classList.add('hidden');
    $('#news-preview')?.classList.add('hidden');
    renderNewsReferenceOptions('');
  });
  $('#news-preview-button')?.addEventListener('click', () => {
    const preview = $('#news-preview');
    if (!preview) return;
    preview.classList.remove('hidden');
    preview.textContent = ['news-title', 'news-excerpt', 'news-body'].map((id) => editorialInput(id).value).filter(Boolean).join('\n\n');
  });
  $<HTMLFormElement>('#gallery-form')?.addEventListener('submit', addGallery);
  $<HTMLSelectElement>('#gallery-team')?.addEventListener('change', renderGalleryMatchOptions);
  $<HTMLFormElement>('#facility-form')?.addEventListener('submit', saveFacility);
  $<HTMLSelectElement>('#page-select')?.addEventListener('change', fillPage);
  $<HTMLFormElement>('#page-form')?.addEventListener('submit', savePage);
  $<HTMLFormElement>('#sponsor-form')?.addEventListener('submit', addSponsor);
  $<HTMLFormElement>('#official-form')?.addEventListener('submit', addOfficial);
  $('#sponsor-cancel-edit')?.addEventListener('click', () => {
    ($<HTMLFormElement>('#sponsor-form'))?.reset();
    editorialInput('sponsor-edit-id').value = '';
    $('#sponsor-cancel-edit')?.classList.add('hidden');
  });
  $('#official-cancel-edit')?.addEventListener('click', () => {
    ($<HTMLFormElement>('#official-form'))?.reset();
    editorialInput('official-edit-id').value = '';
    $('#official-cancel-edit')?.classList.add('hidden');
  });
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
  await Promise.all([refreshDashboard(), refreshPlayers(), refreshMatches(), refreshNews(), refreshNewsReferenceEvents(), refreshGalleries()]);
  if (state.isSuper) await Promise.all([loadFacility(), loadContent(), loadUsers(), loadClubEntries()]);
  await initAdvancedAdmin(state);
  await initPhase8Admin(state);
  if (state.isSuper) {
    initManualResultsPanel();
    initOfficialReportsPanel();
  }
  const requestedPanel = new URLSearchParams(location.search).get('panel');
  showPanel(requestedPanel || 'dashboard');
}

export async function initAdmin() {
  const authStatus = $('#auth-status');
  const setupStatus = $('#password-setup-status');
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(location.search);
  const initialAuthFlow = hashParams.get('type') || queryParams.get('type') || '';
  const requiresPasswordSetup = initialAuthFlow === 'invite' || initialAuthFlow === 'recovery';

  const showPasswordSetup = (user: any) => {
    state.user = user;
    $('#auth-box')?.classList.add('hidden');
    $('#admin-app')?.classList.add('hidden');
    $('#password-setup-box')?.classList.remove('hidden');
    $<HTMLInputElement>('#setup-password')?.focus();
  };

  $<HTMLFormElement>('#password-setup-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $<HTMLInputElement>('#setup-password')?.value || '';
    const confirmPassword = $<HTMLInputElement>('#setup-password-confirm')?.value || '';

    if (password.length < 12) {
      setupStatus?.classList.remove('hidden');
      return setStatus(setupStatus, 'Das Passwort muss mindestens 12 Zeichen lang sein.', 'error');
    }
    if (password !== confirmPassword) {
      setupStatus?.classList.remove('hidden');
      return setStatus(setupStatus, 'Die beiden Passwörter stimmen nicht überein.', 'error');
    }

    setupStatus?.classList.remove('hidden');
    setStatus(setupStatus, 'Passwort wird gespeichert …');
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error || !data.user) return setStatus(setupStatus, error?.message || 'Passwort konnte nicht gespeichert werden.', 'error');

    history.replaceState({}, document.title, `${location.origin}${import.meta.env.BASE_URL}admin/`);
    ($<HTMLFormElement>('#password-setup-form'))?.reset();
    $('#password-setup-box')?.classList.add('hidden');
    setStatus(setupStatus, 'Passwort gespeichert.', 'success');
    await startApp(data.user);
  });

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

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session?.user) {
      showPasswordSetup(session.user);
    }
  });

  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    if (requiresPasswordSetup) showPasswordSetup(data.session.user);
    else await startApp(data.session.user);
  }
}
