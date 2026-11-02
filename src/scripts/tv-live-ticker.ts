import { mediaUrl, supabase } from '../lib/supabase';
import { escapeHtml } from '../lib/ui';
import { summarizeSetResult, homeAwaySetScore } from '../lib/tennis-score.mjs';

type Row = Record<string, any>;
type LiveMatch = { match: Row; state: Row; teamName: string; encounters: Row[] };
const REFRESH_MS = 30_000;
const LOGO = mediaUrl('branding/tennis-logo.png');

const fmtDate = (value: string) => new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

const fmtTime = () => new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit',
}).format(new Date());

function changedAgo(iso: string | null | undefined) {
  if (!iso) return 'Noch keine Änderung';
  const age = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (!Number.isFinite(age)) return 'Zeit unbekannt';
  if (age < 1) return 'Gerade aktualisiert';
  if (age < 60) return 'Zuletzt geändert: vor ' + age + ' Minuten';
  if (age < 1440) return 'Zuletzt geändert: vor ' + Math.floor(age / 60) + ' Stunden';
  return 'Zuletzt geändert: vor ' + Math.floor(age / 1440) + ' Tagen';
}

const stateLabel = (s: string) =>
  s === 'finished' ? 'Beendet' : s === 'live' ? 'LIVE' : 'Noch offen';

function renderEncounter(match: Row, encounter: Row) {
  const kind = encounter.discipline === 'doubles' ? 'Doppel' : 'Einzel';
  const number = Number(encounter.position) || 1;
  const tsvNames = [encounter.tsv_player_1_name, encounter.tsv_player_2_name]
    .filter(Boolean).join(' / ') || 'TSV-Spieler noch offen';
  const opponentNames = [encounter.opponent_slot_1, encounter.opponent_slot_2]
    .filter((n: unknown) => n != null).map((n: unknown) => 'Gegner ' + n)
    .join(' / ') || (kind === 'Einzel' ? 'Gegner ' + number : 'Doppelgegner noch offen');
  const first = match.is_home ? tsvNames : opponentNames;
  const second = match.is_home ? opponentNames : tsvNames;
  const visible = encounter.status === 'live' || encounter.status === 'finished';
  const result = visible ? summarizeSetResult(encounter.result_text) : null;
  const oriented = result ? homeAwaySetScore(result, !!match.is_home) : null;
  const scores = result?.scores || [];
  const setColumn = (index: number) => {
    const value = scores[index];
    if (!value) return '<div class="tv-ticker__set"><small>' + (index + 1) + '</small><span>–</span><span>–</span></div>';
    const [tsv, rival] = value.split(':');
    const home = match.is_home ? tsv : rival;
    const away = match.is_home ? rival : tsv;
    return '<div class="tv-ticker__set"><small>' + (index + 1) + '</small><span>' +
      escapeHtml(home) + '</span><span>' + escapeHtml(away) + '</span></div>';
  };
  const round = oriented && result?.hasResult
    ? '<div class="tv-ticker__set tv-ticker__set--total"><small>S</small><span>' +
      oriented.homeSets + '</span><span>' + oriented.awaySets + '</span></div>' : '';
  const resultText = visible && !result?.hasResult && encounter.result_text
    ? '<p class="tv-ticker__result-note">' + escapeHtml(encounter.result_text) + '</p>' : '';
  return '<article class="tv-ticker__game' +
    (encounter.status === 'live' ? ' is-live' : '') +
    (encounter.status === 'finished' ? ' is-finished' : '') +
    '"><div class="tv-ticker__game-top"><strong>' +
    (kind === 'Einzel' ? 'E' : 'D') + number + ' · ' + kind +
    '</strong><span class="tv-ticker__game-status">' + stateLabel(encounter.status) +
    '</span></div><div class="tv-ticker__game-body">' +
    '<div class="tv-ticker__players"><div title="' + escapeHtml(first) + '">' +
    escapeHtml(first) + '</div><div title="' + escapeHtml(second) + '">' +
    escapeHtml(second) + '</div></div><div class="tv-ticker__sets">' +
    [0, 1, 2].map(setColumn).join('') + round + '</div></div>' +
    resultText + '</article>';
}

