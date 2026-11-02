/** Read-only public TV timing; editable by super admins in site_settings. */
export const DEFAULT_TV_TIMING = Object.freeze({
  refresh_seconds: 30,
  finished_every_seconds: 300,
  finished_show_seconds: 30,
  highlight_seconds: 300,
});
const LIMITS = Object.freeze({
  refresh_seconds: [5, 600],
  finished_every_seconds: [20, 3600],
  finished_show_seconds: [5, 900],
  highlight_seconds: [5, 3600],
});
export function normalizeTvTiming(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const normalized = {};
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const given = source[key];
    normalized[key] = Number.isInteger(given) && given >= min && given <= max
      ? given : DEFAULT_TV_TIMING[key];
  }
  // Display cannot consume an entire cycle; there must be an active-only phase.
  normalized.finished_show_seconds = Math.min(normalized.finished_show_seconds,
    normalized.finished_every_seconds - 1);
  return normalized;
}
export function tvFinishedPhase(nowMs, sessionStartedMs, timing, hasCompleted) {
  if (!hasCompleted) return false;
  const elapsed = Math.max(0, nowMs - sessionStartedMs);
  const every = timing.finished_every_seconds * 1000;
  const visible = timing.finished_show_seconds * 1000;
  return elapsed >= every && elapsed % every < visible;
}
export function tvHighlightWinner(encounter, nowMs, timing) {
  if (encounter?.status !== 'finished' || !encounter.finished_at) return null;
  const age = nowMs - new Date(encounter.finished_at).getTime();
  if (!(age >= 0 && age < timing.highlight_seconds * 1000)) return null;
  if (encounter.winner === 'tsv') return 'tsv';
  if (encounter.winner === 'opponent') return 'opponent';
  return null;
}
