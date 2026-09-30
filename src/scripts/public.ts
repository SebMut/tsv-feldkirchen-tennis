import { calendarFeedUrl, mediaUrl, supabase } from '../lib/supabase';
import { escapeHtml, formatDateTime } from '../lib/ui';

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

async function refs() {
  const [{ data: seasons }, { data: categories }, { data: teams }, { data: teamSeasons }] = await Promise.all([
    supabase.from('seasons').select('*').order('year', { ascending: false }),
    supabase.from('team_categories').select('*').order('sort_order'),
    supabase.from('teams').select('*').eq('active', true).order('sort_order'),
    supabase.from('team_seasons').select('*'),
  ]);
  return {
    seasons: seasons ?? [],
    categories: categories ?? [],
    teams: teams ?? [],
    teamSeasons: teamSeasons ?? [],
  };
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

function matchContext(match: Row, reference: Awaited<ReturnType<typeof refs>>) {
  const ts = reference.teamSeasons.find((row: Row) => row.id === match.team_season_id);
  const team = reference.teams.find((row: Row) => row.id === ts?.team_id);
  const season = reference.seasons.find((row: Row) => row.id === ts?.season_id);
  return { ts, team, season };
}

function scoreFor(match: Row, liveStates: Row[]) {
  return liveStates.find((state) => state.match_id === match.id);
}

function matchRow(match: Row, reference: Awaited<ReturnType<typeof refs>>, liveStates: Row[] = [], matchesWithGallery = new Set<string>()) {
  const { team } = matchContext(match, reference);
  const state = scoreFor(match, liveStates);
  const status = state?.status ?? 'scheduled';
  const home = state?.home_score ?? 0;
  const away = state?.away_score ?? 0;
  const clubScore = match.is_home ? home : away;
  const opponentScore = match.is_home ? away : home;
  const homeAway = match.is_home ? 'Heim' : 'Auswärts';
  const detailUrl = `/spiel/?match=${encodeURIComponent(match.id)}`;
  return `
    <div class="match-row">
      <a class="match-row__main" href="${detailUrl}">
        <strong>${escapeHtml(team?.name ?? 'TSV Feldkirchen')} · ${escapeHtml(homeAway)}</strong>
        <div class="match-meta">${escapeHtml(formatDateTime(match.starts_at))} · gegen ${escapeHtml(match.opponent)}</div>
      </a>
      <div class="actions">
        ${status === 'live' ? '<span class="status-pill live">LIVE</span>' : status === 'finished' ? '<span class="status-pill">Beendet</span>' : ''}
        ${status !== 'scheduled' ? `<span class="score">${clubScore} : ${opponentScore}</span>` : ''}
        <a class="button ghost" href="${detailUrl}">${matchesWithGallery.has(match.id) ? 'Spiel & Bilder' : 'Spiel öffnen'}</a>
        ${status === 'live' ? `<a class="button" href="/live/?match=${encodeURIComponent(match.id)}">Liveticker</a>` : ''}
      </div>
    </div>`;
}

export async function loadHome() {
  const facility = document.querySelector<HTMLElement>('#facility-card');
  const liveCenter = document.querySelector<HTMLElement>('#live-center');
  const todayTarget = document.querySelector<HTMLElement>('#today-matches');
  const newsTarget = document.querySelector<HTMLElement>('#home-news');

  const reference = await refs();
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);

  const [
    { data: facilityRows },
    { data: courts },
    { data: liveStates },
    { data: todayMatches },
    { data: news },
    { data: settings },
  ] = await Promise.all([
    supabase.from('facility_status').select('*').limit(1),
    supabase.from('courts').select('*').eq('active', true).order('sort_order'),
    supabase.from('match_live_state').select('*').eq('status', 'live'),
    supabase.from('matches').select('*').gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'),
    supabase.from('news').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(4),
    supabase.from('site_settings').select('key,value').in('key', ['team_count', 'court_count']),
  ]);

  const settingsTarget = new Map((settings ?? []).map((row: Row) => [row.key, row.value]));
  const teamCount = document.querySelector<HTMLElement>('#home-team-count');
  const courtCount = document.querySelector<HTMLElement>('#home-court-count');
  if (teamCount && settingsTarget.has('team_count')) {
    const value = String(settingsTarget.get('team_count'));
    teamCount.textContent = teamCount.dataset.countOnly === 'true' ? value : `${value} Mannschaften`;
  }
  if (courtCount && settingsTarget.has('court_count')) {
    const value = String(settingsTarget.get('court_count'));
    courtCount.textContent = courtCount.dataset.countOnly === 'true' ? value : `${value} Sandplätze`;
  }

  if (facility) {
    const current = facilityRows?.[0];
    const statusLabel = current?.status === 'closed' ? 'Plätze gesperrt' : current?.status === 'limited' ? 'Teilweise geöffnet' : 'Plätze geöffnet';
    const statusClass = current?.status === 'closed' ? 'closed' : '';
    const closedCourts = (courts ?? []).filter((court: Row) => court.status !== 'open');
    facility.innerHTML = `
      <p class="eyebrow">Anlagenstatus</p>
      <div class="page-head">
        <div><h2>${escapeHtml(statusLabel)}</h2><p class="muted">${escapeHtml(current?.message ?? 'Aktueller Status der Tennisanlage.')}</p></div>
        <span class="status-pill ${statusClass}">${current?.status === 'open' ? '🟢 offen' : current?.status === 'closed' ? '🔴 gesperrt' : '🟡 eingeschränkt'}</span>
      </div>
      ${closedCourts.length ? `<p class="muted">${closedCourts.map((c: Row) => `${escapeHtml(c.name)}: ${escapeHtml(c.status_message || c.status)}`).join(' · ')}</p>` : ''}
    `;
  }

  const activeLive = liveStates ?? [];
  if (liveCenter && activeLive.length) {
    const liveMatchesResult = await supabase.from('matches').select('*').in('id', activeLive.map((s: Row) => s.match_id));
    const liveMatches = liveMatchesResult.data ?? [];
    liveCenter.classList.remove('hidden');
    liveCenter.innerHTML = `
      <div class="live-badge"><span class="live-dot"></span>Live Center</div>
      <h2>${activeLive.length === 1 ? 'Eine Begegnung läuft gerade' : `${activeLive.length} Begegnungen laufen gerade`}</h2>
      <div class="match-list">${liveMatches.map((m: Row) => matchRow(m, reference, activeLive)).join('')}</div>
    `;
  } else if (liveCenter) {
    liveCenter.classList.add('hidden');
  }

  if (todayTarget) {
    todayTarget.innerHTML = (todayMatches?.length)
      ? todayMatches.map((m: Row) => matchRow(m, reference, liveStates ?? [])).join('')
      : '<p class="muted">Heute sind keine Punktspiele eingetragen.</p>';
  }

  if (newsTarget) {
    newsTarget.innerHTML = (news?.length)
      ? news.map((item: Row) => `
          <div class="news-row">
            <div><strong>${escapeHtml(item.title)}</strong><div class="match-meta">${item.published_at ? escapeHtml(formatDateTime(item.published_at)) : ''}</div></div>
          </div>`).join('')
      : '<p class="muted">Noch keine aktuellen Beiträge.</p>';
  }

  await renderSponsorPlacements('#home-sponsors', ['home']);
  window.setTimeout(loadHome, 30000);
}