function renderMatch(row: LiveMatch) {
  const { match, state, teamName, encounters } = row;
  const club = 'TSV Feldkirchen ' + teamName;
  const home = match.is_home ? club : String(match.opponent || 'Gegner');
  const away = match.is_home ? String(match.opponent || 'Gegner') : club;
  const homeLogo = match.is_home
    ? '<img src="' + escapeHtml(LOGO) + '" alt="TSV Feldkirchen Tennis" />' : '';
  const awayLogo = match.is_home
    ? '' : '<img src="' + escapeHtml(LOGO) + '" alt="TSV Feldkirchen Tennis" />';
  const played = encounters.filter(e => e.status === 'finished').length;
  const live = encounters.filter(e => e.status === 'live').length;
  const updates = [state.updated_at, ...encounters.map(e => e.updated_at)].filter(Boolean);
  const latest = updates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || state.updated_at;
  const order = (a: Row, b: Row) => {
    const rank = (e: Row) => e.discipline === 'singles' ? 0 : 1;
    return rank(a) - rank(b) || Number(a.position || 0) - Number(b.position || 0);
  };
  const url = (import.meta.env.BASE_URL || '/') + 'live/?match=' + encodeURIComponent(match.id);
  return '<article class="tv-ticker__match" data-tv-match="' + escapeHtml(match.id) + '">' +
    '<div class="tv-ticker__match-head"><div><h2>' + escapeHtml(teamName) +
    ' <span>gegen</span> ' + escapeHtml(String(match.opponent || 'Gegner')) +
    '</h2><p>' + escapeHtml(fmtDate(match.starts_at)) + ' · ' +
    (match.is_home ? 'Heimspiel' : 'Auswärtsspiel') +
    (match.venue_name ? ' · ' + escapeHtml(String(match.venue_name)) : '') +
    '</p><p class="tv-ticker__changed">' + escapeHtml(changedAgo(latest)) +
    '</p></div><span class="tv-ticker__running"><span aria-hidden="true">●</span> LIVE</span></div>' +
    '<div class="tv-ticker__score" aria-label="Gesamtergebnis Heim ' +
    Number(state.home_score ?? 0) + ', Gast ' + Number(state.away_score ?? 0) +
    '"><div class="tv-ticker__score-names"><div>' + homeLogo +
    '<strong title="' + escapeHtml(home) + '">' + escapeHtml(home) + '</strong></div><div>' +
    awayLogo + '<strong title="' + escapeHtml(away) + '">' + escapeHtml(away) +
    '</strong></div></div><div class="tv-ticker__score-values"><strong>' +
    Number(state.home_score ?? 0) + '</strong><strong>' + Number(state.away_score ?? 0) +
    '</strong></div></div>' +
    '<div class="tv-ticker__games-head"><strong>Einzel &amp; Doppel</strong><span>' +
    played + '/' + encounters.length + ' beendet · ' + live + ' live</span></div>' +
    '<div class="tv-ticker__games">' +
    (encounters.length ? [...encounters].sort(order).map(e => renderEncounter(match, e)).join('')
      : '<p class="tv-ticker__no-games">Die Einzel und Doppel wurden noch nicht angelegt.</p>') +
    '</div><a class="tv-ticker__detail" href="' + escapeHtml(url) +
    '">Spieldetails &amp; alle Sätze ansehen ↗</a></article>';
}

