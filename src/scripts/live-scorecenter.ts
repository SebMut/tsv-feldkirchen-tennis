function splitScore(value: string) {
  const match = value.trim().match(/^(\d+)\s*:\s*(\d+)$/);
  return match ? [match[1], match[2]] : null;
}

function enhanceCenter(center: HTMLElement) {
  center.classList.add('scorecenter-ready');

  center.querySelectorAll<HTMLElement>('.ticker-overview-feature').forEach((card) => {
    const score = card.querySelector<HTMLElement>('.ticker-overview-feature__number > strong');
    if (score && !score.dataset.split) {
      const values = splitScore(score.textContent || '');
      if (values) {
        score.dataset.split = 'true';
        score.innerHTML = `<span>${values[0]}</span><span>${values[1]}</span>`;
      }
    }

    card.querySelectorAll<HTMLElement>('.ticker-running-encounter__result > strong').forEach((result) => {
      if (result.dataset.split) return;
      const values = splitScore(result.textContent || '');
      if (!values) return;
      result.dataset.split = 'true';
      result.innerHTML = `<span>${values[0]}</span><span>${values[1]}</span>`;
    });
  });
}

export function initLiveScorecenter() {
  const center = document.querySelector<HTMLElement>('#live-center');
  if (!center) return;

  let scheduled = false;
  const run = () => {
    scheduled = false;
    enhanceCenter(center);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(center, { childList: true, subtree: true });
  schedule();
}
