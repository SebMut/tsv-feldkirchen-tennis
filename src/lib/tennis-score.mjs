// Alle Werte werden aus TSV-Sicht als "TSV:Gegner" gespeichert.
// Einzelne Sätze dürfen einen laufenden Spielstand enthalten.
const REGULAR = new Set([
  '6:0','0:6','6:1','1:6','6:2','2:6','6:3','3:6',
  '6:4','4:6','7:5','5:7','7:6','6:7',
]);

/** Ein regulärer Satz ist bei 6:x (x<=4), 7:5 oder 7:6 entschieden. */
function isCompleteRegular(a, b) {
  return REGULAR.has(`${a}:${b}`);
}

/** Match-Tiebreak: bis 10 mit 2 Punkten Vorsprung; Verlängerung ab 9:9. */
function isCompleteMatchTiebreak(a, b) {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return (high === 10 && low <= 8) || (high > 10 && low === high - 2);
}

/** Manuelle Zwischenstände werden auf plausible Tennis-Zähler begrenzt. */
export function validateSetScore(score, setIndex) {
  if (![0, 1, 2].includes(setIndex)) return { valid: false, complete: false, message: 'Ungültiger Satz.' };
  const match = /^([0-9]{1,2}):([0-9]{1,2})$/.exec(String(score || ''));
  if (!match) return { valid: false, complete: false, message: 'Bitte zwei ganze Zahlen eingeben.' };
  const a = Number(match[1]);
  const b = Number(match[2]);

  if (setIndex !== 2) {
    if (a > 7 || b > 7) return { valid: false, complete: false, message: 'Ein regulärer Satz darf höchstens 7 Spiele je Seite enthalten.' };
    const complete = isCompleteRegular(a, b);
    // 7:x ist nur als fertiges 7:5 / 7:6 möglich.
    if ((a === 7 || b === 7) && !complete) {
      return { valid: false, complete: false, message: 'Bei 7 Spielen ist nur 7:5 oder 7:6 (bzw. umgekehrt) möglich.' };
    }
    return { valid: true, complete, message: '' };
  }
  const complete = isCompleteMatchTiebreak(a, b);
  // Ein Tiebreak endet unmittelbar beim zehnten Punkt mit 2 Punkten Vorsprung.
  // Ab 10 Punkten sind daher nur 1 Punkt Abstand (laufend) oder 2 (beendet) möglich.
  if (Math.max(a, b) > 10 && Math.abs(a - b) > 2
    || Math.max(a, b) === 10 && Math.abs(a - b) > 2 && Math.min(a, b) >= 9) {
    return { valid: false, complete: false, message: 'Der Match-Tiebreak endet bei 10 Punkten und mindestens 2 Punkten Vorsprung.' };
  }
  if (Math.max(a, b) > 10 && !complete && Math.abs(a-b) !== 1 && a !== b) {
    return { valid: false, complete: false, message: 'Ein Match-Tiebreak über 10 Punkten muss im Gleichstand oder mit 1 Punkt Abstand noch laufen.' };
  }
  return { valid: true, complete, message: '' };
}

export function summarizeSetResult(resultText) {
  // Kompatibel zu bisher gespeicherten Doppelpunkt-/Bindestrich-Ergebnissen.
  const tokens = String(resultText || '').match(/\b\d{1,2}\s*[:-]\s*\d{1,2}\b/g) || [];
  const normalized = tokens.slice(0, 3).map((token) => token.replace(/\s/g, '').replace('-', ':'));
  const scores = ['', '', ''];
  let tsvSets = 0;
  let opponentSets = 0;
  let inProgressSetIndex = null;

  for (let i = 0; i < 3; i++) {
    if (i > 0 && !scores[i - 1]) break;
    if (i === 2 && (tsvSets !== 1 || opponentSets !== 1)) break;
    const score = normalized[i] || '';
    if (!score) break;
    const state = validateSetScore(score, i);
    if (!state.valid) break;

    scores[i] = score;
    if (!state.complete) {
      inProgressSetIndex = i;
      break; // Kein folgender Satz, solange der aktuelle nicht fertig ist.
    }
    const [tsv, opponent] = score.split(':').map(Number);
    if (tsv > opponent) tsvSets++;
    else opponentSets++;
    if (tsvSets === 2 || opponentSets === 2) break;
  }
  const complete = tsvSets === 2 || opponentSets === 2;
  return {
    scores,
    tsvSets,
    opponentSets,
    complete,
    winner: complete ? (tsvSets === 2 ? 'tsv' : 'opponent') : null,
    hasResult: scores.some(Boolean),
    inProgressSetIndex,
  };
}

export function homeAwaySetScore(result, isHome) {
  return {
    homeSets: isHome ? result.tsvSets : result.opponentSets,
    awaySets: isHome ? result.opponentSets : result.tsvSets,
  };
}
