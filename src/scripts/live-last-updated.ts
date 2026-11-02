import { supabase } from '../lib/supabase';

function relativeUpdatedText(value: string | null | undefined): string {
  if (!value) return 'Zuletzt geändert: gerade eben';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Zuletzt geändert: gerade eben';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Zuletzt geändert: gerade eben';
  if (minutes === 1) return 'Zuletzt geändert: vor 1 Minute';
  if (minutes < 60) return `Zuletzt geändert: vor ${minutes} Minuten`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'Zuletzt geändert: vor 1 Stunde';
  if (hours < 24) return `Zuletzt geändert: vor ${hours} Stunden`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Zuletzt geändert: vor 1 Tag' : `Zuletzt geändert: vor ${days} Tagen`;
}

export async function enhanceLiveLastUpdated() {
  const center = document.querySelector<HTMLElement>('#live-center');
  if (!center) return;

  let refreshRunning = false;
  const refresh = async () => {
    if (refreshRunning) return;
    refreshRunning = true;
    try {
      const cards = Array.from(center.querySelectorAll<HTMLElement>('.ticker-overview-feature'));
      const ids = cards.map(card => {
        const href = card.querySelector<HTMLAnchorElement>('a[href*="/live/?match="]')?.href;
        return href ? new URL(href).searchParams.get('match') : null;
      }).filter((id): id is string => !!id);
      if (!ids.length) return;

      const { data } = await supabase.from('match_live_state').select('match_id,updated_at').in('match_id', ids);
      const updatedByMatch = new Map((data ?? []).map(row => [String(row.match_id), row.updated_at]));

      for (const card of cards) {
        const link = card.querySelector<HTMLAnchorElement>('a[href*="/live/?match="]');
        const matchId = link ? new URL(link.href).searchParams.get('match') : null;
        if (!matchId) continue;
        let label = card.querySelector<HTMLElement>('.ticker-overview-feature__updated');
        if (!label) {
          label = document.createElement('small');
          label.className = 'ticker-overview-feature__updated';
          label.setAttribute('aria-live', 'polite');
          card.querySelector('.ticker-overview-feature__match-title')?.append(label);
        }
        const nextText = relativeUpdatedText(updatedByMatch.get(matchId));
        if (label && label.textContent !== nextText) label.textContent = nextText;
      }
    } finally {
      refreshRunning = false;
    }
  };

  const observer = new MutationObserver(() => void refresh());
  observer.observe(center, { childList: true, subtree: false });
  await refresh();
  window.setInterval(() => void refresh(), 60000);
}
