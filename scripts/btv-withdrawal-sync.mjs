// Weekly official BTV withdrawal audit. Server-side and restricted to the TSV project.
// No score changes, no ticker writes, no public-player data, no absence-based inference.
import {createClient} from '@supabase/supabase-js';
import {fetchClubGroupReport} from './btv-withdrawal-club-report.mjs';
import {
  groupIdFromBtvUrl,readBtvGroupWithdrawals,matchWithdrawalToFixture
} from './btv-withdrawal-source.mjs';

const PROJECT='https://eaurnufdochjapfzqwvm.supabase.co';
const apply=process.argv.includes('--apply');
const seasonArg=process.argv.find(x=>x.startsWith('--season='))?.slice('--season='.length);
if(seasonArg && !/^sommer-20\d{2}$|^winter-20\d{2}-20\d{2}$/.test(seasonArg))
  throw Error('UNVERIFIED_SEASON_FORMAT');
if(apply && process.env.BTV_WITHDRAWALS_WRITE_ENABLED!=='true')
  throw Error('BTV_WITHDRAWALS_WRITE_FLAG_REQUIRED');
if(apply && process.env.GITHUB_REF!=='refs/heads/main')
  throw Error('BTV_WITHDRAWALS_MAIN_BRANCH_ONLY');
const secret=process.env.BTV_SUPABASE_SECRET_KEY;
if(!secret)throw Error('BTV_SUPABASE_SECRET_KEY_REQUIRED');

const db=createClient(PROJECT,secret,{auth:{autoRefreshToken:false,persistSession:false}});
const get=async(request,label)=>{
  const {data,error}=await request;
  if(error||!Array.isArray(data))throw Error(label+': '+(error?.message||'INVALID_DATA'));
  return data;
};

const seasons=await get(db.from('seasons').select('id,code').limit(50),'SEASONS');
const eligible=seasons.filter(s=>
  (!seasonArg||s.code===seasonArg)&&
  (/^sommer-20\d{2}$|^winter-20\d{2}-20\d{2}$/.test(s.code))
);
if(seasonArg&&!eligible.length)throw Error('SEASON_NOT_FOUND');
const [teams,registrations]=await Promise.all([
  get(db.from('teams').select('id,name').limit(100),'TEAMS'),
  get(db.from('team_seasons').select('id,team_id,season_id,btv_url,group_name').limit(200),'TEAM_SEASONS')
]);
const teamNames=new Map(teams.map(t=>[t.id,t.name]));
const groupPlans=registrations.filter(ts=>eligible.some(s=>s.id===ts.season_id))
  .map(ts=>({...ts,season_code:eligible.find(s=>s.id===ts.season_id)?.code,
    group_id:groupIdFromBtvUrl(ts.btv_url),team_name:teamNames.get(ts.team_id)}))
  .filter(ts=>ts.group_id&&ts.team_name&&/Gr\.\s*\d+/.test(ts.group_name||''));
if(groupPlans.length>28)throw Error('BTV_GROUP_LIMIT_EXCEEDED');
const seen=new Set();
for(const p of groupPlans){
  const key=p.season_code+':'+p.group_id;
  if(seen.has(key))throw Error('DUPLICATE_OFFICIAL_GROUP_REF_'+key);
  seen.add(key);
}
let checked=0,withdrawals=0,candidates=0,stored=0,ignored=0,blocked=0;
const clubReports=new Map();
const sourceSeasonCodes=[...new Set(groupPlans.map(p=>p.season_code))];
for(const seasonCode of sourceSeasonCodes){
  try {
    const report=await fetchClubGroupReport(seasonCode);
    if(report) {
      clubReports.set(seasonCode,report);
      console.log('BTV_CLUB_GROUP_REPORT='+JSON.stringify({
        season:seasonCode,pages:report.pages,
        groups:report.groupsSeen.length,groupNumbers:report.groupsSeen.sort((a,b)=>a-b),withdrawals:report.entries.length,rawWithdrawalMarkers:report.rawWithdrawalMarkers
      }));
    } else console.log('BTV_CLUB_GROUP_NO_VERIFIED_REFERENCE='+seasonCode);
  }catch(error){
    const code=String(error?.message||error).slice(0,100);
    console.log('BTV_CLUB_GROUP_UNAVAILABLE='+JSON.stringify({season:seasonCode,error:code}));
    if(code==='BTV_CLUB_GROUP_BLOCKED') {
      blocked++;
      console.log('BTV_WITHDRAWAL_ABORTED_ON_BLOCK=true');
      process.exit(0); // never bypass, retry or change source on BTV access block
    }
  }
}
console.log('BTV_WITHDRAWAL_GROUPS='+groupPlans.length);
const groupsCoveredByClubReport=new Set(
  groupPlans.filter(p=>{
    const g=Number(p.group_name.match(/Gr\.\s*0*(\d+)/)?.[1]);
    return clubReports.get(p.season_code)?.groupsSeen.includes(g);
  }).map(p=>p.season_code+':'+p.group_id)
);
console.log('BTV_WITHDRAWAL_CLUB_GROUP_COVERAGE='+groupsCoveredByClubReport.size);