export async function loadTeams() {
  const target = document.querySelector<HTMLElement>('#teams-grid');
  const seasonSelect = document.querySelector<HTMLSelectElement>('#teams-season');
  const categorySelect = document.querySelector<HTMLSelectElement>('#teams-category');
  if (!target || !seasonSelect || !categorySelect) return;

  const reference = await refs();
  const current = reference.seasons.find((s: Row) => s.is_current) ?? reference.seasons[0];

  seasonSelect.innerHTML = reference.seasons.map((s: Row) => `<option value="${s.id}" ${s.id === current?.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
  categorySelect.innerHTML += reference.categories.map((c: Row) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  const render = () => {
    const seasonId = seasonSelect.value;
    const categoryId = categorySelect.value;
    const rows = reference.teamSeasons
      .filter((ts: Row) => ts.season_id === seasonId && ts.is_published)
      .map((ts: Row) => ({ ts, team: reference.teams.find((t: Row) => t.id === ts.team_id) }))
      .filter((x: any) => x.team && (!categoryId || x.team.category_id === categoryId))
      .sort((a: any, b: any) => (a.team.sort_order ?? 0) - (b.team.sort_order ?? 0));

    target.innerHTML = rows.length ? rows.map(({ ts, team }: any) => `
      <article class="card team-card">
        <img src="${escapeHtml(mediaUrl(ts.team_image_path || team.image_path) || teamFallbackImage(team))}" alt="${escapeHtml(team.name)}" loading="lazy" />
        <div><p class="eyebrow">${escapeHtml(ts.league || 'Mannschaft')}</p><h3>${escapeHtml(team.name)}</h3></div>
        <p class="muted">${escapeHtml([ts.league, ts.group_name].filter(Boolean).join(' · '))}</p>
        <div class="actions"><a class="button" href="/mannschaften/${escapeHtml(team.slug)}/">Mannschaft öffnen</a>${ts.btv_url ? `<a class="button ghost" href="${escapeHtml(ts.btv_url)}" target="_blank" rel="noreferrer">BTV ↗</a>` : ''}</div>
      </article>
    `).join('') : '<p class="muted">Für diese Auswahl sind keine Mannschaften hinterlegt.</p>';
  };

  seasonSelect.addEventListener('change', render);
  categorySelect.addEventListener('change', render);
  render();
}

export async function loadTeamDetail(slug: string) {
  const root = document.querySelector<HTMLElement>('[data-team-slug]');
  if (!root) return;
  const reference = await refs();
  const team = reference.teams.find((t: Row) => t.slug === slug);
  if (!team) {
    root.innerHTML = '<div class="card"><h1>Mannschaft nicht gefunden</h1></div>';
    return;
  }

  const teamSeasons = reference.teamSeasons
    .filter((ts: Row) => ts.team_id === team.id && ts.is_published)
    .sort((a: Row, b: Row) => {
      const ay = reference.seasons.find((s: Row) => s.id === a.season_id)?.year ?? 0;
      const by = reference.seasons.find((s: Row) => s.id === b.season_id)?.year ?? 0;
      return by - ay;
    });
  const current = teamSeasons.find((ts: Row) => reference.seasons.find((s: Row) => s.id === ts.season_id)?.is_current) ?? teamSeasons[0];

  const head = document.querySelector<HTMLElement>('#team-header');
  if (head) head.innerHTML = `
    <section class="hero">
      <div><p class="eyebrow">Mannschaft</p><h1>${escapeHtml(team.name)}</h1><p class="hero__lead">${escapeHtml(team.description || [current?.league, current?.group_name].filter(Boolean).join(' · ') || 'TSV Feldkirchen Tennis')}</p><div class="actions">${current?.btv_url ? `<a class="button" href="${escapeHtml(current.btv_url)}" target="_blank" rel="noreferrer">BTV Spielplan ↗</a>` : ''}<a class="button secondary" href="${escapeHtml(calendarFeedUrl({team: slug}))}">Kalender abonnieren</a></div></div>
      <div class="card"><img src="${escapeHtml(mediaUrl(current?.team_image_path || team.image_path) || teamFallbackImage(team))}" alt="Mannschaftsfoto ${escapeHtml(team.name)}" /></div>
    </section>
  `;

  const seasonTarget = document.querySelector<HTMLElement>('#team-season');
  if (seasonTarget) seasonTarget.innerHTML = teamSeasons.map((ts: Row) => {
    const season = reference.seasons.find((s: Row) => s.id === ts.season_id);
    return `<p><strong>${escapeHtml(season?.name ?? '')}</strong><br><span class="muted">${escapeHtml([ts.league, ts.group_name].filter(Boolean).join(' · '))}</span></p>`;
  }).join('') || '<p class="muted">Noch keine Saisoninformationen.</p>';

  if (!current) return;

  const [{ data: links }, { data: matches }, { data: news }, { data: galleries }] = await Promise.all([
    supabase.from('team_players').select('*').eq('team_season_id', current.id).eq('public_visible', true).order('sort_order'),
    supabase.from('matches').select('*').eq('team_season_id', current.id).order('starts_at'),
    supabase.from('news').select('*').eq('team_id', team.id).eq('status', 'published').order('published_at', { ascending: false }),
    supabase.from('galleries').select('*').eq('team_id', team.id).eq('published', true).order('created_at', { ascending: false }),
  ]);

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

  const liveStates = matches?.length ? (await supabase.from('match_live_state').select('*').in('match_id', matches.map((m: Row) => m.id))).data ?? [] : [];

  const nextMatchTarget = document.querySelector<HTMLElement>('#team-next-match');
  if (nextMatchTarget) {
    const now = Date.now();
    const liveMatch = (matches ?? []).find((match: Row) =>
      liveStates.find((state: Row) => state.match_id === match.id)?.status === 'live'
    );
    const upcomingMatch = (matches ?? [])
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
      const venue = featuredMatch.venue_name || (featuredMatch.is_home ? 'TSV Feldkirchen' : 'Auswärts');
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
            <div class="${featuredMatch.is_home ? 'is-tsv' : ''}"><span>${escapeHtml(leftTeam)}</span></div>
            <strong>VS</strong>
            <div class="${!featuredMatch.is_home ? 'is-tsv' : ''}"><span>${escapeHtml(rightTeam)}</span></div>
          </a>
          <div class="next-match-card__bottom">
            <div>
              <span class="match-meta">Ort</span>
              <strong>${escapeHtml(venue)}</strong>
              ${featuredMatch.venue_address ? `<span class="match-meta">${escapeHtml(featuredMatch.venue_address)}</span>` : ''}
            </div>
            <div class="actions">
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
  if (matchTarget) matchTarget.innerHTML = matches?.length
    ? matches.map((m: Row) => matchRow(m, reference, liveStates, matchGalleryIds)).join('')
    : '<p class="muted">Noch keine Spiele eingetragen.</p>';

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
  const root = document.querySelector<HTMLElement>('#match-detail-root');
  const head = document.querySelector<HTMLElement>('#match-detail-head');
  const scoreTarget = document.querySelector<HTMLElement>('#match-detail-score');
  const galleryTarget = document.querySelector<HTMLElement>('#match-detail-gallery');
  if (!root || !head || !scoreTarget || !galleryTarget) return;

  if (!matchId) {
    head.innerHTML = '<div class="card"><h1>Kein Spiel ausgewählt</h1><p><a href="/termine/">Zum Spielplan</a></p></div>';
    return;
  }

  const reference = await refs();
  const [{ data: match }, { data: liveState }, { data: galleries }] = await Promise.all([
    supabase.from('matches').select('*').eq('id', matchId).eq('is_published', true).maybeSingle(),
    supabase.from('match_live_state').select('*').eq('match_id', matchId).maybeSingle(),
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
  const clubScore = match.is_home ? liveState?.home_score ?? 0 : liveState?.away_score ?? 0;
  const opponentScore = match.is_home ? liveState?.away_score ?? 0 : liveState?.home_score ?? 0;
  const detailDate = formatDateTime(match.starts_at);
  const location = match.venue_name || (match.is_home ? 'TSV Feldkirchen' : 'Auswärts');

  head.innerHTML = `
    <div class="match-detail-hero">
      <div>
        <p class="eyebrow">${escapeHtml([season?.name, ts?.league].filter(Boolean).join(' · ') || 'Punktspiel')}</p>
        <h1>${escapeHtml(leftTeam)} <span>vs.</span> ${escapeHtml(rightTeam)}</h1>
        <p class="hero__lead">${escapeHtml(detailDate)} · ${escapeHtml(location)}</p>
        <div class="actions">
          <a class="button secondary" href="/mannschaften/${escapeHtml(team?.slug || '')}/">Zur Mannschaft</a>
          ${status === 'live' ? `<a class="button" href="/live/?match=${encodeURIComponent(match.id)}">Liveticker öffnen</a>` : ''}
          ${match.external_url ? `<a class="button ghost" href="${escapeHtml(match.external_url)}" target="_blank" rel="noreferrer">BTV / Details ↗</a>` : ''}
        </div>
      </div>
    </div>`;

  scoreTarget.innerHTML = status !== 'scheduled'
    ? `<div class="match-detail-score"><span class="status-pill ${status === 'live' ? 'live' : ''}">${status === 'live' ? 'LIVE' : 'Beendet'}</span><strong>${clubScore} : ${opponentScore}</strong><span>aus Sicht des TSV</span></div>`
    : '<div class="match-detail-score"><span class="status-pill">Geplant</span><strong>– : –</strong><span>Spiel noch nicht begonnen</span></div>';

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

  await renderSponsorPlacements('#match-detail-sponsor', ['match'], { teamId: team?.id, matchId });
}

export async function loadCalendar() {
  const list = document.querySelector<HTMLElement>('#calendar-list');
  const teamSelect = document.querySelector<HTMLSelectElement>('#calendar-team');
  const categorySelect = document.querySelector<HTMLSelectElement>('#calendar-category');
  const kindSelect = document.querySelector<HTMLSelectElement>('#calendar-kind');
  const subscriptions = document.querySelector<HTMLElement>('#calendar-subscriptions');
  if (!list || !teamSelect || !categorySelect || !kindSelect || !subscriptions) return;

  const reference = await refs();
  teamSelect.innerHTML += reference.teams.map((t: Row) => `<option value="${t.id}" data-slug="${escapeHtml(t.slug)}">${escapeHtml(t.name)}</option>`).join('');
  categorySelect.innerHTML += reference.categories.map((c: Row) => `<option value="${c.id}" data-slug="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join('');

  const [{ data: matches }, { data: events }] = await Promise.all([
    supabase.from('matches').select('*').order('starts_at'),
    supabase.from('events').select('*').eq('status', 'published').order('starts_at'),
  ]);
  const liveStates = matches?.length ? (await supabase.from('match_live_state').select('*').in('match_id', matches.map((m: Row) => m.id))).data ?? [] : [];

  const render = () => {
    const teamId = teamSelect.value;
    const categoryId = categorySelect.value;
    const kind = kindSelect.value;

    const matchRows = (matches ?? []).filter((m: Row) => {
      const { team } = matchContext(m, reference);
      return (!teamId || team?.id === teamId) && (!categoryId || team?.category_id === categoryId);
    }).map((m: Row) => ({ at: m.starts_at, html: matchRow(m, reference, liveStates) }));

    const eventRows = (events ?? []).filter((e: Row) => {
      if (teamId && e.team_id !== teamId) return false;
      if (categoryId && e.team_id) {
        const team = reference.teams.find((t: Row) => t.id === e.team_id);
        if (team?.category_id !== categoryId) return false;
      } else if (categoryId && !e.team_id) return false;
      return true;
    }).map((e: Row) => ({
      at: e.starts_at,
      html: `<div class="match-row"><div><strong>${escapeHtml(e.title)}</strong><div class="match-meta">${escapeHtml(formatDateTime(e.starts_at))} · ${escapeHtml(e.location_name || 'TSV Feldkirchen')}</div></div><span class="status-pill">Veranstaltung</span></div>`,
    }));

    const combined = [
      ...(kind !== 'events' ? matchRows : []),
      ...(kind !== 'matches' ? eventRows : []),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    list.innerHTML = combined.length ? combined.map((x) => x.html).join('') : '<p class="muted">Keine Termine für diese Auswahl.</p>';

    const params: Record<string, string> = {};
    if (kind !== 'all') params.type = kind;
    const teamOption = teamSelect.selectedOptions[0];
    const categoryOption = categorySelect.selectedOptions[0];
    if (teamId && teamOption?.dataset.slug) params.team = teamOption.dataset.slug;
    else if (categoryId && categoryOption?.dataset.slug) params.category = categoryOption.dataset.slug;

    subscriptions.innerHTML = `
      <a class="button" href="${escapeHtml(calendarFeedUrl(params))}">Auswahl als ICS</a>
      <a class="button secondary" href="${escapeHtml(calendarFeedUrl({type:'matches'}))}">Alle Punktspiele</a>
      <a class="button secondary" href="${escapeHtml(calendarFeedUrl({type:'events'}))}">Veranstaltungen</a>
    `;
  };

  [teamSelect, categorySelect, kindSelect].forEach((el) => el.addEventListener('change', render));
  render();
}

export async function loadNews() {
  const target = document.querySelector<HTMLElement>('#news-list');
  if (!target) return;
  const { data } = await supabase.from('news').select('*').eq('status', 'published').order('published_at', { ascending: false });
  target.innerHTML = data?.length ? data.map((item: Row) => `
    <article class="card">
      ${item.hero_image_path ? `<img src="${escapeHtml(mediaUrl(item.hero_image_path))}" alt="" loading="lazy" style="border-radius:14px;aspect-ratio:16/9;object-fit:cover;margin-bottom:16px">` : ''}
      <p class="eyebrow">${item.published_at ? escapeHtml(formatDateTime(item.published_at)) : 'Aktuelles'}</p>
      <h2>${escapeHtml(item.title)}</h2>
      <p class="muted">${escapeHtml(item.excerpt || item.body.slice(0, 220))}</p>
      <details><summary>Weiterlesen</summary><p style="white-space:pre-wrap">${escapeHtml(item.body)}</p></details>
    </article>
  `).join('') : '<p class="muted">Noch keine Beiträge veröffentlicht.</p>';
}

export async function loadManagedPage(slug: string) {
  const title = document.querySelector<HTMLElement>('#managed-title');
  const content = document.querySelector<HTMLElement>('#managed-page-content');
  if (!content) return;
  const { data, error } = await supabase.from('pages').select('*').eq('slug', slug).eq('published', true).maybeSingle();
  if (error || !data) {
    content.innerHTML = '<p class="muted">Der Inhalt wird noch gepflegt.</p>';
    return;
  }
  if (title) title.textContent = data.title;
  content.textContent = data.body;
}

export async function loadSponsors() {
  const target = document.querySelector<HTMLElement>('#sponsors-grid');
  if (!target) return;
  const { data } = await supabase.from('sponsors').select('*').eq('active', true).order('sort_order');
  target.innerHTML = data?.length ? data.map((s: Row) => `
    <article class="card team-card">
      ${s.logo_path ? `<img src="${escapeHtml(mediaUrl(s.logo_path))}" alt="Logo ${escapeHtml(s.name)}" loading="lazy">` : ''}
      <h3>${escapeHtml(s.name)}</h3>
      <p class="muted">${escapeHtml(s.description || '')}</p>
      ${s.url ? `<a class="button ghost" href="${escapeHtml(s.url)}" target="_blank" rel="noreferrer">Website ↗</a>` : ''}
    </article>
  `).join('') : '<p class="muted">Sponsoren werden derzeit eingepflegt.</p>';
}

export async function loadOfficials() {
  const target = document.querySelector<HTMLElement>('#officials-grid');
  if (!target) return;
  const { data } = await supabase.from('officials').select('*').eq('published', true).order('sort_order');
  target.innerHTML = data?.length ? data.map((o: Row) => `
    <article class="card team-card">
      ${o.photo_path ? `<img src="${escapeHtml(mediaUrl(o.photo_path))}" alt="${escapeHtml(o.name)}" loading="lazy">` : ''}
      <div><p class="eyebrow">${escapeHtml(o.title)}</p><h3>${escapeHtml(o.name)}</h3></div>
      <p class="muted">${o.email ? `<a href="mailto:${escapeHtml(o.email)}">${escapeHtml(o.email)}</a>` : ''}${o.email && o.phone ? '<br>' : ''}${o.phone ? escapeHtml(o.phone) : ''}</p>
    </article>
  `).join('') : '<p class="muted">Funktionäre werden derzeit eingepflegt.</p>';
}

export async function loadLiveTicker(matchId: string | null) {
  const head = document.querySelector<HTMLElement>('#live-match-head');
  const score = document.querySelector<HTMLElement>('#live-score');
  const timeline = document.querySelector<HTMLElement>('#live-timeline');
  if (!head || !score || !timeline) return;
  if (!matchId) {
    head.innerHTML = '<div class="card"><h1>Kein Spiel ausgewählt</h1><p><a href="/termine/">Zum Spielplan</a></p></div>';
    return;
  }

  const reference = await refs();

  const refresh = async () => {
    const [{ data: match }, { data: state }, { data: entries }] = await Promise.all([
      supabase.from('matches').select('*').eq('id', matchId).maybeSingle(),
      supabase.from('match_live_state').select('*').eq('match_id', matchId).maybeSingle(),
      supabase.from('live_ticker_entries').select('*').eq('match_id', matchId).is('deleted_at', null).order('created_at', { ascending: false }),
    ]);
    if (!match) {
      head.innerHTML = '<div class="card"><h1>Spiel nicht gefunden</h1></div>';
      return;
    }
    const { team } = matchContext(match, reference);
    head.innerHTML = `<p class="eyebrow">Liveticker</p><h1>${escapeHtml(team?.name ?? 'TSV Feldkirchen')} – ${escapeHtml(match.opponent)}</h1><p class="muted">${escapeHtml(formatDateTime(match.starts_at))} · ${match.is_home ? 'Heimspiel' : 'Auswärtsspiel'}</p>`;
    const clubScore = match.is_home ? state?.home_score ?? 0 : state?.away_score ?? 0;
    const opponentScore = match.is_home ? state?.away_score ?? 0 : state?.home_score ?? 0;
    score.innerHTML = `<div class="live-badge"><span class="live-dot"></span>${state?.status === 'live' ? 'LIVE' : state?.status === 'finished' ? 'BEENDET' : 'SPIEL'}</div><h2 class="score">${clubScore} : ${opponentScore}</h2>`;
    timeline.innerHTML = entries?.length ? entries.map((entry: Row) => `<div class="timeline-row"><div><strong>${escapeHtml(entry.message)}</strong><div class="match-meta">${escapeHtml(formatDateTime(entry.created_at))}</div></div>${entry.home_score != null && entry.away_score != null ? `<span class="score">${entry.home_score} : ${entry.away_score}</span>` : ''}</div>`).join('') : '<p class="muted">Noch keine Tickermeldungen.</p>';
  };

  await refresh();
  await renderSponsorPlacements('#live-sponsor', ['live', 'match'], { matchId });

  // Public visitors receive row changes through RLS-protected Postgres Changes.
  // Signed-in users additionally use the private Broadcast channel created by the DB triggers.
  const publicChannel = supabase
    .channel(`public-match:${matchId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_live_state', filter: `match_id=eq.${matchId}` }, refresh)
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
