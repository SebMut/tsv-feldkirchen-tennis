import { calendarFeedUrl, mediaUrl, supabase } from '../lib/supabase';
import { escapeHtml, formatDateTime } from '../lib/ui';
import { officialBtvTeamDestination } from '../lib/btv-group-url';

type Row = Record<string, any>;

const fallbackImage =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="100%" height="100%" fill="#e7f0ed"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="38" fill="#216052">TSV Feldkirchen Tennis</text></svg>');

function teamFallbackImage(team: Row) {
  if (team.gender === 'men') return mediaUrl('teams/herren.png');
  if (team.gender === 'women') return mediaUrl('teams/damen.png');
  if (team.gender === 'youth') return mediaUrl('teams/jugend.png');
  return fallbackImage;
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'TSV';
}

let refsCache: Promise<{ seasons: Row[]; categories: Row[]; teams: Row[]; teamSeasons: Row[]; btvLinks: Row[] }> | null = null;
let refsCachedAt = 0;

async function refs() {
  if (refsCache && Date.now() - refsCachedAt < 60000) return refsCache;
  refsCachedAt = Date.now();
  refsCache = fetchRefs();
  return refsCache;
}

async function fetchRefs() {
  const [{ data: seasons }, { data: categories }, { data: teams }, { data: teamSeasons }, { data: btvLinks }] = await Promise.all([
    supabase.from('seasons').select('*').order('year', { ascending: false }),
    supabase.from('team_categories').select('*').order('sort_order'),
    supabase.from('teams').select('*').eq('active', true).order('sort_order'),
    supabase.from('team_seasons').select('*'),
    supabase.from('verified_team_btv_links').select('team_season_id,btv_url'),
  ]);
  return {
    seasons: seasons ?? [],
    categories: categories ?? [],
    teams: teams ?? [],
    teamSeasons: teamSeasons ?? [],
    btvLinks: btvLinks ?? [],
  };
}


// Falls ein Dienst nicht antwortet, bleibt keine öffentliche Seite bei "Wird geladen" stehen.
function watchPublicContent(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return;
  window.setTimeout(() => {
    if (/wird geladen|werden geladen|wird ermittelt|werden ermittelt/i.test(element.textContent || '') || !element.innerHTML.trim()) {
      element.innerHTML = '<div class="public-unavailable" role="status">Diese Informationen sind gerade nicht verfügbar. Bitte versuche es später erneut.</div>';
    }
  }, 12000);
}

function byId(rows: Row[]) {
  return new Map(rows.map((row) => [row.id, row]));
}


async function renderSponsorPlacements(
  selector: string,
  placements: string[],
  context: { teamId?: string; matchId?: string } = {},
) {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) return;

  const { data: rows, error } = await supabase
    .from('sponsor_placements')
    .select('*')
    .eq('active', true)
    .in('placement', placements);

  if (error || !rows?.length) {
    target.classList.add('hidden');
    target.innerHTML = '';
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const activeRows = rows.filter((row: Row) => {
    if (row.starts_on && row.starts_on > today) return false;
    if (row.ends_on && row.ends_on < today) return false;

    if (row.placement === 'team') return !!context.teamId && row.team_id === context.teamId;
    if (row.placement === 'match') return !!context.matchId && row.match_id === context.matchId;
    if (row.placement === 'live' && row.match_id) return row.match_id === context.matchId;
    if (row.team_id && context.teamId) return row.team_id === context.teamId;
    return !row.team_id && !row.match_id;
  });

  if (!activeRows.length) {
    target.classList.add('hidden');
    target.innerHTML = '';
    return;
  }

  const ids = [...new Set(activeRows.map((row: Row) => row.sponsor_id))];
  const { data: sponsors } = await supabase
    .from('sponsors')
    .select('*')
    .in('id', ids)
    .eq('active', true)
    .order('sort_order');

  if (!sponsors?.length) {
    target.classList.add('hidden');
    target.innerHTML = '';
    return;
  }

  const label = placements.includes('live') || placements.includes('match')
    ? 'Sponsor des Spieltags'
    : placements.includes('team')
      ? 'Mannschaftspartner'
      : 'Unsere Partner';

  target.classList.remove('hidden');
  target.innerHTML = `
    <div class="card">
      <p class="eyebrow">${escapeHtml(label)}</p>
      <div class="sponsor-strip">
        ${sponsors.map((sponsor: Row) => `
          <a class="sponsor-item" href="${escapeHtml(sponsor.url || '#')}" ${sponsor.url ? 'target="_blank" rel="noreferrer"' : 'aria-disabled="true"'}>
            ${sponsor.logo_path ? `<img src="${escapeHtml(mediaUrl(sponsor.logo_path))}" alt="Logo ${escapeHtml(sponsor.name)}" loading="lazy" />` : ''}
            <strong>${escapeHtml(sponsor.name)}</strong>
          </a>
        `).join('')}
      </div>
    </div>`;
}

// Portrait IDs identify a particular team and season, not the venue.
// Without a verified ID, link to the official club-filtered tennis.de team search.
const TENNIS_DE_CLUB_SEARCH_URL =
  'https://www.tennis.de/spielen/spielbetrieb/mannschaftssuche.html?verband=btv&verein=01012#teamview/23391';

function tennisDeTeamDestination(teamSeason: Row | undefined): { href: string; isDirect: boolean } {
  const portrait = officialTennisDePortraitUrl(teamSeason);
  return { href: portrait || TENNIS_DE_CLUB_SEARCH_URL, isDirect: !!portrait };
}

function officialTennisDePortraitUrl(teamSeason: Row | undefined): string | null {
  const raw = teamSeason?.tennis_de_portrait_url;
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    if (url.origin !== 'https://www.tennis.de'
      || url.pathname !== '/spielen/spielbetrieb/mannschaftssuche.html'
      || url.searchParams.get('verband')?.toLowerCase() !== 'btv'
      || url.searchParams.get('verein') !== '01012'
      || !/^#teamportrait\/\d+$/.test(url.hash)) return null;
    return url.href;
  } catch {
    return null;
  }
}

// A home match can take place in a third-party indoor venue.
// Do not infer its location from is_home, and never route to Feldkirchen by default.
function matchRouteUrl(match: Row): string | null {
  const address = typeof match.venue_address === 'string' ? match.venue_address.trim() : '';
  const venue = typeof match.venue_name === 'string' ? match.venue_name.trim() : '';
  if (!address && !venue) return null;
  const destination = address || venue;
  return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination);
}

function matchRouteButton(match: Row): string {
  const url = matchRouteUrl(match);
  return url
    ? `<a class="button ghost match-route-button" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="Route zum Spielort ${escapeHtml(match.venue_name || match.venue_address || '')} planen">↗ Route planen</a>`
    : '';
}

function matchVenueInfo(match: Row, includeRoute = false): string {
  const venue = typeof match.venue_name === 'string' ? match.venue_name.trim() : '';
  const address = typeof match.venue_address === 'string' ? match.venue_address.trim() : '';
  return `<div class="match-venue">
    <span class="match-venue__label">📍 Tatsächlicher Spielort</span>
    <strong>${escapeHtml(venue || address || 'Spielort noch nicht bekannt')}</strong>
    ${address ? `<small>${escapeHtml(address)}</small>` : venue ? '<small>Genaue Anschrift bitte vor der Fahrt prüfen.</small>' : ''}
    ${includeRoute ? matchRouteButton(match) : ''}
  </div>`;
}

function matchContext(match: Row, reference: Awaited<ReturnType<typeof refs>>) {
  const ts = reference.teamSeasons.find((row: Row) => row.id === match.team_season_id);
  const team = reference.teams.find((row: Row) => row.id === ts?.team_id);
  const season = reference.seasons.find((row: Row) => row.id === ts?.season_id);
  return { ts, team, season };
}

function scoreFor(match: Row, liveStates: Row[]) {
  return liveStates.find((state) => state.match_id === match.id);
}

// BTV publishes its results in home:away order, independent of the TSV venue.
// An absent official result (including a placeholder 0:0) is never a defeat.
function officialBtvScore(match: Row): { home: number; away: number } | null {
  const result = typeof match.btv_result_text === 'string'
    ? /^\s*(\d{1,2})\s*:\s*(\d{1,2})\s*$/.exec(match.btv_result_text)
    : null;
  if (!result) return null;
  const home = Number(result[1]);
  const away = Number(result[2]);
  if (home === 0 && away === 0) return null;
  return { home, away };
}

function matchRow(match: Row, reference: Awaited<ReturnType<typeof refs>>, liveStates: Row[] = [], matchesWithGallery = new Set<string>()) {
  const { team } = matchContext(match, reference);
  const state = scoreFor(match, liveStates);
  const status = state?.status ?? 'scheduled';
  const official = status === 'scheduled' ? officialBtvScore(match) : null;
  const home = official?.home ?? state?.home_score ?? 0;
  const away = official?.away ?? state?.away_score ?? 0;
  const clubScore = match.is_home ? home : away;
  const opponentScore = match.is_home ? away : home;
  const homeAway = match.is_home ? 'Heim' : 'Auswärts';
  const detailUrl = `/spiel/?match=${encodeURIComponent(match.id)}`;
  return `
    <div class="match-row">
      <a class="match-row__main" href="${detailUrl}">
        <span class="match-row__teamline"><img class="match-row__tsv-logo" src="${escapeHtml(mediaUrl('branding/tennis-logo.png'))}" alt="" /><strong>${escapeHtml(team?.name ?? 'TSV Feldkirchen')} · ${escapeHtml(homeAway)}</strong></span>
        <div class="match-meta">${escapeHtml(formatDateTime(match.starts_at))} · gegen ${escapeHtml(match.opponent)}</div>
        ${matchVenueInfo(match)}
      </a>
      <div class="actions">
        ${matchRouteButton(match)}
        ${status === 'live' ? '<span class="status-pill live">LIVE</span>' : status === 'finished' ? '<span class="status-pill">Beendet</span>' : official ? '<span class="status-pill">BTV-Ergebnis</span>' : ''}
        ${status !== 'scheduled' || official ? `<span class="score">${clubScore} : ${opponentScore}</span>` : ''}
        <a class="button ghost" href="${detailUrl}">${matchesWithGallery.has(match.id) ? 'Spiel & Bilder' : 'Spiel öffnen'}</a>
        ${status === 'live' ? `<a class="button" href="/live/?match=${encodeURIComponent(match.id)}">Liveticker</a>` : ''}
      </div>
    </div>`;
}

