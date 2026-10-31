// BTV public schedules -> Supabase public.matches. Fail closed and never edit
// manually managed or live match data. Run dry by default, --apply is explicit.
import { getClubSchedule, normalizedName } from './btv-schedule.mjs';

const apply=process.argv.includes('--apply');
const year=Number(process.env.BTV_SEASON_YEAR||2026);
if (!Number.isInteger(year) || year<2025 || year>2100) throw new Error('Invalid season year');
if(apply && process.env.BTV_IMPORT_ENABLED!=='true') throw new Error('BTV_IMPORT_ENABLED must be true to write');
const schedule=await getClubSchedule(year);
const counts=new Map();
for(const entry of schedule.fixtures) counts.set(entry.slug,(counts.get(entry.slug)||0)+1);
console.log(`Official BTV club 01012, season ${year}: ${schedule.fixtures.length} games / ${counts.size} teams / ${schedule.pages} PDF pages`);
console.log('Teams:',[...counts].sort((a,b)=>a[0].localeCompare(b[0])).map(([slug,n])=>slug+':'+n).join(', '));
if(counts.size!==20 && year===2026) throw new Error('Unexpected count of teams; no database update');
if(!apply) { console.log('DRY RUN ONLY. Database was not connected or changed.'); process.exit(0); }

