// Authorized BTV cockpit discovery for official MeetingReportFOP links.
// Player names, report contents, credentials, cookies and HTML are never logged or persisted.
import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {meetingIdsFromLinks,matchOfficialReport} from './btv-meeting-discovery-core.mjs';

const PROJECT_URL='https://eaurnufdochjapfzqwvm.supabase.co';
const CLUB_COCKPIT='https://www.btv.de/de/mein-verein/vereins-cockpit.html';
const AUTH_HOST='tende-id.liga.nu';
const ALLOWED_HOSTS=new Set(['www.btv.de','btv.de','btv.liga.nu',AUTH_HOST]);
const apply=process.argv.includes('--apply');
if(apply&&(process.env.GITHUB_REF!=='refs/heads/main'||process.env.BTV_MEETING_DISCOVERY_WRITE_ENABLED!=='true'))
  throw Error('WRITE_RESTRICTED_TO_APPROVED_MAIN_WORKFLOW');
const username=process.env.BTV_LOGIN_USERNAME,password=process.env.BTV_LOGIN_PASSWORD;
const key=process.env.BTV_SUPABASE_SECRET_KEY;
if(!username||!password||!key)throw Error('BTV_DISCOVERY_SECRETS_REQUIRED');
const {chromium}=await import('playwright');
const db=createClient(PROJECT_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const query=async(p,label)=>{const {data,error}=await p;if(error)throw Error(label+'_DB_ERROR');return data||[];};
const [season]=await query(db.from('seasons').select('id,code').eq('code','sommer-2026').limit(1),'SEASON');
if(!season)throw Error('SUMMER_2026_MISSING');
const matches=await query(db.from('matches').select('id,team_season_id,opponent,is_home,starts_at,btv_result_text')
  .in('team_season_id',(await query(db.from('team_seasons').select('id').eq('season_id',season.id).limit(100),'TEAM_SEASONS')).map(x=>x.id)).limit(300),'MATCHES');
const teamSeasons=await query(db.from('team_seasons').select('id,btv_url').eq('season_id',season.id).limit(100),'TEAM_REFS');
const groupByTeam=new Map(teamSeasons.map(x=>[x.id,String(x.btv_url||'').match(/groupid=(\d{7,8})/)?.[1]||null]));
const existing=await query(db.from('official_meeting_reports').select('source_meeting_id,match_id,verification_status').eq('season_id',season.id).limit(300),'EXISTING');
const existingMeetings=new Set(existing.map(x=>Number(x.source_meeting_id)));
const existingMatches=new Set(existing.map(x=>x.match_id).filter(Boolean));

function reportMeta(text){
  const lines=text.split(/\r?\n/).slice(0,30);
  const title=lines.find(x=>/\(01012\)/.test(x)&&x.includes(' : '))||'';
  const score=title.match(/\b(\d{1,2}\s*:\s*\d{1,2})\s*$/)?.[1]||'';
  const de=text.slice(0,2500).match(/\b(\d{2})\.(\d{2})\.(2026)\b/);
  return {title,score,date:de?`${de[3]}-${de[2]}-${de[1]}`:null};
}

let browser;const folder=mkdtempSync(join(tmpdir(),'btv-meeting-discovery-'));
let discovered=0,inserted=0,ambiguous=0,unavailable=0;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({acceptDownloads:false,serviceWorkers:'block',locale:'de-DE'});
 const page=await context.newPage();page.setDefaultTimeout(12000);
 await page.route('**/*',route=>{try{const u=new URL(route.request().url());if(u.protocol==='https:'&&ALLOWED_HOSTS.has(u.hostname))return route.continue();}catch{}return route.abort();});
 await page.goto(CLUB_COCKPIT,{waitUntil:'domcontentloaded',timeout:30000});
 if(new URL(page.url()).hostname!==AUTH_HOST)throw Error('LOGIN_PROVIDER_NOT_CONFIRMED');
 const pw=page.locator('input[type="password"]').first();await pw.waitFor({state:'visible',timeout:15000});
 const form=pw.locator('xpath=ancestor::form[1]');
 let user=form.locator('input[type="email"], input[autocomplete="username"], input[name*="username" i], input[type="text"]').first();
 if(await user.count()!==1)throw Error('USERNAME_FIELD_NOT_FOUND');
 await user.fill(username);await pw.fill(password);
 const submit=form.locator('button[type="submit"], input[type="submit"]').first();
 if(await submit.count()!==1)throw Error('SUBMIT_NOT_FOUND');
 await submit.click();await page.waitForURL(u=>u.hostname!==AUTH_HOST,{timeout:25000}).catch(()=>{});
 if(new URL(page.url()).hostname===AUTH_HOST)throw Error('LOGIN_NOT_CONFIRMED');
 await page.goto(CLUB_COCKPIT,{waitUntil:'domcontentloaded',timeout:30000});
 const start=page.getByRole('button',{name:/^start$/i}).first();if(await start.count()===1&&await start.isVisible())await start.click();
 for(const name of [/Ergebniserfassung/i,/Spielberichte suchen/i,/Spielberichte/i]){
   const target=page.getByRole('link',{name}).or(page.getByRole('button',{name})).first();
   if(await target.count()===1&&await target.isVisible()){await target.click();await page.waitForLoadState('domcontentloaded').catch(()=>{});}
 }
 // Expand the season window when matching date inputs are available. No form changes are saved.
 for(const frame of page.frames()){
   const inputs=frame.locator('input');
   for(let i=0;i<await inputs.count();i++){
     const input=inputs.nth(i);const hint=((await input.getAttribute('name'))||'')+' '+((await input.getAttribute('placeholder'))||'');
     if(/von|start|beginn/i.test(hint))await input.fill((await input.getAttribute('type'))==='date'?'2026-04-01':'01.04.2026').catch(()=>{});
     if(/bis|end/i.test(hint))await input.fill((await input.getAttribute('type'))==='date'?'2026-10-31':'31.10.2026').catch(()=>{});
   }
 }
 const search=page.getByRole('button',{name:/suchen|anzeigen|filtern/i}).first();
 if(await search.count()===1&&await search.isVisible()){await search.click();await page.waitForLoadState('domcontentloaded').catch(()=>{});}
 const links=[];
 for(const frame of page.frames())links.push(...await frame.locator('a').evaluateAll(as=>as.map(a=>a.href).filter(Boolean)).catch(()=>[]));
 const reports=meetingIdsFromLinks(links);discovered=reports.length;
 for(const report of reports){
   if(existingMeetings.has(report.meetingId))continue;
   try{
     const response=await context.request.get(report.reportUrl,{timeout:22000});
     if(!response.ok())throw Error('REPORT_HTTP_'+response.status());
     const bytes=Buffer.from(await response.body());
     if(bytes.length<1000||bytes.length>10_000_000||bytes.subarray(0,4).toString('ascii')!=='%PDF')throw Error('REPORT_PDF_INVALID');
     const file=join(folder,String(report.meetingId)+'.pdf');writeFileSync(file,bytes);
     const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:14000,maxBuffer:2_000_000});
     const meta=reportMeta(text);const match=matchOfficialReport(meta,matches.filter(x=>!existingMatches.has(x.id)));
     if(!match){ambiguous++;continue;}
     const points=meta.score.replace(/\s+/g,'').split(':').map(Number);
     const groupId=groupByTeam.get(match.team_season_id);
     if(!groupId||points.length!==2||points.some(x=>!Number.isInteger(x))){ambiguous++;continue;}
     if(apply){
       const {error}=await db.from('official_meeting_reports').insert({federation:'BTV',season_id:season.id,match_id:match.id,
         source_meeting_id:report.meetingId,source_group_id:groupId,report_url:report.reportUrl,
         home_match_points:points[0],away_match_points:points[1],official_status:'played',verification_status:'pending'});
       if(error)throw Error('CANDIDATE_INSERT_FAILED');inserted++;
     }
   }catch{unavailable++;}
 }
 await context.close();
}finally{rmSync(folder,{recursive:true,force:true});await browser?.close().catch(()=>{});}
console.log('BTV_MEETING_DISCOVERY='+JSON.stringify({season:'sommer-2026',discovered,known:existingMeetings.size,inserted,ambiguous,unavailable,mode:apply?'apply':'dry-run'}));
console.log('BTV_MEETING_DISCOVERY_PERSONAL_DATA_LOGGED=NO');

