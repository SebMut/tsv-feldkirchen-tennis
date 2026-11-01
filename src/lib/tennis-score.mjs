// Ein Satzstand wird immer aus TSV-Sicht gespeichert (TSV : Gegner).
// Die Anzeige Heim : Gast wird nur zur Darstellung umgedreht.
const REGULAR = new Set([
  '6:0','0:6','6:1','1:6','6:2','2:6','6:3','3:6',
  '6:4','4:6','7:5','5:7','7:6','6:7',
]);
const TIEBREAK = new Set([
  '10:0','0:10','10:1','1:10','10:2','2:10','10:3','3:10',
  '10:4','4:10','10:5','5:10','10:6','6:10','10:7','7:10',
  '10:8','8:10','11:9','9:11','12:10','10:12','13:11','11:13',
  '14:12','12:14',
]);

export function summarizeSetResult(resultText) {
  const tokens = String(resultText || '').match(/\b\d{1,2}\s*[:-]\s*\d{1,2}\b/g) || [];
  const normalized = tokens.slice(0, 3).map((token) => token.replace(/\s/g, '').replace('-', ':'));
  const scores = [
    REGULAR.has(normalized[0]) ? normalized[0] : '',
    REGULAR.has(normalized[1]) ? normalized[1] : '',
    TIEBREAK.has(normalized[2]) ? normalized[2] : '',
  ];

  // Ein zweiter Satz ist erst nach Satz 1 gültig.
  if (!scores[0]) scores[1] = '';
  let tsvSets = 0;
  let opponentSets = 0;
  for (const score of scores.slice(0, 2)) {
    if (!score) break;
    const [tsv, opponent] = score.split(':').map(Number);
    if (tsv > opponent) tsvSets++;
    else opponentSets++;
  }
  // Der dritte Satz ist nur beim Stand von 1:1 möglich.
  if (tsvSets !== 1 || opponentSets !== 1) scores[2] = '';
  if (scores[2]) {
    const [tsv, opponent] = scores[2].split(':').map(Number);
    if (tsv > opponent) tsvSets++;
    else opponentSets++;
  }
  const complete = tsvSets === 2 || opponentSets === 2;
  return {
    scores,
    tsvSets,
    opponentSets,
    complete,
    winner: complete ? (tsvSets === 2 ? 'tsv' : 'opponent') : null,
    hasResult: scores.some(Boolean),
  };
}

export function homeAwaySetScore(result, isHome) {
  return {
    homeSets: isHome ? result.tsvSets : result.opponentSets,
    awaySets: isHome ? result.opponentSets : result.tsvSets,
  };
}
