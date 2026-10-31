// Reconcile published BTV summer-2026 source vs TSV fixture rows, without writes.
// Opponents, fixture dates and match scores are public competition information.
// Do not access player rosters, private names, contacts or ticker text.
import {createClient} from '@supabase/supabase-js';
import {getClubSchedule,normalizedName} from './btv-schedule.mjs';
const PROJECT='https://eaurnufdochjapfzqwvm.supabase.co';
const secret=process.env.BTV_SUPABASE_SECRET_KEY;
if(!secret)throw Error('BTV_SUPABASE_SECRET_KEY_REQUIRED');
const db=createClient(PROJECT,secret,{auth:{autoRefreshToken:false,persistSession:false}});
const read=async (rq,msg)=>{const {data,error}=await rq;if(error||!Array.isArray(data))throw Error(msg);return data;};
const season=await read(db.from('seasons').select('id,code').eq('code','sommer-2026'),'SEASON_READ_FAILED');
if(season.length!==1)throw Error('SEASON_INVALID');
const [ts,teams]=await Promise.all([
 read(db.from('team_seasons').select('id,team_id').eq('season_id',season[0].id),'TEAM_SEASON_READ_FAILED'),
 read(db.from('teams').select('id,slug').limit(100),'TEAMS_READ_FAILED')]);
if(ts.length!==20)throw Error('TEAM_COUNT_INVALID');
const teamMap=new Map(teams.map(t=>[t.id,t.slug]));
const seasonTeamMap=new Map(ts.map(t=>[t.id,teamMap.get(t.team_id)]));
const matches=await read(db.from('matches').select('id,team_season_id,opponent,is_home,starts_at,btv_result_text,slug')
  .in('team_season_id',ts.map(x=>x.id)).limit(300),'MATCHES_READ_FAILED');
if(matches.length!==121)throw Error('MATCHES_COUNT_CHANGED');
const source=(await getClubSchedule(2026)).fixtures;
if(source.length!==120)throw Error('SOURCE_COUNT_CHANGED');
const pending=matches.filter(m=>!m.btv_result_text?.trim())
  .sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
if(pending.length<1||pending.length>40)throw Error('PENDING_COUNT_UNEXPECTED');
console.log('BTV_RECON_DB_MATCHES='+matches.length);
console.log('BTV_RECON_SOURCE_MATCHES='+source.length);
console.log('BTV_RECON_PENDING='+pending.length);
const normal=x=>normalizedName(x).replace(/[‑–—-]/g,'-');
const localDate=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
for(const m of pending){
  const slug=seasonTeamMap.get(m.team_season_id);
  if(!slug)throw Error('MISSING_SLUG');
  const candidates=source.filter(f=>f.slug===slug);
  const exact=candidates.filter(f=>f.isHome===m.is_home&&normal(f.opponent)===normal(m.opponent));
  const sameDate=candidates.filter(f=>f.isHome===m.is_home&&localDate(f.startsAt)===localDate(m.starts_at));
  const sameOpponent=candidates.filter(f=>normal(f.opponent)===normal(m.opponent));
  let type='UNMATCHED';
  let possible=[];
  if(exact.length===1){
    possible=exact;
    type=exact[0].score?'OFFICIAL_SCORE_MISSED':'BTV_SOURCE_NO_RESULT';
  } else if(exact.length>1){
    possible=exact;
    type='MULTIPLE_BTV_SOURCE_ROWS';
  } else if(sameDate.length===1){
    possible=sameDate;
    type='OPPONENT_MISMATCH_SAME_DAY';
  } else if(sameOpponent.length===1){
    possible=sameOpponent;
    type='HOME_AWAY_MISMATCH';
  }
  console.log('BTV_RECON_ITEM=' + JSON.stringify({
    team:slug,date:localDate(m.starts_at),opponent:m.opponent,home:m.is_home,kind:type,
    candidates:possible.slice(0,3).map(f=>({date:f.date,opponent:f.opponent,
      home:f.isHome,score:f.score||null})),
  }));
}
console.log('BTV_RECON_COMPLETE=READ_ONLY');
