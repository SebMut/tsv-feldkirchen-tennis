// Mirrors the server-side geometry; Supabase RPCs remain authoritative.
export function pyramidCell(position) {
  if (!Number.isInteger(position) || position < 1) return null;
  const row = Math.floor((Math.sqrt(8 * position - 7) - 1) / 2);
  const column = position - (row * (row + 1)) / 2 - 1;
  return { row, column };
}
export function canChallenge(challengerPosition, defenderPosition) {
  if (!Number.isInteger(challengerPosition) || !Number.isInteger(defenderPosition)
    || challengerPosition <= defenderPosition || defenderPosition < 1) return false;
  const c = pyramidCell(challengerPosition);
  const d = pyramidCell(defenderPosition);
  if (!c || !d) return false;
  return challengerPosition <= 3
    || (c.row === d.row && d.column < c.column)
    || (d.row === c.row - 1 && d.column >= c.column);
}
// TSV §Neueinsteiger: any ranked player may be challenged in the entry game.
export function canQualifyAgainst(defenderPosition, rankedEntries) {
  return rankedEntries.some(entry=>entry.qualified!==false && entry.position===defenderPosition);
}
export function pyramidRows(entries) {
  const positions = new Map(entries.map((entry) => [entry.position, entry]));
  const rows = [];
  let next = 1;
  while (next <= Math.max(0, ...entries.map((entry) => entry.position))) {
    const count = rows.length + 1;
    rows.push(Array.from({ length: count }, (_, index) => positions.get(next + index) ?? null));
    next += count;
  }
  return rows;
}
export function dateWithinPeriod(startsOn, endsOn, today = new Date()) {
  const iso = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')].join('-');
  return iso >= startsOn && iso <= endsOn;
}
export function scoreWinner(score) {
  if (!/^\d{1,2}:\d{1,2}(, ?\d{1,2}:\d{1,2}){1,2}$/.test(score.trim())) return null;
  const sets = score.split(/,\s*/).map((set) => set.split(':').map(Number));
  let first = 0, second = 0;
  for (let i = 0; i < sets.length; i++) {
    const [a, b] = sets[i];
    const hi = Math.max(a, b), lo = Math.min(a, b);
    const normal = (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6));
    const matchTie = hi >= 10 && hi - lo >= 2;
    if (i < 2 && !normal) return null;
    if (i === 2 && !matchTie) return null;
    if (a > b) first++; else second++;
  }
  if (sets.length === 2 && (first === 2 || second === 2)) return first === 2 ? 1 : 2;
  if (sets.length === 3 && first === 2 && second === 1) return 1;
  if (sets.length === 3 && second === 2 && first === 1) return 2;
  return null;
}
