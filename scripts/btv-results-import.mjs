// Official BTV final-score import, read-only unless explicitly enabled on main.
// Never changes fixture times, locations, home/away, lineup or live ticker.
import {getClubSchedule} from './btv-schedule.mjs';
import {parseScore,selectOfficialResults} from './btv-results-match.mjs';
import {getWinterSchedule} from './btv-winter-schedule.mjs';

const PROJECT='https://eaurnufdochjapfzqwvm.supabase.co';
const SEASONS=[{code:'sommer-2026',expected:120,source:()=>getClubSchedule(2026)},
  {code:'winter-2026-2027',expected:15,source:getWinterSchedule}];
const apply=process.argv.includes('--apply');
if(apply && process.env.BTV_RESULTS_WRITE_ENABLED!=='true')throw Error('WRITE_FLAG_REQUIRED');
const sources=[];
for(const item of SEASONS) {
  const report=await item.source();
  if(report.fixtures.length!==item.expected)throw Error('BTV_SOURCE_FIXTURE_COUNT_CHANGED');
  const published=report.fixtures.filter(f=>parseScore(f.score)).length;
  if(item.code==='sommer-2026' && published<100)throw Error('SUMMER_BTV_RESULTS_INCOMPLETE');
  if(item.code==='winter-2026-2027' && published<4)throw Error('WINTER_BTV_RESULTS_INCOMPLETE');
  sources.push({...item,fixtures:report.fixtures});
}
const key=process.env.BTV_SUPABASE_SECRET_KEY;
if(!key)throw Error('RESULTS_SUPABASE_KEY_REQUIRED');
const {createClient}=await import('@supabase/supabase-js');
const db=createClient(PROJECT,key,{auth:{autoRefreshToken:false,persistSession:false}});
const query=async (request,label)=>{
  const {data,error}=await request;
  if(error||!Array.isArray(data))throw Error(label+'_FAILED');
  return data;
};
const [seasons,teams,teamSeasons]=await Promise.all([
 query(db.from('seasons').select('id,code').in('code',SEASONS.map(s=>s.code)),'SEASONS'),
 query(db.from('teams').select('id,slug').limit(150),'TEAMS'),
 query(db.from('team_seasons').select('id,team_id,season_id').limit(200),'TEAM_SEASONS')
]);
const byTeam=new Map(teams.map(t=>[t.id,t.slug]));
const totals={updated:0,matched:0,unmatched:0,ambiguous:0,existing:0,conflicts:0,missingSourceResults:0};
for(const source of sources){
  const season=seasons.filter(s=>s.code===source.code);
  if(season.length!==1)throw Error('SEASON_NOT_UNIQUE');
  const active=teamSeasons.filter(ts=>ts.season_id===season[0].id);
  if(active.length!==(source.code==='sommer-2026'?20:3))throw Error('TEAM_SEASON_COUNT_MISMATCH');
  const mapped=new Map(active.map(ts=>[byTeam.get(ts.team_id),ts.id]));
  if(mapped.size!==active.length)throw Error('TEAM_SEASON_DUPLICATE');
  const ids=active.map(ts=>ts.id);
  const matches=await query(db.from('matches').select('id,team_season_id,opponent,is_home,starts_at,btv_result_text')
    .in('team_season_id',ids).limit(400),'MATCHES');
  const states=await query(db.from('match_live_state').select('match_id,status,home_score,away_score')
    .in('match_id',matches.map(m=>m.id)).limit(400),'STATES');
  // Sommer 2026 had BTV-verified postponements from May into late July
  // (up to 78+ days). Exact club, team, side and opponent still have to match.
  // Preserve the tighter default for the winter round.
  const selected=selectOfficialResults(source.fixtures,matches,mapped,states,Date.now(),
    source.code==='sommer-2026'?120:45);
  console.log('BTV_RESULTS_MATCHES_'+source.code+'='+matches.length);
  console.log('BTV_RESULTS_SCORED_SOURCE_'+source.code+'='+
    source.fixtures.filter(f=>parseScore(f.score)).length);
  console.log('BTV_RESULTS_SAFE_UPDATES_'+source.code+'='+selected.updates.length);
  console.log('BTV_RESULTS_UNMATCHED_'+source.code+'='+selected.unmatched);
  console.log('BTV_RESULTS_AMBIGUOUS_'+source.code+'='+selected.ambiguous);
  console.log('BTV_RESULTS_PREEXISTING_'+source.code+'='+selected.existing);
  console.log('BTV_RESULTS_CONFLICTS_'+source.code+'='+selected.oldConflict);
  if (source.code==='sommer-2026' && selected.updates.length+selected.existing<60)
    throw Error('TOO_FEW_VERIFIED_MATCHES');
  if(selected.oldConflict>0)console.log('BTV_RESULTS_MANUAL_REVIEW_REQUIRED='+selected.oldConflict);
  totals.matched+=selected.updates.length+selected.existing;
  totals.unmatched+=selected.unmatched;
  totals.ambiguous+=selected.ambiguous;
  totals.existing+=selected.existing;
  totals.conflicts+=selected.oldConflict;
  totals.missingSourceResults+=selected.withoutResult;
  if(!apply)continue;
  for(const u of selected.updates){
    const {data,error}=await db.from('matches').update({
      btv_result_text:u.score,btv_last_synced_at:new Date().toISOString()
    }).eq('id',u.id).is('btv_result_text',null).select('id');
    if(error||data?.length!==1)throw Error('RESULT_UPDATE_FAILED_OR_CHANGED');
    totals.updated++;
  }
}
console.log('BTV_RESULTS_TOTAL='+JSON.stringify(totals));
console.log('BTV_RESULTS_RUN='+(apply?'APPLIED':'DRY_RUN'));
