// Read-only check of publicly linked BTV "MeetingReportFOP" documents.
// This script reports structure-only counters. Never print names or raw PDF text.
// Sample meeting IDs were confirmed in the authorized TSV Ergebniserfassung list.
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
const reportIds=[12696831,12742553,12702107,12695005];
const urlFor=id=> {
  if(!reportIds.includes(id))throw Error('UNVERIFIED_MEETING_ID');
  const u=new URL('https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument');
  u.searchParams.set('dokument','MeetingReportFOP');
  u.searchParams.set('meeting',String(id));
  return u.toString();
};
const folder=mkdtempSync(join(tmpdir(),'btv-meeting-report-'));
async function pdfBytes(id){
  let url=urlFor(id);
  for(let redirect=0;redirect<3;redirect++){
    const u=new URL(url);
    if(u.origin!=='https://btv.liga.nu')throw Error('REPORT_ORIGIN_NOT_ALLOWED');
    const response=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(20000)});
    if(response.status>=300&&response.status<400){
      const where=response.headers.get('location');
      if(!where)throw Error('REPORT_REDIRECT_EMPTY');
      url=new URL(where,url).toString();continue;
    }
    if(!response.ok)throw Error('REPORT_HTTP_'+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length<1000||bytes.length>6_000_000||bytes.subarray(0,4).toString('ascii')!=='%PDF')
      throw Error('REPORT_NOT_PDF');
    return bytes;
  }
  throw Error('REPORT_REDIRECT_LIMIT');
}
try{
 for(const [index,id] of reportIds.entries()){
  const file=join(folder,'report-'+index+'.pdf');
  try{
   writeFileSync(file,await pdfBytes(id));
   const info=execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:9000});
   const pages=Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
   if(!pages||pages>12)throw Error('REPORT_PAGE_COUNT_UNEXPECTED');
   const content=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:13000,maxBuffer:3*1024*1024});
   if(!/TSV\s+Feldkirchen/i.test(content))throw Error('REPORT_CLUB_UNCONFIRMED');
   const matches=content.match(/\bEinzel\b/gi)||[];
   const doubles=content.match(/\bDoppel\b/gi)||[];
   const validLines=content.split(/\r?\n/u).filter(x=>x.trim().length>0);
   console.log('BTV_REPORT_'+index+'_DOWNLOAD=SUCCESS');
   console.log('BTV_REPORT_'+index+'_PAGES='+pages);
   console.log('BTV_REPORT_'+index+'_LINE_COUNT='+validLines.length);
   if(index===0 || index===2) {
     // Format probes only: remove EVERY letter and digit, including player names,
     // birth years, player IDs and individual set scores.
     const nonempty=content.split(/\r?\n/u).filter(x=>x.trim());
     for (const [lineNo,line] of nonempty.slice(0,32).entries()) {
       const masked=line.slice(0,150).replace(/\p{L}/gu,'X').replace(/[0-9]/g,'9')
         .replace(/[^X9\s,.:;()\[\]\/\-|]/g,'?').replace(/\s+/g,' ').trim();
       console.log('BTV_REPORT_LAYOUT_'+index+'_'+lineNo+'='+masked);
     }
   }
   console.log('BTV_REPORT_'+index+'_HAS_EINZEL='+(matches.length?'YES':'NO'));
   console.log('BTV_REPORT_'+index+'_HAS_DOPPEL='+(doubles.length?'YES':'NO'));
   console.log('BTV_REPORT_'+index+'_HAS_SET_RESULTS='+(/\bSatz\b/i.test(content)?'YES':'NO'));
  }catch(err){
   const allowed=new Set(['REPORT_NOT_PDF','REPORT_CLUB_UNCONFIRMED','REPORT_PAGE_COUNT_UNEXPECTED',
     'REPORT_REDIRECT_EMPTY','REPORT_REDIRECT_LIMIT','REPORT_ORIGIN_NOT_ALLOWED']);
   const reason=String(err?.message||'').match(/^REPORT_HTTP_\d{3}$/)?.[0]||
      (allowed.has(err?.message)?err.message:'REPORT_FETCH_OR_PARSE_FAILED');
   console.log('BTV_REPORT_'+index+'_DOWNLOAD='+reason);
   process.exitCode=1;
  }
 }
}finally{rmSync(folder,{force:true,recursive:true});}
console.log('BTV_REPORT_RAW_TRANSFER=NONE');
