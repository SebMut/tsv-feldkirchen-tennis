// Readiness gate for the weekly summer roster import (no BTV login, no writes).
// Scheduled runs import the current summer season (sommer-<year>) from 2027
// on, but only once that season has TSV teams in the database. Until then the
// weekly run ends quietly, so nobody has to remember to start it.
import {appendFileSync} from 'node:fs';
import {isLaterSummerSeason} from './btv-roster-age-classes.mjs';

const PROJECT='https://eaurnufdochjapfzqwvm.supabase.co';
export const FIRST_SCHEDULED_YEAR=2027;

export const berlinYear=now=>Number(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric'}).format(new Date(now)));

// Which season a run should import, or null if a scheduled run has nothing to do yet.
export function seasonForRun({eventName,requestedSeason,now=Date.now()}){
  if(eventName==='schedule'){
    const year=berlinYear(now);
    return year>=FIRST_SCHEDULED_YEAR?`sommer-${year}`:null;
  }
  return requestedSeason||null;
}

const output=(name,value)=>{
  console.log(`BTV_ROSTER_${name.toUpperCase()}=${value}`);
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`${name}=${value}\n`);
};

const main=async()=>{
  const season=seasonForRun({eventName:process.env.GITHUB_EVENT_NAME,requestedSeason:process.env.BTV_ROSTER_SEASON_INPUT});
  if(!season){output('ready','false');output('season','none');console.log('Scheduled roster import starts with sommer-'+FIRST_SCHEDULED_YEAR+'.');return;}
  if(season!=='sommer-2026'&&!isLaterSummerSeason(season))throw Error('ROSTER_SEASON_NOT_SUPPORTED');
  output('season',season);
  const key=process.env.BTV_SUPABASE_SECRET_KEY;
  if(!key)throw Error('ROSTER_SUPABASE_KEY_REQUIRED');
  const {createClient}=await import('@supabase/supabase-js');
  const db=createClient(PROJECT,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:seasons,error}=await db.from('seasons').select('id').eq('code',season);
  if(error||!Array.isArray(seasons))throw Error('SEASON_LOOKUP_FAILED');
  if(seasons.length!==1){output('team_seasons','0');output('ready','false');console.log('Season not in database yet.');return;}
  const {data:teams,error:teamError}=await db.from('team_seasons').select('id').eq('season_id',seasons[0].id).limit(100);
  if(teamError||!Array.isArray(teams))throw Error('TEAM_SEASONS_LOOKUP_FAILED');
  output('team_seasons',String(teams.length));
  output('ready',teams.length>0?'true':'false');
  if(!teams.length)console.log('No TSV teams registered for this season yet: nothing to import.');
};

if(import.meta.url===`file://${process.argv[1]}`){
  try{await main();}
  catch(error){
    const code=/^[A-Z0-9_]{3,60}$/.test(error?.message||'')?error.message:'UNSPECIFIED';
    console.error('BTV_ROSTER_READY_ERROR='+code);
    process.exitCode=1;
  }
}