const supabaseUrl='https://eaurnufdochjapfzqwvm.supabase.co';
const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('Server-side Supabase secret unavailable; refusing write');
const { createClient }=await import('@supabase/supabase-js');
const db=createClient(supabaseUrl,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{'X-Client-Info':'tsv-btv-import-1.0'}}});
async function get(query,purpose) {
  const {data,error}=await query;
  if(error) throw new Error(purpose+': '+error.message);
  return data||[];
}
let runId=null;
const summary={source_fixture_count:schedule.fixtures.length,existing_count:0,inserted_count:0,updated_count:0,skipped_count:0};
try {
  const [seasonRows,teamRows,seasonTeams]=await Promise.all([
    get(db.from('seasons').select('id,year').eq('year',year),'seasons'),
    get(db.from('teams').select('id,slug'),'teams'),
    get(db.from('team_seasons').select('id,team_id,season_id,btv_url'),'team_seasons')
  ]);
  if(seasonRows.length!==1) throw new Error('Cannot unambiguously find Supabase season '+year);
  const slugToTeam=new Map(teamRows.map(row=>[row.slug,row]));
  const seasonByTeam=new Map(seasonTeams.filter(x=>x.season_id===seasonRows[0].id).map(row=>[row.team_id,row]));
  const missing=[...counts.keys()].filter(slug=>!slugToTeam.has(slug)||!seasonByTeam.has(slugToTeam.get(slug).id));
  if(missing.length) throw new Error('Missing team season mapping: '+missing.join(', '));

  const rows=await get(db.from('matches').select('id,team_season_id,opponent,is_home,starts_at,btv_imported,btv_source_key,btv_result_text').in('team_season_id',[...seasonByTeam.values()].map(x=>x.id)),'existing games');
  const byKey=new Map(rows.filter(row=>row.btv_source_key).map(row=>[row.btv_source_key,row]));
  const byIdentity=new Map();
  const identity=(seasonId,isHome,opponent)=>[seasonId,isHome?'H':'A',normalizedName(opponent)].join('|');
  for(const row of rows) {
    const key=identity(row.team_season_id,row.is_home,row.opponent);
    const list=byIdentity.get(key)||[];
    list.push(row);
    byIdentity.set(key,list);
  }
  // Existing live states and encounter editors take absolute precedence.
  const knownIds=rows.filter(row=>row.btv_imported).map(row=>row.id);
  const protectedIds=new Set();
  if(knownIds.length) {
    const [states,encounters]=await Promise.all([
      get(db.from('match_live_state').select('match_id,status').in('match_id',knownIds),'live state'),
      get(db.from('match_encounters').select('match_id').in('match_id',knownIds),'encounters')
    ]);
    for(const row of states) if(row.status!=='scheduled') protectedIds.add(row.match_id);
    for(const row of encounters) protectedIds.add(row.match_id);
  }
  const candidates=[],updates=[],safeguarded=[];
  for(const item of schedule.fixtures) {
    const team=slugToTeam.get(item.slug);
    const ts=seasonByTeam.get(team.id);
    const existing=byKey.get(item.sourceKey);
    if(existing) {
      if(!existing.btv_imported || protectedIds.has(existing.id)) {
        summary.skipped_count++;
        safeguarded.push(item.slug+' / '+item.opponent+' (manual/live)');
        continue;
      }
      const patch={
        starts_at:item.startsAt,opponent:item.opponent,
        btv_result_text:item.score,btv_last_synced_at:new Date().toISOString(),
      };
      // Only update machine-owned fixtures; never touch statuses, scores,
      // encounters or live ticker. Existing records remain published.
      updates.push({id:existing.id,patch});
      continue;
    }
    const siblings=byIdentity.get(identity(ts.id,item.isHome,item.opponent))||[];
    if(siblings.length) { summary.existing_count++; continue; } // same fixture already maintained by club
    // Conservative second guard for changed spelling: one match on that day
    // and side for the same TSV team is considered manually managed.
    if(rows.some(row=>row.team_season_id===ts.id && row.is_home===item.isHome
      && new Date(row.starts_at).toISOString().slice(0,10)===item.date)) {
      summary.skipped_count++;
      safeguarded.push(item.slug+' / '+item.opponent+' (same-day manual fixture)');
      continue;
    }
    const lineupFormat=item.four?'4_2':'6_3';
    candidates.push({
      team_season_id:ts.id,opponent:item.opponent,is_home:item.isHome,
      starts_at:item.startsAt,ends_at:null,match_type:'league',lineup_format:lineupFormat,
      is_published:true,external_url:ts.btv_url||null,
      btv_source_key:item.sourceKey,btv_imported:true,
      btv_result_text:item.score,btv_last_synced_at:new Date().toISOString(),
    });
    // Don't insert the same opponent+side twice unless the source explicitly
    // shows repeated fixtures (the sourceKey remains unique).
    const list=byIdentity.get(identity(ts.id,item.isHome,item.opponent))||[];
    list.push({id:'planned',opponent:item.opponent});
    byIdentity.set(identity(ts.id,item.isHome,item.opponent),list);
  }
  if(candidates.length>30) throw new Error('Unusually many new games ('+candidates.length+'); requires review before sync');
  console.log('Guarded comparison:',JSON.stringify({existing:summary.existing_count,new:candidates.length,updates:updates.length,protected:summary.skipped_count}));
  console.log('New fixtures:',JSON.stringify(candidates.map(c=>({team_season_id:c.team_season_id,opponent:c.opponent,start:c.starts_at,home:c.is_home})).slice(0,8)));
  const log=await db.from('btv_import_runs').insert({season_year:year,source_url:schedule.sourceUrl,...summary}).select('id').single();
  if(log.error) throw new Error('Cannot log import run: '+log.error.message);
  runId=log.data.id;
  for(const item of updates) {
    const result=await db.from('matches').update(item.patch).eq('id',item.id).eq('btv_imported',true).select('id').maybeSingle();
    if(result.error) throw new Error('BTV existing record update: '+result.error.message);
    if(result.data) summary.updated_count++;
  }
  // Inserts are idempotent via the unique btv_source_key. No cleanup, no delete.
  for(const item of candidates) {
    const result=await db.from('matches').insert(item).select('id').single();
    if(result.error?.code==='23505') { summary.existing_count++; continue; } // concurrent import already created it
    if(result.error) throw new Error('BTV candidate insert: '+result.error.message);
    if(result.data) summary.inserted_count++;
  }
  const final=await db.from('btv_import_runs').update({...summary,status:'success',completed_at:new Date().toISOString()}).eq('id',runId);
  if(final.error) throw new Error('Cannot finalize import report: '+final.error.message);
  console.log('BTV IMPORT OK:',JSON.stringify(summary));
} catch(error) {
  console.error('BTV IMPORT STOPPED:',String(error.message||error));
  if(runId) {
    await db.from('btv_import_runs').update({
      ...summary,status:'failed',completed_at:new Date().toISOString(),
      error_message:String(error.message||error).slice(0,500),
    }).eq('id',runId);
  }
  process.exitCode=1;
}