export async function loadHome() {
  const facility = document.querySelector<HTMLAnchorElement>('#facility-pill');
  const liveCenter = document.querySelector<HTMLElement>('#live-center');
  const todayTarget = document.querySelector<HTMLElement>('#today-matches');
  const todayPanel = document.querySelector<HTMLElement>('#today-fixtures-panel');
  const upcomingTarget = document.querySelector<HTMLElement>('#upcoming-matches');
  const recentTarget = document.querySelector<HTMLElement>('#recent-matches');
  const newsTarget = document.querySelector<HTMLElement>('#home-news');
  const weatherTarget = document.querySelector<HTMLElement>('#home-weather');
  const errorText = (target: HTMLElement | null, message: string) => {
    if (target) target.innerHTML = `<p class="muted" role="status">${escapeHtml(message)}</p>`;
  };
  const watchdog = window.setTimeout(() => {
    if (facility?.textContent?.match(/geladen|ermittelt/i)) errorText(facility, 'Anlagenstatus momentan nicht abrufbar. Bitte Courtbooking prüfen.');
    for (const target of [todayTarget, upcomingTarget, recentTarget, newsTarget]) {
      if (target?.textContent?.match(/geladen|ermittelt/i)) errorText(target, 'Inhalte momentan nicht abrufbar. Bitte später erneut versuchen.');
    }
  }, 12000);
  try {
    const reference = await refs();
    const now = new Date();
    // A fixture belongs to "Heute" by the club's local date, not the visitor's time zone.
    // Query a slightly wider UTC interval and then filter by the Europe/Berlin calendar day.
    // This also covers both CET and CEST, including daylight-saving changes.
    const berlinDayFormatter = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const berlinDayKey = (value: string | Date) => {
      const parts = berlinDayFormatter.formatToParts(new Date(value));
      const get = (type: string) => parts.find(part => part.type === type)?.value || '';
      return `${get('year')}-${get('month')}-${get('day')}`;
    };
    const currentDayKey = berlinDayKey(now);
    const [year, month, day] = currentDayKey.split('-').map(Number);
    const midnightUtc = Date.UTC(year, month - 1, day);
    const start = new Date(midnightUtc - 2 * 3600000);
    const end = new Date(midnightUtc + 26 * 3600000);
    const [facilityResult, activeResult, todayResult, upcomingResult, recentResult, newsResult, settingsResult, weatherResult] = await Promise.all([
      facility ? supabase.from('facility_status').select('*').limit(1) : Promise.resolve({ data: [], error: null }),
      supabase.from('match_live_state').select('*').eq('status', 'live'),
      supabase.from('matches').select('*').eq('is_published', true).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at').limit(50),
      supabase.from('matches').select('*').eq('is_published', true).gte('starts_at', now.toISOString()).order('starts_at').limit(15),
      recentTarget ? supabase.from('matches').select('*').eq('is_published', true).lt('starts_at', start.toISOString()).order('starts_at', { ascending: false }).limit(8) : Promise.resolve({ data: [], error: null }),
      newsTarget ? supabase.from('news').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(3) : Promise.resolve({ data: [], error: null }),
      document.querySelector('#home-team-count, #home-court-count')
        ? supabase.from('site_settings').select('key,value').in('key', ['team_count', 'court_count'])
        : Promise.resolve({ data: [], error: null }),
      weatherTarget
        ? fetch('https://api.open-meteo.com/v1/forecast?latitude=48.15&longitude=11.73&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBerlin&forecast_days=3').then(response => response.ok ? response.json() : Promise.reject(new Error('Wetterdienst nicht erreichbar'))).catch(() => null)
        : Promise.resolve(null),
    ]);
    const settings = new Map((settingsResult.data ?? []).map(row => [row.key, row.value]));
    for (const [selector, key] of [['#home-team-count', 'team_count'], ['#home-court-count', 'court_count']]) {
      const target = document.querySelector(selector);
      if (target && settings.has(key)) target.textContent = String(settings.get(key));
    }
    if (facility) {
      const current = facilityResult.data?.[0];
      const outdated = !!current?.updated_at && Date.now() - new Date(current.updated_at).getTime() > 14 * 86400000;
      const hasError = !!facilityResult.error;
      const label = outdated ? 'Status nicht aktuell' : hasError ? 'Anlagenstatus nicht verfügbar' : !current ? 'Status nicht gemeldet'
        : current.status === 'closed' ? 'Geschlossen' : current.status === 'limited' ? 'Teilweise offen'
        : current.status === 'open' ? 'Offen' : 'Status derzeit unklar';
      const description = outdated ? 'Die letzte Meldung ist älter als 14 Tage. Bitte die Verfügbarkeit direkt bei Courtbooking prüfen.' : hasError ? 'Bitte prüfe die aktuelle Platzverfügbarkeit in Courtbooking.'
        : current?.message || (!current ? 'Für heute liegt noch keine Statusmeldung vor.' : 'Aktuelle Meldung zur Tennisanlage.');
      const state = !hasError && !outdated && ['closed', 'open', 'limited'].includes(current?.status) ? current.status : 'unknown';
      facility.className = `facility-pill facility-pill--${state}`;
      facility.textContent = `Anlagenstatus: ${label}`;
      facility.title = description;
    }
    if (weatherTarget) {
      const labels = ['Heute', 'Morgen', ...((weatherResult?.daily?.time ?? []).slice(2, 3).map((date: string) => new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(new Date(`${date}T12:00:00`))))];
      const codes: Record<number, string> = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️'};
      weatherTarget.innerHTML = weatherResult?.daily?.time?.length ? weatherResult.daily.time.slice(0, 3).map((_: string, index: number) => `
        <div class="weather-day"><strong>${escapeHtml(labels[index] || '')}</strong><span class="weather-icon" aria-hidden="true">${codes[weatherResult.daily.weather_code[index]] || '🌤️'}</span><span>${Math.round(weatherResult.daily.temperature_2m_max[index])}° / ${Math.round(weatherResult.daily.temperature_2m_min[index])}°</span><small>${weatherResult.daily.precipitation_probability_max[index] ?? 0}% Regen</small></div>`).join('') : '<p class="muted">Wetter momentan nicht abrufbar.</p>';
    }
    const liveStates = activeResult.data ?? [];
    const liveIds = liveStates.map(s => s.match_id);
    const rows = [...(todayResult.data ?? []), ...(upcomingResult.data ?? []), ...(recentResult.data ?? [])];
    const knownIds = new Set(rows.map(m => m.id));
    const missingIds = liveIds.filter(id => !knownIds.has(id));
    if (missingIds.length) {
      const extra = await supabase.from('matches').select('*').eq('is_published', true).in('id', missingIds);
      rows.push(...(extra.data ?? []));
    }
    const byMatch = new Map(rows.map(m => [m.id, m]));
    const liveMatches = liveIds.map(id => byMatch.get(id)).filter(Boolean);
    const todaysFixtures = (todayResult.data ?? []).filter(m => berlinDayKey(m.starts_at) === currentDayKey);
    const todayIds = new Set(todaysFixtures.map(m => m.id));
    const today = [
      ...liveMatches.filter(m => berlinDayKey(m.starts_at) === currentDayKey),
      ...todaysFixtures.filter(m => !liveIds.includes(m.id)),
    ];
    // On the dedicated Spieltag page, don't repeat today's fixtures under "Demnächst".
    const next = (upcomingResult.data ?? []).filter(m =>
      !liveIds.includes(m.id) && (!upcomingTarget || !todayIds.has(m.id)));
    const past = (recentResult.data ?? []).slice(0, 6);
    // The homepage still previews future fixtures, while "Heute" on Spieltag stays literal.
    const focus = today.length ? today : (upcomingTarget ? [] : next.slice(0, 3));
    const scoreIds = [...new Set([...focus, ...next, ...past].map(m => m.id))];
    const scoreResult = scoreIds.length
      ? await supabase.from('match_live_state').select('*').in('match_id', scoreIds)
      : { data: [], error: null };
    const scoreRows = [...(scoreResult.data ?? []), ...liveStates];
    if (liveCenter) {
      if (liveMatches.length) {
        const running = await supabase.from('match_encounters').select('match_id').in('match_id', liveMatches.map(m => m.id)).eq('status', 'live');
        liveCenter.classList.remove('hidden');
        liveCenter.innerHTML = `
          <div class="live-badge"><span class="live-dot"></span>LIVE · TSV Feldkirchen Tennis</div>
          <h2>${liveMatches.length === 1 ? 'Jetzt auf dem Platz' : `${liveMatches.length} Punktspiele laufen`}</h2>
          <p class="muted">${running.data?.length ?? 0} laufende Einzel/Doppel</p>
          <div class="match-list">${liveMatches.map(m => matchRow(m, reference, scoreRows)).join('')}</div>`;
      } else {
        liveCenter.classList.add('hidden');
        liveCenter.innerHTML = '';
      }
    }
    if (todayTarget) {
      // The dedicated Live-Ticker page has no "Heute" card unless there
      // is at least one actual fixture on the current Europe/Berlin date.
      if (todayPanel) {
        todayPanel.classList.toggle('hidden', !!todayResult.error || !!activeResult.error || today.length === 0);
      }
      if (todayResult.error || activeResult.error || (!upcomingTarget && upcomingResult.error)) {
        errorText(todayTarget, 'Punktspiele sind momentan nicht abrufbar.');
      } else {
        todayTarget.innerHTML = focus.length
          ? `<p class="match-section-note">${today.length ? (today.some(m => liveIds.includes(m.id)) ? 'Heute und LIVE' : 'Heutige Punktspiele') : 'Nächste Punktspiele'}</p>${focus.slice(0, 6).map(m => matchRow(m, reference, scoreRows)).join('')}`
          : upcomingTarget
            ? '<p class="muted">Heute finden keine Punktspiele statt. Die nächsten Begegnungen stehen unten unter „Demnächst“.</p>'
            : '<p class="muted">Momentan keine Punktspiele angekündigt.</p>';
      }
    }
    if (upcomingTarget) upcomingTarget.innerHTML = upcomingResult.error
      ? '<p class="muted">Spielplan momentan nicht abrufbar.</p>'
      : next.length ? next.slice(0, 8).map(m => matchRow(m, reference, scoreRows)).join('')
      : '<p class="muted">Keine weiteren Punktspiele angekündigt.</p>';
    const finishedPast = past.filter(m =>
      scoreRows.find(s => s.match_id === m.id)?.status === 'finished' || officialBtvScore(m));
    if (recentTarget) recentTarget.innerHTML = recentResult.error
      ? '<p class="muted">Ergebnisse momentan nicht abrufbar.</p>'
      : finishedPast.length ? finishedPast.map(m => matchRow(m, reference, scoreRows)).join('')
      : '<p class="muted">Noch keine bestätigten Spielergebnisse vorhanden.</p>';
    if (newsTarget) newsTarget.innerHTML = newsResult.error
      ? '<p class="muted">Neuigkeiten momentan nicht abrufbar.</p>'
      : newsResult.data?.length ? newsResult.data.map(item => `
          <div class="news-row"><div><strong>${escapeHtml(item.title)}</strong>
          <div class="match-meta">${item.published_at ? escapeHtml(formatDateTime(item.published_at)) : ''}</div></div></div>`).join('')
      : '<p class="muted">Noch keine aktuellen Beiträge.</p>';
    if (document.querySelector('#home-sponsors')) {
      await renderSponsorPlacements('#home-sponsors', ['home']);
    }
  } catch (error) {
    console.warn('Öffentliche Startseiten-Daten konnten nicht geladen werden:', error);
    if (facility?.textContent?.match(/geladen|ermittelt/i)) errorText(facility, 'Anlagenstatus momentan nicht abrufbar.');
    for (const target of [todayTarget, upcomingTarget, recentTarget, newsTarget]) {
      if (target?.textContent?.match(/geladen|ermittelt/i)) errorText(target, 'Inhalte momentan nicht abrufbar.');
    }
  } finally {
    window.clearTimeout(watchdog);
    window.setTimeout(loadHome, document.hidden ? 120000 : liveCenter && !liveCenter.classList.contains('hidden') ? 20000 : 60000);
  }
}

