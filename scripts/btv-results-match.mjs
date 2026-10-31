// Pure result pairing: never accesses Supabase and never changes a live ticker.
import {normalizedName} from './btv-schedule.mjs';

export const parseScore=(raw)=>{
  const value=typeof raw==='string'?raw.replace(/\s+/gu,''):null;
  if (!value || value==='0:0' || !/^\d{1,2}:\d{1,2}$/.test(value)) return null;
  return value;
};
const identity=(seasonId,home,opponent)=>
  [seasonId,home?'H':'A',normalizedName(opponent)].join('|');

export function selectOfficialResults(fixtures, matches, teamSeasonIds, states=[], now=Date.now()) {
  const bySource=new Map(),byDb=new Map(),stateById=new Map(states.map(s=>[s.match_id,s]));
  let withoutResult=0, future=0, ambiguous=0, unmatched=0, oldConflict=0, existing=0, live=0, farDate=0;
  const updates=[];
  for(const row of matches){
    const key=identity(row.team_season_id,row.is_home,row.opponent);
    byDb.set(key,[...(byDb.get(key)||[]),row]);
  }
  for(const fixture of fixtures){
    const tsId=teamSeasonIds.get(fixture.slug);
    if(!tsId)throw Error('UNMAPPED_SOURCE_TEAM');
    const key=identity(tsId,fixture.isHome,fixture.opponent);
    bySource.set(key,(bySource.get(key)||0)+1);
  }
  for(const fixture of fixtures){
    const score=parseScore(fixture.score);
    if(!score){withoutResult++;continue;}
    if(Date.parse(fixture.startsAt)>now-30*60*1000){future++;continue;}
    const key=identity(teamSeasonIds.get(fixture.slug),fixture.isHome,fixture.opponent);
    const found=byDb.get(key)||[];
    if(found.length!==1 || bySource.get(key)!==1){
      if(found.length===0)unmatched++;else ambiguous++;
      continue;
    }
    const match=found[0];
    if(Math.abs(Date.parse(match.starts_at)-Date.parse(fixture.startsAt))>45*86400000){
      farDate++;continue;
    }
    const ticker=stateById.get(match.id);
    if(ticker?.status==='live'){live++;continue;}
    if(ticker?.status==='finished' &&
       (Number(ticker.home_score)!==Number(score.split(':')[0])
        || Number(ticker.away_score)!==Number(score.split(':')[1]))){
      oldConflict++;continue;
    }
    const stored=parseScore(match.btv_result_text);
    if(stored){
      if(stored===score)existing++;
      else oldConflict++;
      continue;
    }
    updates.push({id:match.id,score,slug:fixture.slug});
  }
  return {updates,withoutResult,future,ambiguous,unmatched,oldConflict,existing,live,farDate};
}

