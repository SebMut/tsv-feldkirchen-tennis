function splitScore(value: string) {
  const match = value.trim().match(/^(\d+)\s*:\s*(\d+)$/);
  return match ? [match[1], match[2]] : null;
}

function enhanceSetColumns(result: HTMLElement) {
  const sets = result.querySelector<HTMLElement>(':scope > span');
  if (!sets || sets.dataset.columns === 'true') return;
  const values = (sets.textContent || '')
    .split('·')
    .map((value) => splitScore(value))
    .filter((value): value is string[] => !!value);
  if (!values.length) return;
  sets.dataset.columns = 'true';
  sets.classList.add('ticker-running-encounter__sets');
  sets.innerHTML = values.map((value, index) => `
    <span class="ticker-running-encounter__set">
      <small>Satz ${index + 1}</small>
      <b>${value[0]}</b>
      <b>${value[1]}</b>
    </span>`).join('');
}

function ensureModal() {
  let modal = document.querySelector<HTMLElement>('#live-match-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'live-match-modal';
  modal.className = 'live-match-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="live-match-modal__backdrop" data-live-modal-close></div>
    <section class="live-match-modal__sheet" role="dialog" aria-modal="true" aria-labelledby="live-match-modal-title">
      <header class="live-match-modal__header">
        <div><small>LIVE</small><strong id="live-match-modal-title">Laufende Spiele</strong></div>
        <button type="button" class="live-match-modal__close" data-live-modal-close aria-label="Schließen">×</button>
      </header>
      <div class="live-match-modal__body"></div>
      <footer class="live-match-modal__footer"></footer>
    </section>`;
  document.body.append(modal);
  modal.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('[data-live-modal-close]')) closeModal(modal!);
  });
  return modal;
}

function closeModal(modal: HTMLElement) {
  modal.hidden = true;
  document.documentElement.classList.remove('live-modal-open');
}

function openModal(card: HTMLElement) {
  const modal = ensureModal();
  const title = modal.querySelector<HTMLElement>('#live-match-modal-title');
  const body = modal.querySelector<HTMLElement>('.live-match-modal__body');
  const footer = modal.querySelector<HTMLElement>('.live-match-modal__footer');
  const matchTitle = card.querySelector<HTMLElement>('.ticker-overview-feature__match-title h3')?.textContent?.trim() || 'Laufende Spiele';
  const running = card.querySelector<HTMLElement>('.ticker-running-encounters__list');
  const detail = card.querySelector<HTMLAnchorElement>('.ticker-overview-feature__action');
  if (title) title.textContent = matchTitle;
  if (body) body.innerHTML = running?.innerHTML || '<p class="live-match-modal__empty">Aktuell ist kein Einzel oder Doppel live.</p>';
  if (body) body.querySelectorAll<HTMLElement>('.ticker-running-encounter__result').forEach(enhanceSetColumns);
  if (footer) footer.innerHTML = detail ? `<a href="${detail.href}">Alle Einzel & Doppel ansehen →</a>` : '';
  modal.hidden = false;
  document.documentElement.classList.add('live-modal-open');
  modal.querySelector<HTMLButtonElement>('.live-match-modal__close')?.focus();
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

    card.querySelectorAll<HTMLElement>('.ticker-running-encounter__result').forEach((result) => {
      const total = result.querySelector<HTMLElement>(':scope > strong');
      if (total && !total.dataset.split) {
        const values = splitScore(total.textContent || '');
        if (values) {
          total.dataset.split = 'true';
          total.innerHTML = `<span>${values[0]}</span><span>${values[1]}</span>`;
        }
      }
      enhanceSetColumns(result);
    });

    if (!card.dataset.modalReady) {
      card.dataset.modalReady = 'true';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Punktspiel öffnen – laufende Einzel und Doppel anzeigen');
      const open = () => openModal(card);
      card.addEventListener('click', (event) => {
        if ((event.target as HTMLElement).closest('a')) return;
        open();
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    }
  });
}

export function initLiveScorecenter() {
  const center = document.querySelector<HTMLElement>('#live-center');
  if (!center) return;
  ensureModal();

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const modal = document.querySelector<HTMLElement>('#live-match-modal');
      if (modal && !modal.hidden) closeModal(modal);
    }
  });

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