export async function loadTeams() {
  watchPublicContent('#teams-grid');
  const target = document.querySelector<HTMLElement>('#teams-grid');
  const nav = document.querySelector<HTMLElement>('#teams-season-nav');
  const categoryTarget = document.querySelector<HTMLElement>('#teams-category-chips');
  const info = document.querySelector<HTMLElement>('#teams-results-info');
  const heading = document.querySelector<HTMLElement>('#teams-results-title');
  if (!target || !nav || !categoryTarget || !info || !heading) return;

  const reference = await refs();
  const verifiedBtv = new Map<string, string>(reference.btvLinks.map((link: Row) => [link.team_season_id, link.btv_url]));
  if (!reference.seasons.length || !reference.teams.length) {
    target.innerHTML = '<div class="teams-empty" role="status"><h3>Mannschaften derzeit nicht verfügbar</h3><p>Bitte versuche es später erneut.</p></div>';
    info.textContent = 'Der Spielplan konnte nicht geladen werden.';
    return;
  }

  // Auch später in der Saisonverwaltung angelegte und veröffentlichte
  // Saisons berücksichtigen, statt die Auswahl auf drei Jahre zu begrenzen.
  const publishedSeasons = reference.seasons.filter((s: Row) =>
    s.is_published !== false && typeof s.code === 'string' && /^(sommer|winter)-20\d{2}/.test(s.code));
  const initialButtons = Array.from(nav.querySelectorAll<HTMLButtonElement>('[data-season]'));
  const seasonCodes = [...new Set([
    ...initialButtons.map(button => button.dataset.season || '').filter(Boolean),
    ...publishedSeasons.map((season: Row) => season.code as string),
  ])];
  const seasonByCode = new Map<string, Row>(publishedSeasons
    .map((s: Row) => [s.code, s]));
  for (const code of seasonCodes) {
    if (initialButtons.some(button => button.dataset.season === code)) continue;
    const season = seasonByCode.get(code);
    if (!season) continue;
    const isWinter = code.startsWith('winter-');
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'teams-season-card';
    card.dataset.season = code;
    card.setAttribute('aria-pressed', 'false');
    card.innerHTML = `<span class="teams-season-card__top"><span class="teams-season-card__icon" aria-hidden="true">${isWinter ? '❄' : '☀'}</span><span class="teams-season-card__count" data-count="${escapeHtml(code)}">–</span></span><strong>${escapeHtml(season.name)}</strong><span class="teams-season-card__subtitle">${isWinter ? 'Winterrunde' : 'Sommerrunde'}</span>`;
    nav.append(card);
  }
  const teamsById = byId(reference.teams);
  const publishedTeamSeasons = reference.teamSeasons.filter((ts: Row) => ts.is_published && teamsById.has(ts.team_id));
  const teamGroups = [
    { id: 'herren', name: 'Herren' },
    { id: 'damen', name: 'Damen' },
    { id: 'junioren', name: 'Junioren' },
    { id: 'juniorinnen', name: 'Juniorinnen' },
    { id: 'knaben', name: 'Knaben' },
    { id: 'maedchen', name: 'Mädchen' },
    { id: 'bambini', name: 'Bambini' },
    { id: 'kleinfeld', name: 'Kleinfeld' },
  ];
  const groupForTeam = (team: Row | undefined) => {
    const value = `${team?.slug || ''} ${team?.name || ''}`.toLocaleLowerCase('de-DE');
    return teamGroups.find((group) => value.includes(group.id) || (group.id === 'maedchen' && value.includes('mädchen')))?.id || '';
  };
  const teamsForSeason = (season: Row | undefined) => season
    ? publishedTeamSeasons.filter((ts: Row) => ts.season_id === season.id) : [];
  const seasonCounts = new Map<string, number>(seasonCodes.map((code) => [code, teamsForSeason(seasonByCode.get(code)).length]));
  for (const button of Array.from(nav.querySelectorAll<HTMLButtonElement>('[data-season]'))) {
    const code = button.dataset.season || '';
    const count = button.querySelector<HTMLElement>('[data-count]');
    if (count) {
      const value = seasonCounts.get(code) ?? 0;
      count.textContent = value === 0 ? 'Noch keine Teams' : value + (value === 1 ? ' Team' : ' Teams');
    }
  }

  // Die Saisonverwaltung ist maßgeblich für die initiale Auswahl.
  // Eine ausdrücklich als aktuell markierte Saison gewinnt auch dann,
  // wenn ihre Termine außerhalb des heutigen Datums liegen oder noch keine
  // Mannschaften veröffentlicht sind. URL-Parameter bleiben vorrangig.
  const managedCurrentSeason = seasonCodes.map(code => seasonByCode.get(code))
    .find((s: Row | undefined) => s?.is_current && !s.archived_at);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
  const byCurrentDate = seasonCodes.map(code => seasonByCode.get(code)).find((s: Row | undefined) =>
    s && (seasonCounts.get(s.code) || 0) > 0 && s.starts_on <= today && s.ends_on >= today);
  const defaultSeason = managedCurrentSeason || byCurrentDate
    || seasonCodes.map(code => seasonByCode.get(code)).find((s: Row | undefined) => s && (seasonCounts.get(s.code) || 0) > 0)
    || seasonByCode.get('sommer-2026');
  let activeCode = defaultSeason?.code || 'sommer-2026';
  let activeCategory = '';
  const knownCategories = teamGroups.filter((category) =>
    publishedTeamSeasons.some((ts: Row) => groupForTeam(teamsById.get(ts.team_id)) === category.id));
  categoryTarget.innerHTML = [
    '<button type="button" class="teams-category-chip is-active" data-category="" aria-pressed="true">Alle Teams</button>',
    ...knownCategories.map((category: Row) =>
      `<button type="button" class="teams-category-chip" data-category="${escapeHtml(category.id)}" aria-pressed="false">${escapeHtml(category.name)}</button>`)
  ].join('');

  const seasonIds = publishedTeamSeasons.map((ts: Row) => ts.id);
  const matchResult = seasonIds.length
    ? await supabase.from('matches').select('*').eq('is_published', true).in('team_season_id', seasonIds).order('starts_at')
    : { data: [], error: null };
  const matches = matchResult.data ?? [];
  const stateResult = matches.length
    ? await supabase.from('match_live_state').select('*').in('match_id', matches.map((m: Row) => m.id))
    : { data: [], error: null };
  const states = new Map((stateResult.data ?? []).map((s: Row) => [s.match_id, s]));

  // Ein Kategorienlink aus dem Breadcrumb darf nicht in einer Saison ohne
  // Mannschaften dieser Gruppe landen (z. B. Junioren in der Winterrunde).
  const seasonForGroup = (groupId: string): string | undefined => {
    const seasonsWithGroup = seasonCodes
      .map((code) => seasonByCode.get(code))
      .filter((season): season is Row => !!season && teamsForSeason(season)
        .some((ts: Row) => groupForTeam(teamsById.get(ts.team_id)) === groupId));
    return seasonsWithGroup.find((season: Row) => season.code === defaultSeason?.code)?.code
      ?? seasonsWithGroup.sort((a: Row, b: Row) =>
        String(b.starts_on || '').localeCompare(String(a.starts_on || '')))[0]?.code;
  };
  const applyUrlState = () => {
    const params = new URLSearchParams(window.location.search);
    const requestedGroup = params.get('category') || params.get('gruppe') || '';
    activeCategory = knownCategories.some((category) => category.id === requestedGroup) ? requestedGroup : '';
    const code = params.get('season');
    const legacy = reference.seasons.find((s: Row) => s.id === code)?.code;
    const requestedCode = seasonCodes.includes(code || '') ? code :
      legacy && seasonCodes.includes(legacy) ? legacy : '';
    activeCode = requestedCode || (activeCategory ? seasonForGroup(activeCategory) : undefined)
      || defaultSeason?.code || 'sommer-2026';
  };
  const setUrlState = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('season', activeCode);
    if (activeCategory) url.searchParams.set('category', activeCategory);
    else url.searchParams.delete('category');
    url.searchParams.delete('gruppe');
    window.history.pushState({}, '', url.toString());
  };

  const render = () => {
    for (const button of Array.from(nav.querySelectorAll<HTMLButtonElement>('[data-season]'))) {
      const active = button.dataset.season === activeCode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    for (const button of Array.from(categoryTarget.querySelectorAll<HTMLButtonElement>('[data-category]'))) {
      const active = button.dataset.category === activeCategory;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    const selectedSeason = seasonByCode.get(activeCode);
    const allRows = teamsForSeason(selectedSeason)
      .map((ts: Row) => ({ ts, team: teamsById.get(ts.team_id) }))
      .filter((item: {ts: Row; team: Row | undefined}): item is {ts: Row; team: Row} => !!item.team)
      .sort((a: {team: Row}, b: {team: Row}) => {
        const rank = (team: Row) => {
          const name = `${team.name || ''} ${team.slug || ''}`.toLocaleLowerCase('de-DE');
          const groups = ['herren', 'damen', 'junioren', 'juniorinnen', 'knaben', 'mädchen', 'bambini', 'kleinfeld'];
          const found = groups.findIndex(group => name.includes(group));
          return found < 0 ? groups.length : found;
        };
        return rank(a.team) - rank(b.team) || (a.team.sort_order ?? 0) - (b.team.sort_order ?? 0) || String(a.team.name).localeCompare(String(b.team.name), 'de');
      });
    const rows = allRows.filter(({ team }: {team: Row}) => !activeCategory || groupForTeam(team) === activeCategory);
    const title = selectedSeason?.name || (activeCode === 'winter-2026-2027' ? 'Winter 2026/2027' : activeCode === 'sommer-2027' ? 'Sommer 2027' : 'Sommer 2026');
    heading.textContent = title;
    info.textContent = allRows.length > 0
      ? `${rows.length} ${rows.length === 1 ? 'Mannschaft' : 'Mannschaften'}${activeCategory ? ' in dieser Kategorie' : ' in dieser Runde'}`
      : 'Noch keine bestätigten Mannschaftsmeldungen für diese Runde.';
    const emptyMessage = activeCode === 'sommer-2027'
      ? 'Die Mannschaften und Spielpläne für Sommer 2027 werden veröffentlicht, sobald die offiziellen BTV-Daten verfügbar sind.'
      : activeCode === 'winter-2026-2027'
        ? 'Die Mannschaften der Winterrunde 2026/2027 sind beim BTV bereits veröffentlicht. Wir gleichen ihre Meldungen und Spielpläne derzeit mit unserer Mannschaftsverwaltung ab.'
        : 'Für diese Saison wurden noch keine Mannschaften veröffentlicht.';
    if (!rows.length) {
      target.innerHTML = allRows.length && activeCategory
        ? '<div class="teams-empty"><span aria-hidden="true">◎</span><h3>Keine Mannschaft in dieser Kategorie</h3><p>Wähle „Alle Teams“, um die gesamte Saison zu sehen.</p></div>'
        : `<div class="teams-empty"><span aria-hidden="true">${activeCode.startsWith('winter') ? '❄' : '☀'}</span><h3>${activeCode === 'winter-2026-2027' ? 'BTV-Winterrunde 2026/27' : 'Noch keine Mannschaften veröffentlicht'}</h3><p>${emptyMessage}</p>${activeCode === 'winter-2026-2027' ? '<a class="button secondary" href="https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften" target="_blank" rel="noopener noreferrer">Winter-Mannschaften beim BTV ansehen ↗</a>' : ''}</div>`;
      return;
    }
    const now = Date.now();
    target.innerHTML = rows.map(({ ts, team }: {ts: Row; team: Row}) => {
      const teamMatches = matches.filter((m: Row) => m.team_season_id === ts.id);
      const liveMatch = teamMatches.find((m: Row) => states.get(m.id)?.status === 'live');
      const next = teamMatches.find((m: Row) => new Date(m.starts_at).getTime() >= now && states.get(m.id)?.status !== 'finished');
      const featured = liveMatch || next;
      const currentState = featured ? states.get(featured.id) : null;
      const isLive = currentState?.status === 'live';
      const clubScore = featured ? (featured.is_home ? currentState?.home_score : currentState?.away_score) : null;
      const otherScore = featured ? (featured.is_home ? currentState?.away_score : currentState?.home_score) : null;
      const detailUrl = `/mannschaften/${encodeURIComponent(team.slug)}/?season=${encodeURIComponent(activeCode)}`;
      const btvTarget = officialBtvTeamDestination(verifiedBtv.get(ts.id) === ts.btv_url ? ts.btv_url : null);
      const tennisDeTarget = tennisDeTeamDestination(ts);
      return `
        <article class="card team-card team-overview-card">
          <a href="${detailUrl}" class="team-card__image-link" aria-label="${escapeHtml(team.name)} öffnen"><img src="${escapeHtml(mediaUrl(ts.team_image_path || team.image_path) || teamFallbackImage(team))}" alt="Mannschaftsfoto ${escapeHtml(team.name)}" loading="lazy" /></a>
          <div>
            <p class="eyebrow">${escapeHtml(title)}</p>
            <h3><a href="${detailUrl}" class="text-link">${escapeHtml(team.name)}</a></h3>
            <a class="text-link" href="${escapeHtml(btvTarget.href)}" target="_blank" rel="noopener noreferrer"
               aria-label="${btvTarget.isDirect ? 'BTV-Tabelle und Spielplan' : 'BTV-Vereinsübersicht'} ${escapeHtml(team.name)} – ${escapeHtml(activeCode)} öffnen">${btvTarget.isDirect ? 'BTV Tabelle / Spielplan ↗' : 'BTV Vereinsübersicht ↗'}</a>
            ${!btvTarget.isDirect ? '<small class="muted">Direkter Gruppenlink noch nicht bestätigt</small>' : ''}
          </div>
          <p class="muted">${escapeHtml([ts.league, ts.group_name].filter(Boolean).join(' · ') || 'TSV Feldkirchen Tennis')}</p>
          ${featured ? `
            <div class="team-overview-next ${isLive ? 'is-live' : ''}">
              <span class="status-pill ${isLive ? 'live' : ''}">${isLive ? 'LIVE' : 'Nächstes Spiel'}</span>
              <strong>gegen ${escapeHtml(featured.opponent)}</strong>
              <small>${escapeHtml(formatDateTime(featured.starts_at))} · ${featured.is_home ? 'Heimspiel' : 'Auswärtsspiel'}${isLive ? ` · ${clubScore ?? 0} : ${otherScore ?? 0}` : ''}</small>
              ${matchVenueInfo(featured)}
              ${matchRouteButton(featured)}
              ${isLive ? `<a href="/live/?match=${encodeURIComponent(featured.id)}">Zum Liveticker</a>` : ''}
            </div>` : '<p class="muted">Derzeit kein nächstes Punktspiel eingetragen.</p>'}
          <div class="actions"><a class="button" href="${detailUrl}">Mannschaft öffnen</a><a class="button ghost" href="${escapeHtml(btvTarget.href)}" target="_blank" rel="noopener noreferrer">${btvTarget.isDirect ? 'BTV Gruppe ↗' : 'BTV Verein ↗'}</a><a class="button ghost" href="${escapeHtml(tennisDeTarget.href)}" target="_blank" rel="noopener noreferrer" aria-label="${tennisDeTarget.isDirect ? 'Offizielles tennis.de Mannschaftsporträt' : 'Offizielle tennis.de Mannschaftssuche für TSV Feldkirchen'} – ${escapeHtml(team.name)} – ${escapeHtml(activeCode)}">${tennisDeTarget.isDirect ? 'tennis.de Portrait ↗' : 'tennis.de Team suchen ↗'}</a></div>
        </article>`;
    }).join('');
  };

  applyUrlState();
  nav.addEventListener('click', (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-season]');
    if (!button || !nav.contains(button) || button.dataset.season === activeCode) return;
    activeCode = button.dataset.season || 'sommer-2026';
    activeCategory = '';
    setUrlState();
    render();
  });
  categoryTarget.addEventListener('click', (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-category]');
    if (!button || !categoryTarget.contains(button) || button.dataset.category === activeCategory) return;
    activeCategory = button.dataset.category || '';
    setUrlState();
    render();
  });
  window.addEventListener('popstate', () => { applyUrlState(); render(); });
  render();
}

