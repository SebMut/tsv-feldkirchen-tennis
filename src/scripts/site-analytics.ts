import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../lib/supabase';

type EventName = 'page_view' | 'ticker_view' | 'nav_click' | 'action_click' | 'calendar_click' | 'route_click' | 'content_click';
const staticPaths = new Set([
  '/', '/spieltag/', '/spieltag/live-ticker/', '/live/', '/aktuelles/', '/termine/',
  '/mannschaften/', '/sponsoren/', '/training/', '/mitglied-werden/', '/kontakt/',
  '/ueber-uns/', '/funktionaere/', '/spiel/', '/veranstaltung/', '/impressum/', '/datenschutz/',
]);
let started = false;
let hits = 0;
const sent = new Map<string, number>();

function pathOf(raw: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let path = raw.replace(/\/{2,}/g, '/');
  if (base && path.startsWith(base + '/')) path = path.slice(base.length);
  if (!path.endsWith('/')) path += '/';
  if (staticPaths.has(path) || /^\/mannschaften\/[a-z0-9-]{1,60}\/$/.test(path)) return path;
  return '';
}

function source() {
  if (!document.referrer) return 'direct';
  try {
    const host = new URL(document.referrer).hostname.toLowerCase();
    if (host === location.hostname.toLowerCase()) return 'internal';
    if (/(^|\.)(google\.|bing\.|duckduckgo\.|ecosia\.|yahoo\.)/.test(host)) return 'search';
    if (/(^|\.)(facebook\.com|instagram\.com|whatsapp\.com|t\.co|x\.com|youtube\.com)/.test(host)) return 'social';
    return 'external';
  } catch { return 'direct'; }
}

function track(event: EventName, pagePath: string, target = '', match = '') {
  if (hits >= 40 || !pagePath) return;
  const key = [event,pagePath,target,match].join('|');
  const now = Date.now();
  if (now - (sent.get(key) ?? 0) < 1500) return;
  sent.set(key, now);
  hits++;
  const width = window.innerWidth;
  const body = JSON.stringify({
    p_event: event, p_path: pagePath,
    p_device: width < 700 ? 'mobile' : width < 1025 ? 'tablet' : 'desktop',
    p_source: source(), p_match: match, p_target: target,
  });
  // keepalive: Zählung von Navigationsklicks kann die Weiterleitung überleben.
  // Ausschließlich das vorhandene Supabase-Projekt, niemals sensible URL-Parameter.
  void fetch(SUPABASE_URL + '/rest/v1/rpc/track_site_analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY },
    credentials: 'omit', keepalive: true, body,
  }).catch(() => { /* Statistik ist optional; die Website bleibt nutzbar. */ });
}

function targetFor(href: string): string {
  if (href.startsWith('/mannschaften/')) return 'mannschaften';
  const key = href.split('/').filter(Boolean)[0] || 'startseite';
  return /^[a-z0-9-]{1,40}$/.test(key) ? key.replace(/-/g, '_') : 'intern';
}

/** Kein Cookie, keine IP, kein Besucher- oder Fingerprint-Identifier. */
export function initSiteAnalytics() {
  if (started || import.meta.env.PUBLIC_PREVIEW_MODE === 'true') return;
  started = true;
  if (navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return;
  const pagePath = pathOf(location.pathname);
  // Geschützte Bereiche, Einladungen, Anmeldungen und deren Parameter nie erfassen.
  if (!pagePath) return;
  track('page_view', pagePath);
  if (['/spieltag/', '/live/', '/spieltag/live-ticker/'].includes(pagePath)) {
    const match = pagePath === '/live/' ? new URLSearchParams(location.search).get('match') || '' : '';
    track('ticker_view', pagePath, '', /^[0-9a-f-]{36}$/i.test(match) ? match : '');
  }
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const elem = e.target.closest<HTMLElement>('a[href],button,summary');
    if (!elem) return;
    const article = elem.closest<HTMLElement>('.content-card[id^="news-"],.content-card[id^="event-"]');
    if (article && (elem.matches('[data-open-detail]') ||
      (elem.matches('summary') && !!elem.closest('details[data-expanded-details]')))) {
      const expanded = article.querySelector<HTMLDetailsElement>('details[data-expanded-details]');
      if (!expanded?.open) {
        const match = /^(news|event)-([0-9a-f-]{36})$/i.exec(article.id);
        if (match) track('content_click',pagePath,match[1]+':'+match[2].toLowerCase());
      }
      return;
    }
    if (elem.matches('[data-calendar-copy]')) { track('calendar_click',pagePath,'abo_kopieren'); return; }
    if (elem.matches('[data-calendar-save]')) { track('calendar_click',pagePath,'ics_download'); return; }
    if (elem.matches('#calendar-modal-details')) { track('calendar_click',pagePath,'tag_details'); return; }
    if (elem.matches('[data-news-more]')) { track('content_click',pagePath,'weitere_beitraege'); return; }
    if (elem instanceof HTMLAnchorElement) {
      if (elem.getAttribute('href')?.startsWith('#')) {
        if (pagePath === '/live/' && elem.closest('.scorecenter-tabs')) {
          track('action_click',pagePath,'ticker_reiter');
        }
        return;
      }
      let url: URL;
      try { url = new URL(elem.href, location.href); } catch { return; }
      const href = url.origin === location.origin ? pathOf(url.pathname) : '';
      if (/google\.[^/]+\/maps|maps\.apple\.com|maps\.app\.goo\.gl/.test(url.hostname + url.pathname)) {
        track('route_click', pagePath, 'spielort');
      } else if (url.hostname.endsWith('courtbooking.de')) {
        track('action_click', pagePath, 'platz_buchen');
      } else if (href === '/veranstaltung/' && elem.closest('.content-card__signup')) {
        track('action_click', pagePath, 'anmeldung_oeffnen');
      } else if (href && elem.closest('nav,header,.mobile-dock')) {
        track('nav_click', pagePath, targetFor(href));
      } else if (href && (elem.closest('.match-list,.live-center,.matchday-dashboard,.scorecenter-shell') || href === '/live/')) {
        track('content_click', pagePath, 'liveticker');
      } else if (href && elem.closest('.news-card,.event-card,.team-card,.card,.content-card')) {
        track('content_click', pagePath, targetFor(href));
      }
    } else if (elem.matches('[data-calendar-day],[data-day],[data-date]') || elem.closest('.calendar-grid,.calendar-days,.calendar-widget')) {
      track('calendar_click', pagePath, 'tag_oeffnen');
    } else if (elem.id === 'tv-ticker-fullscreen' || elem.matches('[data-tv-view]')) {
      track('action_click', pagePath, elem.id === 'tv-ticker-fullscreen' ? 'tv_vollbild' : 'tv_ansicht');
    }
  }, { capture: true, passive: true });
}
