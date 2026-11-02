import { supabase } from '../lib/supabase';

/**
 * Keep Live-Ticker navigation visible on all devices. Pulse red only when a match is live.
 */
export function initLiveNavPulse() {
  const liveLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.js-live-nav-link'));
  const fallbacks = Array.from(document.querySelectorAll<HTMLElement>('.js-live-nav-fallback'));
  if (!liveLinks.length && !fallbacks.length) return;

  const apply = (anyLive: boolean) => {
    for (const link of liveLinks) {
      link.hidden = false;
      link.setAttribute('aria-hidden', 'false');
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
    document.documentElement.classList.toggle('has-live-match', anyLive);
  };

  // Fail closed on the LIVE animation: the menu remains visible when status is unknown.
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
