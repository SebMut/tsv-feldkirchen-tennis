export function regularTiebreakScore(value: unknown): [number, number] | null;
export function readRegularTiebreak(points: Record<string,unknown> | null | undefined, setIndex: number): [number,number] | null;
export function validateRegularTiebreak(points: unknown): { valid:boolean; complete:boolean; message:string };
export function adjustRegularTiebreak(points: unknown, side: 'tsv' | 'opponent', change: number): { valid:boolean; complete:boolean; points: unknown; message:string };
export function regularSetFromTiebreak(points: unknown): string | null;
export function regularTiebreakLabel(points: Record<string,unknown> | null | undefined, setIndex: number, isHome?: boolean): string;
export function regularSetDisplayValues(score: string, setIndex: number, points: Record<string,unknown> | null | undefined, isHome?: boolean): { first:number; second:number; smallFirst:number|null; smallSecond:number|null } | null;
export function regularSetDisplayHtml(score: string, setIndex: number, points: Record<string,unknown> | null | undefined, isHome?: boolean): string;
