import { supabase } from '../lib/supabase';

/**
 * Desktop/menu: always show Live-Ticker. Mobile dock: show Mannschaften until a match is live.\n * The existing red pulse appears only for confirmed LIVE matches.
 */
export function initLiveNavPulse() {
  const liveLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.js-live-nav-link'));
  const fallbacks = Array.from(document.querySelectorAll<HTMLElement>('.js-live-nav-fallback'));
  if (!liveLinks.length && !fallbacks.length) return;

  const apply = (anyLive: boolean) => {
    for (const link of liveLinks) {
      // The dock has one shared slot: it switches to the teams link when idle.
      // Desktop and the full menu must retain their existing Live-Ticker links.
      link.hidden = link.classList.contains('js-live-nav-dock-link') && !anyLive;
      link.setAttribute('aria-hidden', String(link.hidden));
      link.classList.toggle('has-live-match', anyLive);
      if (anyLive) {
        link.setAttribute('aria-label', 'Live-Ticker – jetzt läuft ein Spiel');
        link.setAttribute('title', 'Jetzt live: TSV-Spieltag');
      } else {
        link.setAttribute('aria-label', 'Live-Ticker');
        link.removeAttribute('title');
      }
    }
    for (const fallback of fallbacks) {
      fallback.hidden = anyLive;
      fallback.setAttribute('aria-hidden', String(anyLive));
    }
    // A team page belongs to the dock tab while idle and to 'Mehr' while live.
    if (fallbacks.some((fallback) => fallback.classList.contains('is-active'))) {
      document.querySelector<HTMLElement>('.mobile-dock__more > summary')?.classList.toggle('is-active', anyLive);
    }
    document.documentElement.classList.toggle('has-live-match', anyLive);
  };

  // Until a LIVE state is confirmed, keep the Mannschaften dock tab visible.
  apply(false);

  let busy = false;
  const refresh = async () => {
    if (busy || document.visibilityState === 'hidden') return;
    busy = true;
    try {
      const { data, error } = await supabase
        .from('match_live_state')
        .select('match_id')
        .eq('status', 'live')
        .limit(1);
      if (error) {
        apply(false);
        return;
      }
      apply((data?.length || 0) > 0);
    } catch {
      apply(false);
    } finally {
      busy = false;
    }
  };

  void refresh();
  const timer = window.setInterval(() => void refresh(), 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh();
  });
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
}