export async function loadTeamDetail(slug: string) {
  watchPublicContent('#team-header');
  watchPublicContent('#team-roster');
  watchPublicContent('#team-matches');
  watchPublicContent('#team-season');
  watchPublicContent('#team-standings');
  const root = document.querySelector<HTMLElement>('[data-team-slug]');
  if (!root) return;
  const reference = await refs();
  const verifiedBtv = new Map<string, string>(reference.btvLinks.map((link: Row) => [link.team_season_id, link.btv_url]));
  const team = reference.teams.find((t: Row) => t.slug === slug);
  if (!team) {
    root.innerHTML = '<div class="card"><h1>Mannschaft nicht gefunden</h1></div>';
    return;
  }

  const teamSeasons = reference.teamSeasons
    .filter((ts: Row) => ts.team_id === team.id && ts.is_published &&
      reference.seasons.some((s: Row) => s.id === ts.season_id && s.is_published !== false))
    .sort((a: Row, b: Row) => {
      const as = reference.seasons.find((s: Row) => s.id === a.season_id);
      const bs = reference.seasons.find((s: Row) => s.id === b.season_id);
      return (as?.display_order ?? 100) - (bs?.display_order ?? 100);
    });
  const requestedSeason = new URLSearchParams(window.location.search).get('season');
  const current = teamSeasons.find((ts: Row) => {
    const season = reference.seasons.find((s: Row) => s.id === ts.season_id);
    return ts.season_id === requestedSeason || season?.code === requestedSeason;
  }) ?? teamSeasons.find((ts: Row) =>
    reference.seasons.find((season: Row) => season.id === ts.season_id)?.is_current)
    ?? teamSeasons[0];
  // Der Gruppen-Breadcrumb führt zur Mannschaftsübersicht mit derselben
  // Saison wie die gerade betrachtete Mannschaft.
  const currentSeasonCode = reference.seasons.find((s: Row) => s.id === current?.season_id)?.code;
  const groupBreadcrumb = root.querySelector<HTMLAnchorElement>('.breadcrumbs a[href*="category="]');
  if (groupBreadcrumb && currentSeasonCode) {
    const url = new URL(groupBreadcrumb.href);
    url.searchParams.set('season', currentSeasonCode);
    groupBreadcrumb.href = `${url.pathname}${url.search}${url.hash}`;
  }
  const detailNav = document.querySelector<HTMLElement>('#team-season-nav');
  if (detailNav) {
    detailNav.innerHTML = teamSeasons.map((ts: Row) => {
      const season = reference.seasons.find((row: Row) => row.id === ts.season_id);
      const active = ts.id === current?.id;
      return `<button type="button" class="teams-category-chip ${active ? 'is-active' : ''}" data-detail-season="${escapeHtml(season?.code || season?.id || '')}" aria-pressed="${active}">${escapeHtml(season?.name || 'Saison')}</button>`;
    }).join('') || '<p class="muted">Für dieses Team gibt es noch keine bestätigte Saison.</p>';
    detailNav.addEventListener('click', (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-detail-season]');
      if (!button || !detailNav.contains(button)) return;
      const url = new URL(window.location.href);
      url.searchParams.set('season', button.dataset.detailSeason || '');
      window.location.assign(url.toString());
    });
  }

  const tennisDeTarget = tennisDeTeamDestination(current);
  const btvTarget = officialBtvTeamDestination(verifiedBtv.get(current?.id) === current?.btv_url ? current?.btv_url : null);
  const head = document.querySelector<HTMLElement>('#team-header');
  if (head) head.innerHTML = `
    <section class="hero">
      <div><p class="eyebrow">Mannschaft</p><h1>${escapeHtml(team.name)}</h1><p class="hero__lead">${escapeHtml(team.description || [current?.league, current?.group_name].filter(Boolean).join(' · ') || 'TSV Feldkirchen Tennis')}</p><div class="actions">${current ? `<a class="button" href="${escapeHtml(btvTarget.href)}" target="_blank" rel="noopener noreferrer">${btvTarget.isDirect ? 'BTV Spielplan ↗' : 'BTV Vereinsübersicht ↗'}</a>` : ''}${current ? `<a class="button ghost" href="${escapeHtml(tennisDeTarget.href)}" target="_blank" rel="noopener noreferrer">${tennisDeTarget.isDirect ? 'tennis.de Mannschaftsporträt ↗' : 'tennis.de Mannschaftssuche ↗'}</a>` : ''}<a class="button secondary" href="${escapeHtml(calendarFeedUrl({team: slug}))}">Kalender abonnieren</a></div></div>
      <div class="card"><img src="${escapeHtml(mediaUrl(current?.team_image_path || team.image_path) || teamFallbackImage(team))}" alt="Mannschaftsfoto ${escapeHtml(team.name)}" /></div>
    </section>
  `;

  const seasonTarget = document.querySelector<HTMLElement>('#team-season');
  if (seasonTarget) seasonTarget.innerHTML = teamSeasons.map((ts: Row) => {
    const season = reference.seasons.find((s: Row) => s.id === ts.season_id);
    return `<p><strong>${escapeHtml(season?.name ?? '')}</strong><br><span class="muted">${escapeHtml([ts.league, ts.group_name].filter(Boolean).join(' · '))}</span></p>`;
  }).join('') || '<p class="muted">Noch keine Saisoninformationen.</p>';

  if (!current) return;

  const teamSeasonIds = teamSeasons.map((row: Row) => row.id);
  const [{ data: links }, { data: matches }, { data: allTeamMatches }, { data: news }, { data: galleries }, standingsResult] = await Promise.all([
    supabase.from('team_players').select('*').eq('team_season_id', current.id).eq('public_visible', true).order('is_captain', { ascending: false }).order('sort_order'),
    supabase.from('matches').select('*').eq('team_season_id', current.id).eq('is_published', true).order('starts_at'),
    teamSeasonIds.length
      ? supabase.from('matches').select('*').in('team_season_id', teamSeasonIds).eq('is_published', true).order('starts_at')
      : Promise.resolve({ data: [] }),
    supabase.from('news').select('*').eq('team_id', team.id).eq('status', 'published').order('published_at', { ascending: false }),
    supabase.from('galleries').select('*').eq('team_id', team.id).eq('published', true).order('created_at', { ascending: false }),
    supabase.from('team_standings').select('rank,team_name,club_code,standing_text,source_url,synced_at').eq('team_season_id', current.id).order('rank'),
  ]);

  const standingsTarget = document.querySelector<HTMLElement>('#team-standings');
  if (standingsTarget) {
    const standings = standingsResult.data ?? [];
    const sourceUrl = standings[0]?.source_url;
    const syncedAt = standings[0]?.synced_at;
    const standingValues = (value: unknown) => {
      const parts = typeof value === 'string' ? value.trim().split(/\s+/).slice(0, 5) : [];
      return parts.length === 5 ? parts : ['–', '–', '–', '–', '–'];
    };
    standingsTarget.innerHTML = standings.length ? `
      <p class="team-standings-scroll-hint">← Tabelle seitlich wischen →</p>
      <div class="table-wrap" tabindex="0" role="region" aria-label="BTV-Gruppentabelle seitlich scrollbar">
        <table class="data-table team-standings-table">
          <thead><tr><th scope="col">Rang</th><th scope="col">Mannschaft</th><th scope="col">Beg.</th><th scope="col">Punkte</th><th scope="col">Matches</th><th scope="col">Sätze</th><th scope="col">Spiele</th></tr></thead>
          <tbody>${standings.map((row: Row) => {
            const values = standingValues(row.standing_text);
            return `
            <tr class="${row.club_code === '01012' ? 'is-tsv' : ''}">
              <td><strong>${row.rank}</strong></td>
              <td>${escapeHtml(row.team_name)}${row.club_code === '01012' ? ' <span class="status-pill">TSV</span>' : ''}</td>
              ${values.map(value => `<td class="team-standings-number">${escapeHtml(value)}</td>`).join('')}
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <p class="match-meta">Amtlicher BTV-Stand${syncedAt ? ` · aktualisiert ${escapeHtml(formatDateTime(syncedAt))}` : ''}${sourceUrl ? ` · <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Quelle ↗</a>` : ''}</p>`
      : `<p class="muted">Für diese Saison ist die amtliche Tabelle beim BTV derzeit nicht abrufbar.</p><p><a class="text-link" href="${escapeHtml(btvTarget.href)}" target="_blank" rel="noopener noreferrer">BTV-Gruppe direkt öffnen ↗</a></p>`;
  }

  const playerIds = (links ?? []).map((row: Row) => row.player_id);
  const players = playerIds.length ? (await supabase.from('players').select('*').in('id', playerIds)).data ?? [] : [];
  const playerMap = byId(players);
  const roster = document.querySelector<HTMLElement>('#team-roster');
  if (roster) roster.innerHTML = links?.length ? `
    <div class="roster-grid">
      ${links.map((link: Row) => {
        const player = playerMap.get(link.player_id);
        if (!player) return '';
        const photo = player.photo_path
          ? `<img class="player-card__photo" src="${escapeHtml(mediaUrl(player.photo_path))}" alt="${escapeHtml(player.display_name)}" loading="lazy" />`
          : `<span class="player-card__placeholder" aria-hidden="true">${escapeHtml(initials(player.display_name))}</span>`;
        return `<article class="player-card">
          ${photo}
          <div>
            <strong>${escapeHtml(player.display_name)}</strong>
            ${link.is_captain ? '<div class="match-meta">Mannschaftsführung</div>' : ''}
          </div>
        </article>`;
      }).join('')}
    </div>`
    : '<p class="muted">Der öffentliche Kader wird noch gepflegt.</p>';

  const allMatchesForTeam = matches ?? []; // Never mix seasons in a single team's live/statistics views.
  const liveStates = allMatchesForTeam.length
    ? (await supabase.from('match_live_state').select('*').in('match_id', allMatchesForTeam.map((m: Row) => m.id))).data ?? []
    : [];

  const statsTarget = document.querySelector<HTMLElement>('#team-stats');
  if (statsTarget) {
    const seasonMatches = matches ?? [];
    const seasonLiveMap = new Map(liveStates.map((state: Row) => [state.match_id, state]));
    const finished = seasonMatches.filter((m: Row) =>
      seasonLiveMap.get(m.id)?.status === 'finished' || officialBtvScore(m));
    const results = finished.map((m: Row) => {
      const state = seasonLiveMap.get(m.id);
      const official = officialBtvScore(m);
      const useLive = state?.status === 'finished';
      const homeScore = useLive ? Number(state?.home_score ?? 0) : Number(official?.home ?? 0);
      const awayScore = useLive ? Number(state?.away_score ?? 0) : Number(official?.away ?? 0);
      const our = m.is_home ? homeScore : awayScore;
      const rival = m.is_home ? awayScore : homeScore;
      return Math.sign(our - rival);
    });
    const won = results.filter(n => n > 0).length;
    const drawn = results.filter(n => n === 0).length;
    const lost = results.filter(n => n < 0).length;
    const home = seasonMatches.filter((m: Row) => m.is_home).length;
    const away = seasonMatches.length - home;
    statsTarget.innerHTML = `<div class="phase8-stat-grid">
      <div><strong>${seasonMatches.length}</strong><span>Punktspiele</span></div>
      <div><strong>${home}</strong><span>Heimspiele</span></div>
      <div><strong>${away}</strong><span>Auswärtsspiele</span></div>
      <div><strong>${finished.length}</strong><span>Ergebnisse</span></div>
      </div><p class="muted">Offiziell bestätigte BTV-Ergebnisse und abgeschlossene TSV-Liveticker: ${won} Siege · ${drawn} Unentschieden · ${lost} Niederlagen.
      ${finished.length < seasonMatches.length ? 'Spiele ohne veröffentlichten Endstand werden nicht als 0:0 gewertet.' : ''}</p>
      ${current ? `<p><a href="${escapeHtml(btvTarget.href)}" class="text-link" target="_blank" rel="noopener noreferrer">${btvTarget.isDirect ? 'Offiziellen BTV-Spielplan und Tabellenstand ansehen ↗' : 'BTV-Vereinsübersicht öffnen (Gruppenlink prüfen) ↗'}</a></p>` : ''}`;
  }

  const nextMatchTarget = document.querySelector<HTMLElement>('#team-next-match');
  if (nextMatchTarget) {
    const now = Date.now();
    const liveMatch = allMatchesForTeam.find((match: Row) =>
      liveStates.find((state: Row) => state.match_id === match.id)?.status === 'live'
    );
    const upcomingMatch = allMatchesForTeam
      .filter((match: Row) => match.is_published !== false && new Date(match.starts_at).getTime() > now)
      .sort((a: Row, b: Row) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
    const featuredMatch = liveMatch ?? upcomingMatch;

    if (featuredMatch) {
      const state = liveStates.find((row: Row) => row.match_id === featuredMatch.id);
      const isLive = state?.status === 'live';
      const start = new Date(featuredMatch.starts_at);
      const dateLabel = new Intl.DateTimeFormat('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }).format(start);
      const timeLabel = new Intl.DateTimeFormat('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(start);
      const daysAway = Math.max(1, Math.ceil((start.getTime() - now) / 86400000));
      const countdown = isLive
        ? 'Jetzt live'
        : daysAway === 1
          ? 'Morgen'
          : daysAway <= 7
            ? `In ${daysAway} Tagen`
            : 'Nächstes Punktspiel';
      const leftTeam = featuredMatch.is_home ? team.name : featuredMatch.opponent;
      const rightTeam = featuredMatch.is_home ? featuredMatch.opponent : team.name;
      const detailUrl = `/spiel/?match=${encodeURIComponent(featuredMatch.id)}`;

      nextMatchTarget.classList.remove('hidden');
      nextMatchTarget.innerHTML = `
        <article class="next-match-card ${isLive ? 'next-match-card--live' : ''}">
          <div class="next-match-card__top">
            <div>
              <span class="next-match-card__badge">${isLive ? '● LIVE' : escapeHtml(countdown)}</span>
              <p class="eyebrow">${featuredMatch.is_home ? 'Heimspiel' : 'Auswärtsspiel'}</p>
            </div>
            <div class="next-match-card__date">
              <strong>${escapeHtml(dateLabel)}</strong>
              <span>${escapeHtml(timeLabel)} Uhr</span>
            </div>
          </div>
          <a class="next-match-card__teams" href="${detailUrl}">
            <div class="${featuredMatch.is_home ? 'is-tsv' : ''}">${featuredMatch.is_home ? `<img class="next-match-tsv-logo" src="${escapeHtml(mediaUrl('branding/tennis-logo.png'))}" alt="TSV Feldkirchen Tennis" />` : ''}<span>${escapeHtml(leftTeam)}</span></div>
            <strong>VS</strong>
            <div class="${!featuredMatch.is_home ? 'is-tsv' : ''}">${!featuredMatch.is_home ? `<img class="next-match-tsv-logo" src="${escapeHtml(mediaUrl('branding/tennis-logo.png'))}" alt="TSV Feldkirchen Tennis" />` : ''}<span>${escapeHtml(rightTeam)}</span></div>
          </a>
          <div class="next-match-card__bottom">
            ${matchVenueInfo(featuredMatch)}
            <div class="actions">
              ${matchRouteButton(featuredMatch)}
              <a class="button secondary" href="${detailUrl}">Spiel öffnen</a>
              ${isLive ? `<a class="button" href="/live/?match=${encodeURIComponent(featuredMatch.id)}">Liveticker</a>` : ''}
            </div>
          </div>
        </article>`;
    } else {
      nextMatchTarget.classList.add('hidden');
      nextMatchTarget.innerHTML = '';
    }
  }

  const matchGalleryIds = new Set(
    (galleries ?? []).filter((gallery: Row) => gallery.match_id).map((gallery: Row) => gallery.match_id)
  );
  const matchTarget = document.querySelector<HTMLElement>('#team-matches');
  if (matchTarget) {
    const now = Date.now();
    const liveMatches = (matches ?? []).filter((m: Row) => liveStates.find((s: Row) => s.match_id === m.id)?.status === 'live');
    const futureMatches = (matches ?? []).filter((m: Row) => new Date(m.starts_at).getTime() >= now && !liveMatches.includes(m));
    const playedMatches = (matches ?? []).filter((m: Row) => new Date(m.starts_at).getTime() < now && !liveMatches.includes(m)).reverse();
    const group = (title: string, items: Row[]) => items.length
      ? `<section class="team-match-group"><h3>${escapeHtml(title)} <small>(${items.length})</small></h3><div class="match-list">${items.map((m: Row) => matchRow(m, reference, liveStates, matchGalleryIds)).join('')}</div></section>`
      : '';
    matchTarget.innerHTML = group('Jetzt LIVE', liveMatches) + group('Kommende Spiele', futureMatches) + group('Vergangene Ergebnisse', playedMatches)
      || '<p class="muted">Noch keine Spiele eingetragen.</p>';
  }

  const newsTarget = document.querySelector<HTMLElement>('#team-news');
  if (newsTarget) newsTarget.innerHTML = news?.length ? news.map((n: Row) => `<div class="news-row"><div><strong>${escapeHtml(n.title)}</strong><p class="muted">${escapeHtml(n.excerpt || '')}</p></div></div>`).join('') : '<p class="muted">Noch keine Mannschaftsberichte.</p>';

  const galleryTarget = document.querySelector<HTMLElement>('#team-gallery');
  const generalGalleries = (galleries ?? []).filter((gallery: Row) => !gallery.match_id);
  if (galleryTarget && generalGalleries.length) {
    const galleryIds = generalGalleries.map((g: Row) => g.id);
    const items = (await supabase.from('gallery_items').select('*').in('gallery_id', galleryIds).order('sort_order')).data ?? [];
    galleryTarget.classList.add('gallery-grid');
    galleryTarget.innerHTML = items.slice(0, 12).map((item: Row) => `<figure class="gallery-item"><img src="${escapeHtml(mediaUrl(item.storage_path))}" alt="${escapeHtml(item.alt_text || team.name)}" loading="lazy" /><figcaption class="muted">${escapeHtml(item.caption || '')}</figcaption></figure>`).join('');
  } else if (galleryTarget) {
    galleryTarget.classList.remove('gallery-grid');
    galleryTarget.innerHTML = '<p class="muted">Noch keine allgemeinen Mannschaftsbilder veröffentlicht. Bilder einzelner Punktspiele findest du direkt beim jeweiligen Spiel.</p>';
  }

  await renderSponsorPlacements('#team-sponsors', ['team'], { teamId: team.id });
}

export async function loadMatchDetail(matchId: string | null) {
  watchPublicContent('#match-detail-head');
  watchPublicContent('#match-detail-news');
  watchPublicContent('#match-detail-score');
  watchPublicContent('#match-detail-encounters');
  watchPublicContent('#match-detail-timeline');
  watchPublicContent('#match-detail-gallery');
  const root = document.querySelector<HTMLElement>('#match-detail-root');
  const head = document.querySelector<HTMLElement>('#match-detail-head');
  const scoreTarget = document.querySelector<HTMLElement>('#match-detail-score');
  const encounterTarget = document.querySelector<HTMLElement>('#match-detail-encounters');
  const galleryTarget = document.querySelector<HTMLElement>('#match-detail-gallery');
  const reportTarget = document.querySelector<HTMLElement>('#match-detail-news');
  if (!root || !head || !scoreTarget || !encounterTarget || !galleryTarget) return;

  if (!matchId) {
    head.innerHTML = '<div class="card"><h1>Kein Spiel ausgewählt</h1><p><a href="/termine/">Zum Spielplan</a></p></div>';
    return;
  }

  const reference = await refs();
  const [{ data: match }, { data: liveState }, { data: encounters }, { data: galleries }] = await Promise.all([
    supabase.from('matches').select('*').eq('id', matchId).eq('is_published', true).maybeSingle(),
    supabase.from('match_live_state').select('*').eq('match_id', matchId).maybeSingle(),
    supabase.from('match_encounters').select('*').eq('match_id', matchId).order('sort_order').order('position'),
    supabase.from('galleries').select('*').eq('match_id', matchId).eq('published', true).order('created_at', { ascending: false }),
  ]);

  if (!match) {
    head.innerHTML = '<div class="card"><h1>Spiel nicht gefunden</h1></div>';
    return;
  }

  const { team, ts, season } = matchContext(match, reference);
  const clubName = team?.name ?? 'TSV Feldkirchen';
  const leftTeam = match.is_home ? clubName : match.opponent;
  const rightTeam = match.is_home ? match.opponent : clubName;
  const status = liveState?.status ?? 'scheduled';
  const officialScore = status === 'scheduled' ? officialBtvScore(match) : null;
  const homeScore = officialScore?.home ?? liveState?.home_score ?? 0;
  const awayScore = officialScore?.away ?? liveState?.away_score ?? 0;
  const clubScore = match.is_home ? homeScore : awayScore;
  const opponentScore = match.is_home ? awayScore : homeScore;
  const detailDate = formatDateTime(match.starts_at);

  head.innerHTML = `
    <div class="match-detail-hero">
      <div>
        <p class="eyebrow">${escapeHtml([season?.name, ts?.league].filter(Boolean).join(' · ') || 'Punktspiel')}</p>
        <div class="match-detail-titleline"><img src="${escapeHtml(mediaUrl('branding/tennis-logo.png'))}" alt="TSV Feldkirchen Tennis" /><h1>${escapeHtml(leftTeam)} <span>vs.</span> ${escapeHtml(rightTeam)}</h1></div>
        <p class="hero__lead">${escapeHtml(detailDate)} · ${match.is_home ? 'Heimspiel' : 'Auswärtsspiel'}</p>
        ${matchVenueInfo(match)}
        <div class="actions">
          ${matchRouteButton(match)}
          <a class="button secondary" href="/mannschaften/${escapeHtml(team?.slug || '')}/">Zur Mannschaft</a>
          ${status === 'live' ? `<a class="button" href="/live/?match=${encodeURIComponent(match.id)}">Liveticker öffnen</a>` : ''}
          ${match.external_url ? `<a class="button ghost" href="${escapeHtml(match.external_url)}" target="_blank" rel="noreferrer">BTV / Details ↗</a>` : ''}
        </div>
      </div>
    </div>`;

  scoreTarget.innerHTML = status !== 'scheduled' || officialScore
    ? `<div class="match-detail-score"><span class="status-pill ${status === 'live' ? 'live' : ''}">${status === 'live' ? 'LIVE' : status === 'finished' ? 'Beendet' : 'Offizielles BTV-Ergebnis'}</span><strong>${clubScore} : ${opponentScore}</strong><span>aus Sicht des TSV</span></div>`
    : '<div class="match-detail-score"><span class="status-pill">Geplant</span><strong>– : –</strong><span>Kein offizieller Endstand vorhanden</span></div>';

  const encounterRows = encounters ?? [];
  const renderDetailEncounter = (encounter: Row) => {
    const tsvNames = [encounter.tsv_player_1_name, encounter.tsv_player_2_name].filter(Boolean).join(' / ') || 'Aufstellung folgt';
    const opponentSlots = [encounter.opponent_slot_1, encounter.opponent_slot_2]
      .filter((value) => value != null)
      .map((value) => `Gegner ${value}`)
      .join(' / ') || (encounter.discipline === 'singles' ? `Gegner ${encounter.position}` : 'Doppelaufstellung folgt');

    const tsvSide = `
      <div class="match-detail-encounter-side is-tsv">
        <img src="${escapeHtml(mediaUrl('branding/tennis-logo.png'))}" alt="" />
        <div><span>TSV Feldkirchen</span><strong>${escapeHtml(tsvNames)}</strong></div>
      </div>`;
    const opponentSide = `
      <div class="match-detail-encounter-side">
        <span class="live-opponent-mark">G</span>
        <div><span>${escapeHtml(match.opponent)}</span><strong>${escapeHtml(opponentSlots)}</strong></div>
      </div>`;

    return `
      <article class="match-detail-encounter ${encounter.status === 'live' ? 'is-live' : ''}">
        <div class="match-detail-encounter__head">
          <strong>${encounter.discipline === 'singles' ? 'Einzel' : 'Doppel'} ${encounter.position}</strong>
          <span class="status-pill ${encounter.status === 'live' ? 'live' : ''}">${encounter.status === 'live' ? 'LIVE' : encounter.status === 'finished' ? 'Beendet' : 'Geplant'}</span>
        </div>
        <div class="match-detail-encounter__matchup">
          ${match.is_home ? tsvSide : opponentSide}
          <div class="match-detail-encounter__result"><span>Ergebnis</span><strong>${escapeHtml(encounter.result_text || '–')}</strong></div>
          ${match.is_home ? opponentSide : tsvSide}
        </div>
      </article>`;
  };

  encounterTarget.innerHTML = encounterRows.length
    ? `
      <div class="page-head"><div><p class="eyebrow">Spieltag</p><h2>Einzel & Doppel</h2></div><span class="status-pill">${match.lineup_format === '4_2' ? '4 + 2' : '6 + 3'}</span></div>
      <div class="match-detail-encounter-groups">
        <section><h3>Einzel</h3><div class="match-detail-encounter-list">${encounterRows.filter((row: Row) => row.discipline === 'singles').map(renderDetailEncounter).join('')}</div></section>
        <section><h3>Doppel</h3><div class="match-detail-encounter-list">${encounterRows.filter((row: Row) => row.discipline === 'doubles').map(renderDetailEncounter).join('')}</div></section>
      </div>`
    : '<div class="empty-gallery"><p class="eyebrow">Spieltag</p><h2>Aufstellung folgt</h2><p class="muted">Einzel und Doppel werden vor dem Spieltag eingetragen.</p></div>';

  if (galleries?.length) {
    const galleryIds = galleries.map((gallery: Row) => gallery.id);
    const { data: items } = await supabase
      .from('gallery_items')
      .select('*')
      .in('gallery_id', galleryIds)
      .order('sort_order');

    const galleryMap = new Map(galleries.map((gallery: Row) => [gallery.id, gallery]));
    galleryTarget.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Spieltag in Bildern</p><h2>${galleries.length === 1 ? escapeHtml(galleries[0].title) : 'Galerien zum Punktspiel'}</h2></div>
        <span class="status-pill">${(items ?? []).length} Bilder</span>
      </div>
      <div class="gallery-grid">
        ${(items ?? []).map((item: Row) => {
          const gallery = galleryMap.get(item.gallery_id);
          return `<figure class="gallery-item">
            <img src="${escapeHtml(mediaUrl(item.storage_path))}" alt="${escapeHtml(item.alt_text || gallery?.title || clubName)}" loading="lazy" />
            <figcaption class="muted">${escapeHtml(item.caption || gallery?.title || '')}</figcaption>
          </figure>`;
        }).join('')}
      </div>`;
  } else {
    galleryTarget.innerHTML = '<div class="empty-gallery"><p class="eyebrow">Spieltag in Bildern</p><h2>Noch keine Galerie</h2><p class="muted">Sobald Bilder zu diesem Punktspiel veröffentlicht wurden, erscheinen sie hier.</p></div>';
  }

  if (reportTarget) {
    const { data: reports, error: reportError } = await supabase.from('news')
      .select('id,title,excerpt,body,published_at').eq('match_id', matchId)
      .eq('status', 'published').order('published_at', { ascending: false });
    if (reportError) reportTarget.innerHTML = '<p class="muted">Spielberichte sind gerade nicht abrufbar.</p>';
    else if (reports?.length) reportTarget.innerHTML = `<p class="eyebrow">Aus dem Vereinsleben</p><h2>Spielberichte</h2>${reports.map((article: Row) =>
      `<article class="match-report"><h3>${escapeHtml(article.title)}</h3><p class="muted">${escapeHtml(article.excerpt || '')}</p>
      <details><summary>Spielbericht lesen</summary><p class="report-body">${escapeHtml(article.body || '')}</p></details></article>`
    ).join('')}`;
    else reportTarget.innerHTML = '<p class="eyebrow">Spielberichte</p><p class="muted">Zu diesem Spiel wurde noch kein Bericht veröffentlicht.</p>';
  }
  await renderSponsorPlacements('#match-detail-sponsor', ['match'], { teamId: team?.id, matchId });
  const timelineTarget = document.querySelector<HTMLElement>('#match-detail-timeline');
  if (timelineTarget) {
    const { data: entries, error: tickerError } = await supabase.from('live_ticker_entries')
      .select('*').eq('match_id', matchId).is('deleted_at', null).order('created_at', { ascending: false }).limit(25);
    timelineTarget.innerHTML = `<div class="page-head"><div><p class="eyebrow">Spielverlauf</p><h2>Tickermeldungen</h2></div>
      <a class="button ghost" href="/live/?match=${encodeURIComponent(matchId)}">Ticker-Archiv öffnen</a></div>` +
      (tickerError ? '<p class="muted">Tickermeldungen sind momentan nicht verfügbar.</p>'
      : entries?.length ? entries.map((entry: Row) => `<div class="timeline-row"><div><strong>${escapeHtml(entry.message)}</strong>
        <div class="match-meta">${escapeHtml(formatDateTime(entry.created_at))}</div></div></div>`).join('')
      : '<p class="muted">Noch keine Tickermeldungen zu diesem Spiel.</p>');
  }
  if (status === 'live') window.setTimeout(() => loadMatchDetail(matchId), 30000);

}

