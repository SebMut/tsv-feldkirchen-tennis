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
  // Once a tie-break has ended, only undoing the winner's last point may
  // reopen it. A fresh + click cannot extend an already finished tie-break.
  if (validateRegularTiebreak(existing).complete &&
      (change !== -1 || (side === 'tsv' ? 0 : 1) !== (existing[0] > existing[1] ? 0 : 1))) {
    return { valid: false, complete: true, points: existing,
      message: 'Tiebreak beendet. Den letzten Siegerpunkt mit − korrigieren.' };
  }
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

/** Numbers and HTML superscripts show both players' tie-break points:
 * next to both large game counts at 6:6 and after a finished 7:6/6:7 set.
 * All values are validated integers (never untrusted HTML).
 */
export function regularSetDisplayValues(score, setIndex, points, isHome = true) {
  const games = /^([0-9]{1,2}):([0-9]{1,2})$/.exec(String(score || ''));
  if (!games) return null;
  const [tsvGames, rivalGames] = [Number(games[1]), Number(games[2])];
  const tie = readRegularTiebreak(points, setIndex);
  let smallTsv = null, smallRival = null;
  if (tie && (tsvGames === 6 && rivalGames === 6)) {
    [smallTsv, smallRival] = tie;
  } else if (tie && ((tsvGames === 7 && rivalGames === 6) || (tsvGames === 6 && rivalGames === 7))
    && validateRegularTiebreak(tie).complete) {
    // Both values are shown, including the winner's (e.g. 7⁸ : 6⁶).
    [smallTsv, smallRival] = tie;
  }
  return isHome
    ? { first:tsvGames, second:rivalGames, smallFirst:smallTsv, smallSecond:smallRival }
    : { first:rivalGames, second:tsvGames, smallFirst:smallRival, smallSecond:smallTsv };
}

export function regularSetDisplayHtml(score, setIndex, points, isHome = true) {
  const values = regularSetDisplayValues(score, setIndex, points, isHome);
  if (!values) return '';
  const value = (games, small) => '<span class="ticker-set-side">' + String(games) +
    (small === null ? '' : '<sup class="ticker-set-tiebreak" aria-label="Tiebreak-Punkte ' + small + '">' + small + '</sup>') + '</span>';
  return '<span class="ticker-set-score">' + value(values.first, values.smallFirst) +
    '<span class="ticker-set-separator"> : </span>' + value(values.second, values.smallSecond) + '</span>';
}
