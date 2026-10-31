// Import only individually verified official BTV MeetingReportFOP Einzel/Doppel
// to RLS-protected tables for TSV Feldkirchen Sommer 2026.
// No player names, source text or personal IDs in workflow logs or artifacts.
// Failure is per report; an unreachable PDF must not stop others.
import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseOfficialMeetingText} from './btv-meeting-rubbers-parser.mjs';

const PROJECT_URL='https://eaurnufdochjapfzqwvm.supabase.co';
const apply=process.argv.includes('--apply');
if(apply&&(process.env.GITHUB_REF!=='refs/heads/main'||
  process.env.BTV_MEETING_RUBBERS_WRITE_ENABLED!=='true'))
  throw Error('WRITE_RESTRICTED_TO_APPROVED_MAIN_WORKFLOW');
const key=process.env.BTV_SUPABASE_SECRET_KEY;
if(!key)throw Error('BTV_SUPABASE_SECRET_KEY_REQUIRED');
const db=createClient(PROJECT_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const query=async(p,label)=>{
 const {data,error}=await p;
 if(error)throw Error(label+'_DB_ERROR');
 return data||[];
};
const [season]=await query(db.from('seasons').select('id,code').eq('code','sommer-2026').limit(1),'SEASON');
if(!season)throw Error('SUMMER_2026_MISSING');
const reports=await query(db.from('official_meeting_reports')
 .select('id,match_id,source_meeting_id,report_url,home_match_points,away_match_points,verification_status,source_sha256')
 .eq('season_id',season.id).order('source_meeting_id').limit(200),'REPORTS');
const matches=await query(db.from('matches').select('id,opponent,is_home,starts_at,btv_result_text')
 .in('id',reports.map(r=>r.match_id).filter(Boolean)).limit(200),'MATCHES');
const byId=new Map(matches.map(m=>[m.id,m]));
const folder=mkdtempSync(join(tmpdir(),'tsv-official-rubbers-'));
let verified=0,stored=0,skipped=0,unavailable=0,conflicts=0;
try{
 for(const report of reports) {
  const m=byId.get(report.match_id);
  const id=report.source_meeting_id;
  try {
   if(!m||!id||!Number.isSafeInteger(id))throw Error('MATCH_LINK_UNVERIFIED');
   const doc=new URL(report.report_url);
   if(doc.origin!=='https://btv.liga.nu'||
      doc.pathname!=='/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument'||
      doc.searchParams.get('dokument')!=='MeetingReportFOP'||
      doc.searchParams.get('meeting')!==String(id))
     throw Error('UNVERIFIED_OFFICIAL_REPORT_URL');
   const score=String(m.btv_result_text||'').replace(/\s+/g,'');
   if(score!==report.home_match_points+':'+report.away_match_points)
     throw Error('MATCH_SCORE_CONFLICT');
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),22000);
   let response;
   try{response=await fetch(doc.toString(),{signal:ctrl.signal,headers:{Accept:'application/pdf',
     'User-Agent':'TSV-Feldkirchen-Tennis-2026-SourcedRubbersImporter/1.0'}});}
   finally{clearTimeout(timer)}
   if(response.status===403||response.status===429){
     console.log('BTV_OFFICIAL_RUBBERS_ACCESS_BLOCKED='+response.status);
     break;
   }
   if(!response.ok)throw Error('REPORT_HTTP_'+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length<1000||bytes.length>10000000||bytes.toString('ascii',0,4)!=='%PDF')
     throw Error('REPORT_PDF_INVALID');
   const sha=createHash('sha256').update(bytes).digest('hex');
   if(report.verification_status==='verified' && report.source_sha256 &&
      report.source_sha256!==sha)throw Error('OFFICIAL_REPORT_CHANGED_REVIEW_REQUIRED');
   const file=join(folder,id+'.pdf');writeFileSync(file,bytes);
   const info=execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:10000});
   const pages=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
   if(!pages||pages>12)throw Error('REPORT_PAGES_INVALID');
   const text=execFileSync('pdftotext',['-layout',file,'-'],{
     encoding:'utf8',timeout:14000,maxBuffer:2000000
   });
   const title=text.split(/\r?\n/).slice(0,8).find(x=>/\(01012\)/.test(x) && x.includes(' : '));
   if(!title||!/\b2026\b/.test(text.slice(0,180))||
      !title.includes(m.opponent)||!/\bTSV Feldkirchen(?:\s+(?:II|III))?\s+\(01012\)/.test(title))
     throw Error('WRONG_TEAM_SEASON_OR_OPPONENT');
   const clubs=title.match(/^\s*(.+?\(\d{5}\))\s*:\s*(.+?\(\d{5}\))\s+\d{1,2}\s*:\s*\d{1,2}\s*$/);
   if(!clubs||
      (m.is_home&&!clubs[1].includes('(01012)'))||
      (!m.is_home&&!clubs[2].includes('(01012)')))
     throw Error('HOME_AWAY_IDENTITY_CONFLICT');
   const parsed=parseOfficialMeetingText(text,{
     expectedHomePoints:report.home_match_points,
     expectedAwayPoints:report.away_match_points
   });
   if(parsed.verification_status!=='verified'||parsed.errors.length)
     throw Error('RUBBER_REPORT_INCOMPLETE');
   const all=[...parsed.singles,...parsed.doubles];
   verified++;
   if(!apply){
     console.log('BTV_RUBBER_DRY_RUN='+JSON.stringify({meeting:id,singles:parsed.singles.length,
       doubles:parsed.doubles.length,status:'verified'}));
     continue;
   }
   const entries=all.map(row=>({...row,report_id:report.id}));
   // Upsert only source-backed rows. The report is marked verified LAST.
   const {error:rubberError}=await db.from('official_report_rubbers')
      .upsert(entries,{onConflict:'report_id,discipline,position'});
   if(rubberError)throw Error('RUBBER_INSERT_FAILED');
   const {data:storedRows,error:countError}=await db.from('official_report_rubbers')
     .select('id,discipline,position').eq('report_id',report.id).limit(30);
   if(countError||storedRows.length!==all.length)throw Error('RUBBER_COUNT_AFTER_WRITE_MISMATCH');
   const {error:headerError}=await db.from('official_meeting_reports')
     .update({source_sha256:sha,parser_version:'btv-meeting-rubbers-2026-v1',
       home_team:clubs[1].replace(/\s*\(\d{5}\)$/,'').trim(),
       away_team:clubs[2].replace(/\s*\(\d{5}\)$/,'').trim(),
       verification_status:'verified',verified_at:new Date().toISOString()})
     .eq('id',report.id);
   if(headerError)throw Error('REPORT_VERIFICATION_UPDATE_FAILED');
   stored+=all.length;
   console.log('BTV_RUBBER_IMPORTED='+JSON.stringify({meeting:id,singles:parsed.singles.length,
     doubles:parsed.doubles.length,status:'verified'}));
  }catch(err){
   const reason=String(err?.message||err);
   const safe=/^(?:REPORT_HTTP_\d{3}|MATCH_LINK_UNVERIFIED|UNVERIFIED_OFFICIAL_REPORT_URL|MATCH_SCORE_CONFLICT|REPORT_PDF_INVALID|OFFICIAL_REPORT_CHANGED_REVIEW_REQUIRED|REPORT_PAGES_INVALID|WRONG_TEAM_SEASON_OR_OPPONENT|HOME_AWAY_IDENTITY_CONFLICT|RUBBER_REPORT_INCOMPLETE|RUBBER_INSERT_FAILED|RUBBER_COUNT_AFTER_WRITE_MISMATCH|REPORT_VERIFICATION_UPDATE_FAILED)$/.test(reason)
     ?reason:'SOURCE_OR_PARSE_UNAVAILABLE';
   console.log('BTV_RUBBER_PENDING='+JSON.stringify({meeting:id||null,reason:safe}));
   if(safe.includes('CONFLICT')||safe.includes('CHANGED'))conflicts++;
   else if(safe.startsWith('REPORT_HTTP_')||safe==='SOURCE_OR_PARSE_UNAVAILABLE')unavailable++;
   else skipped++;
  }
  await new Promise(resolve=>setTimeout(resolve,600));
 }
}finally{rmSync(folder,{force:true,recursive:true})}
console.log('BTV_RUBBER_AUDIT='+JSON.stringify({season:'sommer-2026',sourceMeetings:reports.length,
 verified,stored,skipped,unavailable,conflicts,mode:apply?'apply':'dry-run'}));
console.log('BTV_RUBBER_PERSONAL_DATA_LOGGED=NO');
