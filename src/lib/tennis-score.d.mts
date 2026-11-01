export type SetResultSummary = {
  scores: string[];
  tsvSets: number;
  opponentSets: number;
  complete: boolean;
  winner: 'tsv' | 'opponent' | null;
  hasResult: boolean;
};
export function summarizeSetResult(resultText: string | null | undefined): SetResultSummary;
export function homeAwaySetScore(result: SetResultSummary, isHome: boolean): {homeSets: number; awaySets: number};
