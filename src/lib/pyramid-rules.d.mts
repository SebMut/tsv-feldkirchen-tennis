export declare function pyramidCell(position: number): {row:number;column:number}|null;
export declare function canChallenge(challengerPosition:number, defenderPosition:number): boolean;
export declare function pyramidRows<T extends {position:number}>(entries:T[]): Array<Array<T|null>>;
export declare function dateWithinPeriod(startsOn:string,endsOn:string,today?:Date):boolean;
export declare function scoreWinner(score:string): 1|2|null;

export declare function canQualifyAgainst(defenderPosition:number, rankedEntries:Array<{position:number;qualified?:boolean}>):boolean;
