// Matchday window gate for scheduled BTV result syncs.
// Scheduled syncs only need to run on the two days AFTER a TSV match day
// (Europe/Berlin calendar days). Manual runs and pushes always run.
// Fail-open: if the database cannot be read, the sync runs anyway.
import {appendFileSync} from 'node:fs';

const PROJECT='https://eaurnufdochjapfzqwvm.supabase.co';
const ZONE='Europe/Berlin';
const DAY=24*60*60*1000;

export const berlinDate=value=>new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));

// The two Berlin calendar days before "now" (yesterday and the day before).
export const followUpDays=now=>{
  const today=berlinDate(now);
  const days=new Set();
  for(let hours=1;days.size<2&&hours<=96;hours++){
    const day=berlinDate(new Date(now).getTime()-hours*60*60*1000);
    if(day!==today)days.add(day);
  }
  return [...days];
};

export const isMatchdayFollowUp=(matchStarts,now=Date.now())=>{
  const window=new Set(followUpDays(now));
  return matchStarts.some(start=>start&&window.has(berlinDate(start)));
};

const setOutput=active=>{
  console.log('BTV_MATCHDAY_WINDOW_ACTIVE='+active);
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`active=${active}\n`);
};

const main=async()=>{
  if(process.env.GITHUB_EVENT_NAME!=='schedule'){
    console.log('Not a scheduled run: sync always runs.');
    return setOutput(true);
  }
  const key=process.env.BTV_SUPABASE_SECRET_KEY;
  if(!key){console.log('MATCHDAY_WINDOW_KEY_MISSING: fail-open');return setOutput(true);}
  try{
    const {createClient}=await import('@supabase/supabase-js');
    const db=createClient(PROJECT,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const now=Date.now();
    const {data,error}=await db.from('matches').select('starts_at')
      .gte('starts_at',new Date(now-4*DAY).toISOString())
      .lt('starts_at',new Date(now).toISOString())
      .limit(200);
    if(error||!Array.isArray(data))throw Error('MATCHES_QUERY_FAILED');
    const active=isMatchdayFollowUp(data.map(row=>row.starts_at),now);
    console.log('Follow-up days (Berlin): '+followUpDays(now).join(', ')+' · matches in last 4 days: '+data.length);
    setOutput(active);
  }catch(error){
    console.log('MATCHDAY_WINDOW_CHECK_FAILED: '+error.message+' · fail-open');
    setOutput(true);
  }
};

if(import.meta.url===`file://${process.argv[1]}`)await main();