export async function loadCalendar() {
  const list = document.querySelector<HTMLElement>('#calendar-list');
  const grid = document.querySelector<HTMLElement>('#calendar-month-grid');
  const monthTitle = document.querySelector<HTMLElement>('#calendar-month-title');
  const dayHeading = document.querySelector<HTMLElement>('#calendar-day-heading');
  const dayCount = document.querySelector<HTMLElement>('#calendar-day-count');
  const dayList = document.querySelector<HTMLElement>('#calendar-day-list');
  const dayModal = document.querySelector<HTMLDialogElement>('#calendar-day-modal');
  const modalHeading = document.querySelector<HTMLElement>('#calendar-modal-heading');
  const modalCount = document.querySelector<HTMLElement>('#calendar-modal-count');
  const modalList = document.querySelector<HTMLElement>('#calendar-modal-list');
  const agenda = document.querySelector<HTMLElement>('#calendar-day-agenda');
  const monthBoard = document.querySelector<HTMLElement>('#calendar-month-board');
  const returnToMonth = document.querySelector<HTMLButtonElement>('#calendar-back-to-month');
  const nextList = document.querySelector<HTMLElement>('#calendar-next-list');
  const statusTarget = document.querySelector<HTMLElement>('#calendar-data-status');
  const teamSelect = document.querySelector<HTMLSelectElement>('#calendar-team');
  const categorySelect = document.querySelector<HTMLSelectElement>('#calendar-category');
  const kindSelect = document.querySelector<HTMLSelectElement>('#calendar-kind');
  const rangeSelect = document.querySelector<HTMLSelectElement>('#calendar-range');
  const subscriptions = document.querySelector<HTMLElement>('#calendar-subscriptions');
  const viewSelect = document.querySelector<HTMLSelectElement>('#calendar-view');
  const favoriteSelect = document.querySelector<HTMLSelectElement>('#calendar-favorite');
  const favoriteStatus = document.querySelector<HTMLElement>('#calendar-favorite-status');
  const weekRange = document.querySelector<HTMLElement>('#calendar-week-range');
  if (!list || !grid || !monthTitle || !dayHeading || !dayCount || !dayList || !nextList || !teamSelect || !categorySelect || !kindSelect || !subscriptions || !statusTarget) return;

  const zone = 'Europe/Berlin';
  const dayParts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: '2-digit', month: '2-digit', year: 'numeric' });
  const monthFormatter = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const fullDayFormatter = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shortFormatter = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', day: 'numeric', month: 'short' });
  const dateKey = (value: string | Date) => {
    const parts = dayParts.formatToParts(new Date(value));
    const get = (type: string) => parts.find(part => part.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const dateAt = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12));
  };
  const isoAt = (date: Date) => date.toISOString().slice(0, 10);
  const startToday = dateKey(new Date());
  let selectedDay = startToday;
  let [viewYear, viewMonth] = selectedDay.split('-').map(Number);
  let reference: Awaited<ReturnType<typeof refs>> = { seasons: [], categories: [], teams: [], teamSeasons: [], btvLinks: [] };
  let matches: Row[] = [];
  let events: Row[] = [];
  let liveStates: Row[] = [];
  let ready = false;
  let fetchError = false;
  const favoriteKey = 'tsv-tennis-favorite-team';
  let favoriteSlug = '';
  try { favoriteSlug = localStorage.getItem(favoriteKey) || ''; } catch { /* Privatmodus ohne Speicherzugriff */ }
  const weekdayMs = 86400000;

  type CalendarMarker = 'men' | 'women' | 'youth' | 'event' | 'other';
  const markerOrder: CalendarMarker[] = ['men', 'women', 'youth', 'event', 'other'];
  const markerLabels: Record<CalendarMarker, string> = {
    men: 'Herren',
    women: 'Damen',
    youth: 'Jugend',
    event: 'Veranstaltung',
    other: 'Weitere Punktspiele',
  };
  const matchMarker = (team: Row | undefined): CalendarMarker => {
    const category = reference.categories.find((item: Row) => item.id === team?.category_id);
    const kind = team?.gender || category?.slug;
    if (kind === 'men' || kind === 'herren') return 'men';
    if (kind === 'women' || kind === 'damen') return 'women';
    if (kind === 'youth' || kind === 'jugend') return 'youth';
    return 'other';
  };

  const filteredEntries = () => {
    const teamId = teamSelect.value, categoryId = categorySelect.value, kind = kindSelect.value;
    const matchesFiltered = (kind === 'events' ? [] : matches).filter(m => {
      const { team } = matchContext(m, reference);
      return (!teamId || team?.id === teamId) && (!categoryId || team?.category_id === categoryId);
    }).map(m => {
      const { team } = matchContext(m, reference);
      return {
        id: m.id, endAt: m.ends_at || null, location: [m.venue_name, m.venue_address].filter(Boolean).join(', '),
        at: m.starts_at, key: dateKey(m.starts_at), kind: 'match', marker: matchMarker(team),
        title: `${team?.name || 'TSV Feldkirchen'} gegen ${m.opponent}`,
        href: `/spiel/?match=${encodeURIComponent(m.id)}`,
        html: matchRow(m, reference, liveStates),
      };
    });
    const eventsFiltered = (kind === 'matches' ? [] : events).filter(e => {
      if (teamId && e.team_id !== teamId) return false;
      if (categoryId) {
        const team = reference.teams.find(t => t.id === e.team_id);
        if (!team || team.category_id !== categoryId) return false;
      }
      return true;
    }).map(e => ({
      id: e.id, endAt: e.ends_at || null, location: e.location_name || '',
      at: e.starts_at, key: dateKey(e.starts_at), kind: 'event', marker: 'event' as CalendarMarker,
      title: e.title,
      href: '',
      html: `<div class="calendar-event-detail">
        <div><span class="calendar-event-type">Veranstaltung</span><strong>${escapeHtml(e.title)}</strong>
          <div class="match-meta">${e.all_day ? 'Ganztägig' : escapeHtml(formatDateTime(e.starts_at))} · ${escapeHtml(e.location_name || 'TSV Feldkirchen')}</div>
          ${e.description ? `<p class="muted">${escapeHtml(e.description)}</p>` : ''}
        </div></div>`,
    }));
    const range = rangeSelect?.value || 'all';
    const current = new Date();
    const currentKey = dateKey(current);
    const year = Number(currentKey.slice(0, 4));
    const firstYear = `${year}-01-01`, nextYear = `${year + 1}-01-01`;
    const last90 = dateKey(new Date(current.getTime() - 90 * 86400000));
    return [...matchesFiltered, ...eventsFiltered].filter(item => {
      if (range === 'upcoming') return item.key >= currentKey;
      if (range === 'year') return item.key >= firstYear && item.key < nextYear;
      if (range === 'recent') return item.key >= last90 && item.key <= currentKey;
      return true;
    }).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  };

  const render = () => {
    const entries = filteredEntries();
    const todayKey = dateKey(new Date());
    const weekMode = viewSelect?.value === 'week';
    const selectedDate = dateAt(selectedDay);
    const selectedWeekday = (selectedDate.getUTCDay() + 6) % 7;
    const monday = new Date(selectedDate.getTime() - selectedWeekday * weekdayMs);
    const firstWeekday = weekMode ? 0 : (new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    const cellCount = weekMode ? 7 : Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const monthStart = weekMode ? monday.getTime() : Date.UTC(viewYear, viewMonth - 1, 1);
    monthTitle.textContent = weekMode ? 'Kalenderwoche' : monthFormatter.format(new Date(Date.UTC(viewYear, viewMonth - 1, 1, 12)));
    if (weekRange) {
      weekRange.classList.toggle('hidden', !weekMode);
      const sunday = new Date(monday.getTime() + 6 * weekdayMs);
      weekRange.textContent = weekMode ? `${shortFormatter.format(monday)} – ${shortFormatter.format(sunday)}` : '';
    }
    const indexed = new Map<string, Record<CalendarMarker, number>>();
    entries.forEach(item => {
      const counts = indexed.get(item.key) || { men: 0, women: 0, youth: 0, event: 0, other: 0 };
      counts[item.marker] += 1;
      indexed.set(item.key, counts);
    });
    const cells: string[] = [];
    for (let index = 0; index < cellCount; index++) {
      const cellDate = new Date(monthStart + (index - firstWeekday) * 86400000);
      const key = isoAt(cellDate);
      const counts = indexed.get(key) || { men: 0, women: 0, youth: 0, event: 0, other: 0 };
      const count = markerOrder.reduce((total, marker) => total + counts[marker], 0);
      const outside = !weekMode && cellDate.getUTCMonth() !== viewMonth - 1;
      const today = key === todayKey, selected = key === selectedDay;
      const fullLabel = fullDayFormatter.format(cellDate);
      const categoryDescription = markerOrder.filter(marker => counts[marker] > 0)
        .map(marker => `${markerLabels[marker]}: ${counts[marker]}`).join(', ');
      const dots = markerOrder.filter(marker => counts[marker] > 0)
        .map(marker => `<i class="calendar-dot calendar-dot--${marker}"></i>`).join('');
      const dayLabel = `${fullLabel}${today ? ', heute' : ''}, ${categoryDescription || 'keine Termine'}`;
      cells.push(`<button type="button" class="calendar-day${outside ? ' calendar-day--outside' : ''}${today ? ' calendar-day--today' : ''}${selected ? ' calendar-day--selected' : ''}${count ? ' calendar-day--busy' : ''}" data-calendar-day="${key}" tabindex="${selected ? '0' : '-1'}" aria-label="${escapeHtml(dayLabel)}" aria-pressed="${selected ? 'true' : 'false'}" ${today ? 'aria-current="date"' : ''}>
        <span class="calendar-day__number">${cellDate.getUTCDate()}</span>
        <span class="calendar-day__dots" aria-hidden="true">${dots}</span>
        ${count ? `<small class="calendar-day__count">${count} ${count === 1 ? 'Termin' : 'Termine'}</small>` : ''}
      </button>`);
    }
    grid.innerHTML = cells.join('');
    const chosen = entries.filter(entry => entry.key === selectedDay);
    dayHeading.textContent = `${selectedDay === todayKey ? 'Heute · ' : ''}${fullDayFormatter.format(dateAt(selectedDay))}`;
    dayCount.textContent = !ready ? 'Termine werden geladen …' : fetchError ? 'Einige Termine sind momentan nicht abrufbar.' : chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'Termin' : 'Termine'} an diesem Tag` : 'Keine Termine für diesen Tag';
    dayList.innerHTML = !ready ? '<p class="muted">Die Termine werden ermittelt …</p>'
      : chosen.length ? chosen.map((item, index) => `<div class="calendar-day-entry"><span class="calendar-entry-type calendar-entry-type--${item.marker}"><i class="calendar-dot calendar-dot--${item.marker}" aria-hidden="true"></i>${escapeHtml(markerLabels[item.marker])}</span>${item.html}<button type="button" class="button ghost" data-calendar-save="${index}">Diesen Termin zu meinem Kalender hinzufügen (.ics)</button></div>`).join('')
      : `<div class="calendar-agenda-empty"><span aria-hidden="true">✦</span><strong>Hier ist noch nichts geplant.</strong><p class="muted">Wähle einen markierten Tag im Kalender oder entdecke die nächsten Termine.</p></div>`;
    // The modal reuses the same trusted, escaped match/event markup as the full agenda.
    // Interactive actions are delegated in both containers to preserve their behavior.
    if (modalHeading) modalHeading.textContent = dayHeading.textContent;
    if (modalCount) modalCount.textContent = dayCount.textContent;
    if (modalList) {
      modalList.innerHTML = dayList.innerHTML;
      // Keep the complete description in the detailed view, but make long
      // event descriptions compact in the modal with an accessible "Mehr →".
      modalList.querySelectorAll<HTMLElement>('.calendar-event-detail p.muted').forEach(description => {
        const fullText = description.textContent?.trim() || '';
        if (fullText.length <= 180) return;
        const excerpt = description.cloneNode(true) as HTMLElement;
        excerpt.classList.add('calendar-event-excerpt');
        const more = document.createElement('details');
        more.className = 'calendar-event-more';
        const toggle = document.createElement('summary');
        toggle.textContent = 'Mehr →';
        more.append(toggle);
        description.replaceWith(excerpt, more);
        more.append(description);
        more.addEventListener('toggle', () => {
          excerpt.hidden = more.open;
          toggle.textContent = more.open ? 'Weniger ↑' : 'Mehr →';
        });
      });
    }
    const coming = entries.filter(item => item.key >= todayKey).slice(0, 4);
    nextList.innerHTML = !ready ? '<p class="muted">Nächste Termine werden geladen …</p>'
      : coming.length ? coming.map(item => {
          const day = shortFormatter.format(dateAt(item.key));
          return `<div class="calendar-next-item"><span class="calendar-next-date">${escapeHtml(day)}</span><div>${item.href ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a>` : `<strong>${escapeHtml(item.title)}</strong>`}<small class="calendar-next-type"><i class="calendar-dot calendar-dot--${item.marker}" aria-hidden="true"></i>${escapeHtml(markerLabels[item.marker])}</small></div></div>`;
        }).join('')
      : '<p class="muted">Derzeit keine weiteren Termine angekündigt.</p>';

    if (ready) {
      const upcoming = entries.filter(item => item.key >= todayKey);
      const previous = entries.filter(item => item.key < todayKey).reverse();
      list.innerHTML = entries.length
        ? `<section class="calendar-time-group"><h3>Kommende Termine (${upcoming.length})</h3>${upcoming.length ? upcoming.map(item => item.html).join('') : '<p class="muted">Keine weiteren Termine angekündigt.</p>'}</section>
        ${previous.length ? `<details class="calendar-past"><summary>Vergangene Termine (${previous.length}) anzeigen</summary>${previous.map(item => item.html).join('')}</details>` : ''}`
        : '<p class="muted">Für diese Auswahl sind keine Termine eingetragen.</p>';
    }
    const params: Record<string, string> = {};
    if (kindSelect.value !== 'all') params.type = kindSelect.value;
    const teamOption = teamSelect.selectedOptions[0];
    const categoryOption = categorySelect.selectedOptions[0];
    if (teamSelect.value && teamOption?.dataset.slug) params.team = teamOption.dataset.slug;
    else if (categorySelect.value && categoryOption?.dataset.slug) params.category = categoryOption.dataset.slug;
    subscriptions.innerHTML = `<a class="button" href="${escapeHtml(calendarFeedUrl(params))}">Auswahl abonnieren</a>
      <a class="button secondary" href="${escapeHtml(calendarFeedUrl({ type: 'matches' }))}">Alle Punktspiele</a>
      <a class="button secondary" href="${escapeHtml(calendarFeedUrl({ type: 'events' }))}">Vereinstermine</a>`;
  };

  // Clicking a day opens an accessible native dialog with the same working
  // match, route and calendar-export actions as the expanded agenda.
  const scrollToCalendarElement = (element: HTMLElement | null) => {
    element?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };
  const chooseDay = (key: string, destination: 'modal' | 'agenda' | 'calendar' | 'none' = 'none') => {
    selectedDay = key;
    [viewYear, viewMonth] = key.split('-').map(Number);
    render();
    if (destination === 'calendar') {
      grid.querySelector<HTMLButtonElement>(`[data-calendar-day="${key}"]`)?.focus();
    } else if (destination === 'modal') {
      if (dayModal && !dayModal.open) dayModal.showModal();
    } else if (destination === 'agenda') {
      dayHeading.focus({ preventScroll: true });
      scrollToCalendarElement(agenda);
    }
  };
  const moveMonth = (amount: number) => {
    if (viewSelect?.value === 'week') {
      chooseDay(isoAt(new Date(dateAt(selectedDay).getTime() + amount * 7 * weekdayMs)));
    } else {
      const target = new Date(Date.UTC(viewYear, viewMonth - 1 + amount, 1, 12));
      chooseDay(isoAt(target));
    }
  };
  const icsEscape = (text: string) => text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const icsStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const handleCalendarSave = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-calendar-save]');
    if (!button) return;
    const index = Number(button.dataset.calendarSave);
    const item = filteredEntries().filter(entry => entry.key === selectedDay)[index];
    if (!item) return;
    const start = new Date(item.at);
    const end = item.endAt ? new Date(item.endAt) : new Date(start.getTime() + 2 * 3600000);
    const rows = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TSV Feldkirchen Tennis//DE',
      'BEGIN:VEVENT', `UID:${item.id}@tsvfeldkirchen.de`, `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
      `SUMMARY:${icsEscape(item.title)}`, `LOCATION:${icsEscape(item.location)}`,
      'END:VEVENT', 'END:VCALENDAR', '',
    ];
    const url = URL.createObjectURL(new Blob([rows.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'tsv-termin.ics'; document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  dayList.addEventListener('click', handleCalendarSave);
  modalList?.addEventListener('click', handleCalendarSave);
  // Built-in <dialog> also closes on Escape and restores keyboard focus.
  const closeDayModal = () => { if (dayModal?.open) dayModal.close(); };
  document.querySelector('#calendar-modal-close')?.addEventListener('click', closeDayModal);
  document.querySelector('#calendar-modal-dismiss')?.addEventListener('click', closeDayModal);
  document.querySelector('#calendar-modal-details')?.addEventListener('click', () => {
    closeDayModal();
    dayHeading.focus({ preventScroll: true });
    scrollToCalendarElement(agenda);
  });
  dayModal?.addEventListener('click', (event) => {
    if (event.target === dayModal) closeDayModal();
  });
  document.querySelector('#calendar-prev')?.addEventListener('click', () => moveMonth(-1));
  document.querySelector('#calendar-next')?.addEventListener('click', () => moveMonth(1));
  document.querySelector('#calendar-today')?.addEventListener('click', () => chooseDay(dateKey(new Date()), 'modal'));
  returnToMonth?.addEventListener('click', () => {
    grid.querySelector<HTMLButtonElement>(`[data-calendar-day="${selectedDay}"]`)?.focus({ preventScroll: true });
    scrollToCalendarElement(monthBoard);
  });
  grid.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('button[data-calendar-day]');
    if (button?.dataset.calendarDay) chooseDay(button.dataset.calendarDay, 'modal');
  });
  grid.addEventListener('keydown', event => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.calendarDay) return;
    const arrows: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const offset = arrows[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const key = isoAt(new Date(dateAt(target.dataset.calendarDay).getTime() + offset * 86400000));
    chooseDay(key, 'calendar');
  });
  [teamSelect, categorySelect, kindSelect, rangeSelect, viewSelect].filter((el): el is HTMLSelectElement => !!el).forEach(el => el.addEventListener('change', render));
  favoriteSelect?.addEventListener('change', () => {
    const team = reference.teams.find(t => t.slug === favoriteSelect.value);
    teamSelect.value = team?.id || '';
    categorySelect.value = '';
    render();
  });
  document.querySelector('#calendar-save-favorite')?.addEventListener('click', () => {
    favoriteSlug = favoriteSelect?.value || '';
    try { if (favoriteSlug) localStorage.setItem(favoriteKey, favoriteSlug); else localStorage.removeItem(favoriteKey); } catch { /* Speicher deaktiviert */ }
    if (favoriteStatus) favoriteStatus.textContent = favoriteSlug ? 'Lieblingsmannschaft auf diesem Gerät gespeichert.' : 'Favorit entfernt.';
    render();
  });

  render();
  const loadingWatchdog = window.setTimeout(() => {
    if (!ready) {
      fetchError = true;
      ready = true;
      statusTarget.classList.remove('hidden');
      statusTarget.textContent = 'Die Datenabfrage dauert ungewöhnlich lange. Der Kalender lässt sich bereits bedienen; Termine werden nachgeladen.';
      render();
    }
  }, 12000);
  try {
    reference = await refs();
    teamSelect.innerHTML += reference.teams.map(t => `<option value="${t.id}" data-slug="${escapeHtml(t.slug)}">${escapeHtml(t.name)}</option>`).join('');
    if (favoriteSelect) {
      favoriteSelect.innerHTML = '<option value="">Keine / alle Mannschaften</option>' + reference.teams.map(t =>
        `<option value="${escapeHtml(t.slug)}">${escapeHtml(t.name)}</option>`).join('');
      const favorite = reference.teams.find(t => t.slug === favoriteSlug);
      if (favorite) { favoriteSelect.value = favorite.slug; teamSelect.value = favorite.id; }
    }
    categorySelect.innerHTML += reference.categories.map(c => `<option value="${c.id}" data-slug="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join('');
    const [matchResponse, eventResponse] = await Promise.all([
      supabase.from('matches').select('*').eq('is_published', true).order('starts_at'),
      supabase.from('events').select('*').eq('status', 'published').order('starts_at'),
    ]);
    matches = matchResponse.data ?? [];
    events = eventResponse.data ?? [];
    fetchError = !!(matchResponse.error || eventResponse.error);
    if (matches.length) {
      const liveResponse = await supabase.from('match_live_state').select('*').in('match_id', matches.map(m => m.id));
      liveStates = liveResponse.data ?? [];
    }
  } catch (error) {
    fetchError = true;
    console.warn('Kalenderdaten konnten nicht vollständig geladen werden:', error);
  } finally {
    window.clearTimeout(loadingWatchdog);
    ready = true;
    if (fetchError) {
      statusTarget.classList.remove('hidden');
      statusTarget.textContent = 'Ein Teil der Termine ist momentan nicht erreichbar. Der Kalender bleibt bedienbar; die angezeigten Termine können unvollständig sein.';
    } else {
      statusTarget.classList.add('hidden');
      statusTarget.textContent = '';
    }
    render();
  }
}

