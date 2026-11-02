// TSV : Gegner. Only regular sets 1 and 2; third set uses the existing match-tiebreak.
export function regularTiebreakScore(value) {
  if (!Array.isArray(value) || value.length !== 2 ||
    !value.every(n => Number.isInteger(n) && n >= 0 && n <= 99)) return null;
  return [value[0], value[1]];
}

export function readRegularTiebreak(points, setIndex) {
  if (![0, 1].includes(setIndex)) return null;
  return regularTiebreakScore(points?.[String(setIndex + 1)]);
}

export function validateRegularTiebreak(points) {
  const score = regularTiebreakScore(points);
  if (!score) return { valid: false, complete: false, message: 'Bitte zwei gültige Tiebreak-Punkte eingeben.' };
  const [tsv, opponent] = score;
  const high = Math.max(tsv, opponent);
  const low = Math.min(tsv, opponent);
  // At 7 a two-point lead ends the tiebreak; at 6:6 it continues
  // until a player leads by two (8:6, 9:7, 10:8, ...).
  const complete = high >= 7 && high - low >= 2;
  if (high > 7 && high - low > 2) {
    return { valid: false, complete: false, message: 'Nach dem siebten Punkt endet der Tiebreak sofort bei zwei Punkten Vorsprung.' };
  }
  return { valid: true, complete, message: '' };
}

export function adjustRegularTiebreak(points, side, change) {
  if (!['tsv','opponent'].includes(side) || ![-1,1].includes(change)) {
    return { valid: false, complete: false, points, message: 'Ungültige Tiebreak-Auswahl.' };
  }
  const existing = regularTiebreakScore(points ?? [0,0]);
  if (!existing) return { valid: false, complete: false, points, message: 'Tiebreak-Zähler ist ungültig.' };
  const next = [...existing];
  next[side === 'tsv' ? 0 : 1] += change;
  const test = validateRegularTiebreak(next);
  return { ...test, points: test.valid ? next : existing };
}

export function regularSetFromTiebreak(points) {
  const values = regularTiebreakScore(points);
  const state = validateRegularTiebreak(values);
  if (!state.valid) return null;
  if (!state.complete) return '6:6';
  return values[0] > values[1] ? '7:6' : '6:7';
}

export function regularTiebreakLabel(points, setIndex, isHome = true) {
  const entry = readRegularTiebreak(points, setIndex);
  if (!entry) return '';
  return isHome ? entry.join(':') : entry.slice().reverse().join(':');
}
