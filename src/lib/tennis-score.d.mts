export type SetResultSummary = {
  scores: string[];
  tsvSets: number;
  opponentSets: number;
  complete: boolean;
  winner: 'tsv' | 'opponent' | null;
  hasResult: boolean;
  inProgressSetIndex: number | null;
};
export function summarizeSetResult(resultText: string | null | undefined): SetResultSummary;
export function homeAwaySetScore(result: SetResultSummary, isHome: boolean): {homeSets: number; awaySets: number};
export function validateSetScore(score: string, setIndex: number): { valid: boolean; complete: boolean; message: string };