export async function loadNews() {
  watchPublicContent('#news-list');
  const target = document.querySelector<HTMLElement>('#news-list');
  if (!target) return;
  const { data, error } = await supabase.from('news').select('*').eq('status', 'published').order('published_at', { ascending: false });
  target.innerHTML = data?.length ? data.map((item: Row) => `
    <article class="card ${item.slug?.startsWith('btv-spielverlegung-') ? 'news-card--reschedule' : ''}">
      ${item.hero_image_path ? `<img src="${escapeHtml(mediaUrl(item.hero_image_path))}" alt="" loading="lazy" style="border-radius:14px;aspect-ratio:16/9;object-fit:cover;margin-bottom:16px">` : ''}
      ${item.slug?.startsWith('btv-spielverlegung-') ? '<p class="news-reschedule-label">BTV · Spielverlegung</p>' : ''}
      <p class="eyebrow">${item.published_at ? escapeHtml(formatDateTime(item.published_at)) : 'Aktuelles'}</p>
      <h2>${escapeHtml(item.title)}</h2>
      <p class="muted">${escapeHtml(item.excerpt || (item.body || '').slice(0, 220))}</p>
      <details><summary>Weiterlesen</summary><p style="white-space:pre-wrap">${escapeHtml(item.body)}</p></details>
    </article>
  `).join('') : `<p class="muted">${error ? 'Beiträge sind momentan nicht abrufbar.' : 'Noch keine Beiträge veröffentlicht.'}</p>`;
}