for(const plan of groupPlans){
  let source;
  try{
    const report=clubReports.get(plan.season_code);
    const groupNumber=Number(plan.group_name.match(/Gr\.\s*0*(\d+)/)?.[1]);
    if(report?.groupsSeen.includes(groupNumber)) {
      source={url:report.url,entries:report.entries.filter(e=>e.group===groupNumber)};
    } else {
      source=await readBtvGroupWithdrawals(plan.group_id,{
        seasonCode:plan.season_code,groupName:plan.group_name
      });
    }
  }catch(error){
    const code=String(error?.message||error).slice(0,100);
    console.log('BTV_WITHDRAWAL_GROUP_UNAVAILABLE='+JSON.stringify({
      season:plan.season_code,group:plan.group_id,error:code
    }));
    if(code==='BTV_BLOCKED_OR_RATE_LIMITED'){
      blocked++;
      break; // never bypass a BTV block or add retries
    }
    ignored++;
    continue;
  }
  checked++;
  withdrawals+=source.entries.length;
  if(!source.entries.length)continue;
  const matches=await get(db.from('matches')
    .select('id,opponent,is_home,starts_at,btv_result_text')
    .eq('team_season_id',plan.id).limit(25),'MATCHES');
  const existingManual=await get(db.from('manual_match_results')
    .select('match_id,result_status').in('match_id',matches.map(m=>m.id)).limit(25),'MANUAL');
  const manualMap=new Map(existingManual.map(m=>[m.match_id,m]));
  const existingFlags=await get(db.from('match_withdrawal_flags')
    .select('match_id,affected_side,verification_status').in('match_id',matches.map(m=>m.id)).limit(25),'FLAGS');
  const previousFlags=new Map(existingFlags.map(f=>[f.match_id,f]));
  for(const m of matches){
    const matched=source.entries.map(entry=>({
      entry,side:matchWithdrawalToFixture(entry,m,plan.team_name)
    })).filter(item=>item.side);
    if(matched.length!==1)continue; // never write ambiguous withdrawal claims
    if(manualMap.has(m.id)&&manualMap.get(m.id).result_status==='played'){
      ignored++;continue; // conflicting TSV score needs manual review
    }
    const {entry,side}=matched[0];
    const existing=previousFlags.get(m.id);
    if(existing && existing.affected_side!==side){
      ignored++;
      console.log('BTV_WITHDRAWAL_SIDE_CONFLICT='+JSON.stringify({
        match_id:m.id,old:existing.affected_side,official:side
      }));
      continue; // no silent contradiction of existing TSV report
    }
    candidates++;
    if(!apply)continue;
    const record={
      match_id:m.id,affected_side:side,source_kind:'btv_group_schedule',
      verification_status:'official_verified',
      evidence_url:source.url,
      evidence_summary:entry.displayName+' ('+entry.clubCode+') vom BTV am '+entry.withdrawnOn+' als zurückgezogen/gesperrt gekennzeichnet.',
      official_withdrawal_date:entry.withdrawnOn,
      updated_at:new Date().toISOString()
    };
    const {error}=await db.from('match_withdrawal_flags').upsert(record,{onConflict:'match_id'});
    if(error)throw Error('BTV_WITHDRAWAL_WRITE_FAILED: '+error.message);
    stored++;
  }
  // No rapid-fire scraping; no retry when sources are unavailable.
  await new Promise(resolve=>setTimeout(resolve,1250));
}
console.log('BTV_WITHDRAWAL_RESULT='+JSON.stringify({
  checked,withdrawals,candidates,stored,ignored,blocked,clubReports:clubReports.size,mode:apply?'apply':'dry-run'
}));
