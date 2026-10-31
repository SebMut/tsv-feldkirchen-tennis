import {readBtvStandings,readBtvClubStandings} from './btv-standings-source.mjs';
import {groupIdFromBtvUrl} from './btv-withdrawal-source.mjs';

const apply=process.argv.includes('--apply');
if(apply&&process.env.BTV_STANDINGS_WRITE_ENABLED!=='true')throw Error('STANDINGS_WRITE_FLAG_REQUIRED');
const key=process.env.BTV_SUPABASE_SECRET_KEY;
if(!key)throw Error('STANDINGS_SUPABASE_KEY_REQUIRED');
const {createClient}=await import('@supabase/supabase-js');
const db=createClient('https://eaurnufdochjapfzqwvm.supabase.co',key,{auth:{persistSession:false,autoRefreshToken:false}});
const query=async(request,label)=>{const {data,error}=await request;if(error||!Array.isArray(data))throw Error(label+'_FAILED');return data;};
const seasons=await query(db.from('seasons').select('id,code').in('code',['sommer-2026','winter-2026-2027']),'SEASONS');
if(seasons.length!==2)throw Error('STANDINGS_SEASONS_INCOMPLETE');
const seasonById=new Map(seasons.map(s=>[s.id,s.code]));
const teamSeasons=await query(db.from('team_seasons').select('id,season_id,group_name,btv_url').in('season_id',seasons.map(s=>s.id)).eq('is_published',true).limit(50),'TEAM_SEASONS');
if(teamSeasons.length!==23)throw Error('STANDINGS_TEAM_SEASON_COUNT_CHANGED');
let groups=0,rowsRead=0,rowsWritten=0;
const failures=[];
let summerClubReport=null;
try{summerClubReport=await readBtvClubStandings('sommer-2026');}
catch(error){failures.push({season:'sommer-2026',group:'club-report',error:String(error?.message||error).slice(0,100)});}
for(const teamSeason of teamSeasons){
  const groupId=groupIdFromBtvUrl(teamSeason.btv_url);
  if(!groupId)throw Error('STANDINGS_UNVERIFIED_GROUP_LINK');
  const seasonCode=seasonById.get(teamSeason.season_id);
  let snapshot;
  const groupNumber=Number(String(teamSeason.group_name).match(/Gr\.\s*(\d{1,4})/)?.[1]);
  const clubRows=seasonCode==='sommer-2026'&&summerClubReport?.groups.get(groupNumber);
  if(clubRows) snapshot={rows:clubRows,sourceUrl:summerClubReport.sourceUrl,sourceHash:summerClubReport.sourceHash};
  try{
    snapshot??=await readBtvStandings(groupId,{seasonCode,groupName:teamSeason.group_name});
  }catch(error){
    failures.push({season:seasonCode,group:groupId,error:String(error?.message||error).slice(0,100)});
    continue; // One unavailable BTV group must never block every other table.
  }
  groups++;rowsRead+=snapshot.rows.length;
  if(!apply)continue;
  const syncedAt=new Date().toISOString();
  const payload=snapshot.rows.map(row=>({
    team_season_id:teamSeason.id,rank:row.rank,team_name:row.teamName,
    club_code:row.clubCode,standing_text:row.standingText,
    source_url:snapshot.sourceUrl,source_hash:snapshot.sourceHash,synced_at:syncedAt
  }));
  const {error}=await db.from('team_standings').upsert(payload,{onConflict:'team_season_id,rank'});
  if(error)throw Error('STANDINGS_UPSERT_FAILED');
  const {error:deleteError}=await db.from('team_standings').delete().eq('team_season_id',teamSeason.id).gt('rank',snapshot.rows.length);
  if(deleteError)throw Error('STANDINGS_STALE_DELETE_FAILED');
  rowsWritten+=payload.length;
}
if(groups===0)throw Error('STANDINGS_ALL_GROUPS_FAILED');
console.log('BTV_STANDINGS_SYNC='+JSON.stringify({groups,rowsRead,rowsWritten,failures,mode:apply?'apply':'dry-run'}));