export async function loadManagedPage(slug: string) {
  watchPublicContent('#managed-page-content');
  const title = document.querySelector<HTMLElement>('#managed-title');
  const content = document.querySelector<HTMLElement>('#managed-page-content');
  if (!content) return;
  const { data, error } = await supabase.from('pages').select('*').eq('slug', slug).eq('published', true).maybeSingle();
  if (error || !data) {
    content.innerHTML = `<p class="muted">${error ? 'Dieser Inhalt ist momentan nicht abrufbar.' : 'Der Inhalt wird noch gepflegt.'}</p>`;
    return;
  }
  if (title) title.textContent = data.title;
  content.textContent = data.body;
}

export async function loadSponsors() {
  watchPublicContent('#sponsors-grid');
  const target = document.querySelector<HTMLElement>('#sponsors-grid');
  if (!target) return;
  const { data, error } = await supabase.from('sponsors').select('*').eq('active', true).order('sort_order');
  target.innerHTML = data?.length ? data.map((s: Row) => `
    <article class="card team-card">
      ${s.logo_path ? `<img src="${escapeHtml(mediaUrl(s.logo_path))}" alt="Logo ${escapeHtml(s.name)}" loading="lazy">` : ''}
      <h3>${escapeHtml(s.name)}</h3>
      <p class="muted">${escapeHtml(s.description || '')}</p>
      ${s.url ? `<a class="button ghost" href="${escapeHtml(s.url)}" target="_blank" rel="noreferrer">Website ↗</a>` : ''}
    </article>
  `).join('') : `<p class="muted">${error ? 'Sponsoren sind momentan nicht abrufbar.' : 'Sponsoren werden derzeit eingepflegt.'}</p>`;
}

