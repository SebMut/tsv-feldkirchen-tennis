// Validated public TV timings (seconds), edited by super admins in site_settings.
export const DEFAULT_TV_TIMING = Object.freeze({
  poll_seconds: 30,
  recap_every_seconds: 300,
  recap_duration_seconds: 30,
  highlight_seconds: 300,
});
const integerInRange = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
export function readTvTiming(value) {
  const source = value && typeof value === 'object' ? value : {};
  const every = integerInRange(source.recap_every_seconds, 10, 3600, 300);
  return {
    poll_seconds: integerInRange(source.poll_seconds, 5, 600, 30),
    recap_every_seconds: every,
    recap_duration_seconds: integerInRange(source.recap_duration_seconds, 1, every - 1, Math.min(30, every - 1)),
    highlight_seconds: integerInRange(source.highlight_seconds, 5, 3600, 300),
  };
}
export function recapIsActive(timing, atMs, startMs) {
  const cycleMs = timing.recap_every_seconds * 1000;
  const elapsed = Math.max(0, atMs - startMs);
  return elapsed >= cycleMs && elapsed % cycleMs < timing.recap_duration_seconds * 1000;
}
export function withinHighlight(finishedAt, timing, atMs) {
  if (!finishedAt) return false;
  const finished = new Date(finishedAt).getTime();
  return Number.isFinite(finished) && atMs >= finished && atMs - finished < timing.highlight_seconds * 1000;
}