async function fetchLiveMatches(): Promise<LiveMatch[]> {
  // Only public, explicitly active live states. Do not expose prepared ticker data.
  const statesResult = await supabase.from('match_live_state')
    .select('match_id,status,home_score,away_score,updated_at,started_at')
    .eq('status', 'live').order('started_at', { ascending: true });
  if (statesResult.error) throw Error('Live-Status: ' + statesResult.error.message);
  const states = statesResult.data || [];
  if (!states.length) return [];
  const ids = states.map(s => s.match_id);
  const matchesResult = await supabase.from('matches')
    .select('id,team_season_id,opponent,is_home,starts_at,venue_name,is_published')
    .eq('is_published', true).in('id', ids);
  if (matchesResult.error) throw Error('Begegnungen: ' + matchesResult.error.message);
  const matches = matchesResult.data || [];
  if (!matches.length) return [];
  const publishedIds = matches.map(m => m.id);
  const seasonIds = [...new Set(matches.map(m => m.team_season_id).filter(Boolean))];
  const [encountersResult, seasonsResult] = await Promise.all([
    supabase.from('match_encounters')
      .select('match_id,discipline,position,status,tsv_player_1_name,tsv_player_2_name,opponent_slot_1,opponent_slot_2,result_text,updated_at')
      .in('match_id', publishedIds).order('position'),
    seasonIds.length ? supabase.from('team_seasons').select('id,team_id,is_published').in('id', seasonIds)
      : Promise.resolve({ data: [] as Row[], error: null }),
  ]);
  if (encountersResult.error) throw Error('Einzel und Doppel: ' + encountersResult.error.message);
  if (seasonsResult.error) throw Error('Mannschaften: ' + seasonsResult.error.message);
  const seasons = seasonsResult.data || [];
  const teamIds = [...new Set(seasons.map((t: Row) => t.team_id).filter(Boolean))];
  const teamResult = teamIds.length
    ? await supabase.from('teams').select('id,name,active').in('id', teamIds)
    : { data: [] as Row[], error: null };
  if (teamResult.error) throw Error('Teamnamen: ' + teamResult.error.message);
  const teams = new Map((teamResult.data || []).map((t: Row) => [t.id, String(t.name || 'TSV')]));
  const teamBySeason = new Map(seasons.map((s: Row) => [s.id, teams.get(s.team_id) || 'TSV Feldkirchen']));
  const stateById = new Map(states.map(s => [s.match_id, s]));
  return matches.filter(m => stateById.has(m.id)).map(match => ({
    match, state: stateById.get(match.id)!,
    teamName: teamBySeason.get(match.team_season_id) || 'TSV Feldkirchen',
    encounters: (encountersResult.data || []).filter(e => e.match_id === match.id),
  })).sort((a, b) => new Date(a.state.started_at || a.match.starts_at).getTime()
    - new Date(b.state.started_at || b.match.starts_at).getTime());
}

export function initTvLiveTicker() {
  const board = document.querySelector<HTMLElement>('#tv-ticker-board');
  const count = document.querySelector<HTMLElement>('#tv-ticker-count');
  const sync = document.querySelector<HTMLElement>('#tv-ticker-sync');
  const clock = document.querySelector<HTMLElement>('#tv-ticker-clock');
  const fullscreen = document.querySelector<HTMLButtonElement>('#tv-ticker-fullscreen');
  if (!board || !count || !sync || !clock) return;
  let inFlight = false;
  let lastSuccessful = 0;
  const tickClock = () => { clock.textContent = fmtTime() + ' Uhr'; };
  tickClock();
  window.setInterval(tickClock, 1000);
  fullscreen?.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      sync.textContent = 'Vollbild nicht verfügbar – der Browser kann im Vollbildmodus geöffnet werden.';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    if (fullscreen) fullscreen.textContent = document.fullscreenElement ? '⛶ Vollbild beenden' : '⛶ Vollbild';
  });
  const refresh = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const matches = await fetchLiveMatches();
      board.innerHTML = matches.length
        ? matches.map(renderMatch).join('')
        : '<section class="tv-ticker__empty" role="status"><div class="tv-ticker__empty-mark" aria-hidden="true">🎾</div><h2>Aktuell läuft keine Begegnung</h2><p>Die Anzeige startet automatisch, sobald ein Spiel live geschaltet wird.</p></section>';
      count.textContent = matches.length === 1 ? '1 Begegnung live' : matches.length + ' Begegnungen live';
      lastSuccessful = Date.now();
      sync.textContent = 'Live-Daten aktualisiert: ' + fmtTime() + ' Uhr';
      board.removeAttribute('aria-busy');
    } catch (error) {
      console.warn('TV-Liveticker konnte nicht aktualisiert werden', error);
      sync.textContent = lastSuccessful
        ? 'Verbindung gestört · Letzte erfolgreiche Aktualisierung um ' +
          new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastSuccessful) + ' Uhr'
        : 'Live-Daten derzeit nicht abrufbar. Automatischer neuer Versuch in 30 Sekunden.';
      sync.classList.add('tv-ticker__sync--error');
      if (!lastSuccessful) {
        board.innerHTML = '<section class="tv-ticker__empty" role="alert"><h2>Verbindung momentan nicht verfügbar</h2><p>Die Ergebnisse werden automatisch erneut abgefragt.</p></section>';
        board.removeAttribute('aria-busy');
      }
    } finally {
      if (lastSuccessful && sync.classList.contains('tv-ticker__sync--error')) sync.classList.remove('tv-ticker__sync--error');
      inFlight = false;
    }
  };
  void refresh();
  // Always poll on the TV, even when browser visibility heuristics are unreliable.
  window.setInterval(() => { void refresh(); }, REFRESH_MS);
}