export async function loadOfficials() {
  watchPublicContent('#officials-grid');
  const target = document.querySelector<HTMLElement>('#officials-grid');
  if (!target) return;
  const { data, error } = await supabase.from('officials').select('*').eq('published', true).order('sort_order');
  target.innerHTML = data?.length ? data.map((o: Row) => `
    <article class="card team-card">
      ${o.photo_path ? `<img src="${escapeHtml(mediaUrl(o.photo_path))}" alt="${escapeHtml(o.name)}" loading="lazy">` : `<div class="official-placeholder" aria-hidden="true"><span>🎾</span><strong>${escapeHtml(String(o.name).split(' ').map((part: string) => part[0]).join('').slice(0,2))}</strong></div>`}
      <div><p class="eyebrow">${escapeHtml(o.title)}</p><h3>${escapeHtml(o.name)}</h3></div>
      <p class="muted">${o.email ? `<a href="mailto:${escapeHtml(o.email)}">${escapeHtml(o.email)}</a>` : ''}${o.email && o.phone ? '<br>' : ''}${o.phone ? escapeHtml(o.phone) : ''}</p>
    </article>
  `).join('') : `<p class="muted">${error ? 'Funktionäre sind momentan nicht abrufbar.' : 'Funktionäre werden derzeit eingepflegt.'}</p>`;
}

export async function loadLiveTicker(matchId: string | null) {
  watchPublicContent('#live-match-head');
  watchPublicContent('#live-score');
  watchPublicContent('#live-encounters');
  watchPublicContent('#live-timeline');
  const head = document.querySelector<HTMLElement>('#live-match-head');
  const score = document.querySelector<HTMLElement>('#live-score');
  const encountersTarget = document.querySelector<HTMLElement>('#live-encounters');
  const timeline = document.querySelector<HTMLElement>('#live-timeline');
  if (!head || !score || !encountersTarget || !timeline) return;

  if (!matchId) {
    head.innerHTML = '<div class="card"><h1>Kein Spiel ausgewählt</h1><p><a href="/termine/">Zum Spielplan</a></p></div>';
    return;
  }

  const reference = await refs();
  const tsvLogo = mediaUrl('branding/tennis-logo.png');

  const tsvTeamBlock = (label: string) => `
    <div class="live-team live-team--tsv">
      <img src="${escapeHtml(tsvLogo)}" alt="TSV Feldkirchen Tennis" />
      <div><span>${escapeHtml(label)}</span><strong>TSV Feldkirchen</strong></div>
    </div>`;

  const opponentTeamBlock = (label: string, opponent: string) => `
    <div class="live-team live-team--opponent">
      <span class="live-opponent-mark">G</span>
      <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(opponent)}</strong></div>
    </div>`;

  const renderEncounterSide = (match: Row, encounter: Row, tsv: boolean) => {
    if (tsv) {
      const names = [encounter.tsv_player_1_name, encounter.tsv_player_2_name].filter(Boolean);
      return `
        <div class="live-encounter-side live-encounter-side--tsv">
          <img src="${escapeHtml(tsvLogo)}" alt="" />
          <div>
            <span>TSV Feldkirchen</span>
            <strong>${escapeHtml(names.join(' / ') || 'Aufstellung folgt')}</strong>
          </div>
        </div>`;
    }

    const slots = [encounter.opponent_slot_1, encounter.opponent_slot_2]
      .filter((value) => value != null)
      .map((value) => `Gegner ${value}`);
    const fallback = encounter.discipline === 'singles'
      ? `Gegner ${encounter.position}`
      : 'Doppelaufstellung folgt';

    return `
      <div class="live-encounter-side live-encounter-side--opponent">
        <span class="live-opponent-mark">G</span>
        <div>
          <span>${escapeHtml(match.opponent)}</span>
          <strong>${escapeHtml(slots.join(' / ') || fallback)}</strong>
        </div>
      </div>`;
  };

  const renderEncounter = (match: Row, encounter: Row) => {
    const tsvSide = renderEncounterSide(match, encounter, true);
    const opponentSide = renderEncounterSide(match, encounter, false);
    const statusLabel = encounter.status === 'live' ? 'LIVE' : encounter.status === 'finished' ? 'Beendet' : 'Geplant';

    return `
      <article class="live-encounter-row ${encounter.status === 'live' ? 'is-live' : ''}">
        <div class="live-encounter-row__head">
          <strong>${encounter.discipline === 'singles' ? 'Einzel' : 'Doppel'} ${encounter.position}</strong>
          <span class="status-pill ${encounter.status === 'live' ? 'live' : ''}">${statusLabel}</span>
        </div>
        <div class="live-encounter-matchup">
          ${match.is_home ? tsvSide : opponentSide}
          <div class="live-encounter-result">
            <span>Ergebnis</span>
            <strong>${escapeHtml(encounter.result_text || '–')}</strong>
          </div>
          ${match.is_home ? opponentSide : tsvSide}
        </div>
      </article>`;
  };

  const refresh = async () => {
    const [{ data: match }, { data: state }, { data: entries }, { data: encounters }] = await Promise.all([
      supabase.from('matches').select('*').eq('id', matchId).maybeSingle(),
      supabase.from('match_live_state').select('*').eq('match_id', matchId).maybeSingle(),
      supabase.from('live_ticker_entries').select('*').eq('match_id', matchId).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('match_encounters').select('*').eq('match_id', matchId).order('sort_order').order('position'),
    ]);

    if (!match) {
      head.innerHTML = '<div class="card"><h1>Spiel nicht gefunden</h1></div>';
      return;
    }

    const { team } = matchContext(match, reference);
    const clubName = team?.name ?? 'TSV Feldkirchen';
    const leftName = match.is_home ? clubName : match.opponent;
    const rightName = match.is_home ? match.opponent : clubName;

    head.innerHTML = `
      <p class="eyebrow">Liveticker</p>
      <h1>${escapeHtml(leftName)} <span>vs.</span> ${escapeHtml(rightName)}</h1>
      <p class="muted">${escapeHtml(formatDateTime(match.starts_at))} · ${match.is_home ? 'Heimspiel' : 'Auswärtsspiel'}</p>
      ${matchVenueInfo(match)}
      ${matchRouteButton(match)}`;

    const homeScore = state?.home_score ?? 0;
    const awayScore = state?.away_score ?? 0;
    const homeBlock = match.is_home
      ? tsvTeamBlock('Heim')
      : opponentTeamBlock('Heim', match.opponent);
    const awayBlock = match.is_home
      ? opponentTeamBlock('Auswärts', match.opponent)
      : tsvTeamBlock('Auswärts');

    score.innerHTML = `
      <div class="live-score-status">
        <div class="live-badge"><span class="live-dot"></span>${state?.status === 'live' ? 'LIVE' : state?.status === 'finished' ? 'BEENDET' : 'SPIELTAG'}</div>
      </div>
      <div class="live-scoreboard">
        ${homeBlock}
        <div class="live-scoreboard__score"><strong>${homeScore} : ${awayScore}</strong></div>
        ${awayBlock}
      </div>`;

    const rows = encounters ?? [];
    const singles = rows.filter((row: Row) => row.discipline === 'singles');
    const doubles = rows.filter((row: Row) => row.discipline === 'doubles');

    encountersTarget.innerHTML = rows.length
      ? `
        <section class="live-encounter-group">
          <div class="live-encounter-group__title"><p class="matchday-kicker">Begegnungen</p><h2>Einzel</h2></div>
          <div class="live-encounter-list">${singles.map((row: Row) => renderEncounter(match, row)).join('')}</div>
        </section>
        <section class="live-encounter-group">
          <div class="live-encounter-group__title"><p class="matchday-kicker">Begegnungen</p><h2>Doppel</h2></div>
          <div class="live-encounter-list">${doubles.map((row: Row) => renderEncounter(match, row)).join('')}</div>
        </section>`
      : '<div class="live-encounter-empty"><strong>Die Aufstellung wird noch vorbereitet.</strong><p class="muted">Sobald Einzel und Doppel eingetragen sind, erscheinen sie hier.</p></div>';

    timeline.innerHTML = entries?.length
      ? entries.map((entry: Row) => `
          <div class="timeline-row">
            <div><strong>${escapeHtml(entry.message)}</strong><div class="match-meta">${escapeHtml(formatDateTime(entry.created_at))}</div></div>
            ${entry.home_score != null && entry.away_score != null ? `<span class="score">${entry.home_score} : ${entry.away_score}</span>` : ''}
          </div>`).join('')
      : '<p class="muted">Noch keine Tickermeldungen.</p>';
  };

  await refresh();
  await renderSponsorPlacements('#live-sponsor', ['live', 'match'], { matchId });

  const publicChannel = supabase
    .channel(`public-match:${matchId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_live_state', filter: `match_id=eq.${matchId}` }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_encounters', filter: `match_id=eq.${matchId}` }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_ticker_entries', filter: `match_id=eq.${matchId}` }, refresh)
    .subscribe();

  const channels = [publicChannel];

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      await supabase.realtime.setAuth(sessionData.session.access_token);
      const privateChannel = supabase
        .channel(`match:${matchId}:ticker`, { config: { private: true } })
        .on('broadcast', { event: 'INSERT' }, refresh)
        .on('broadcast', { event: 'UPDATE' }, refresh)
        .on('broadcast', { event: 'DELETE' }, refresh)
        .subscribe();
      channels.push(privateChannel);
    }
  } catch {
    // Public Postgres Changes plus polling remain available.
  }

  window.addEventListener('beforeunload', () => {
    channels.forEach((channel) => { supabase.removeChannel(channel); });
  });

  window.setInterval(refresh, 30000);
}
