// Four source-confirmed Sommer 2026 BTV meeting PDFs, READ ONLY.
// Every log is aggregate counts/error codes; never names or scores of individuals.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseOfficialMeetingText} from './btv-meeting-rubbers-parser.mjs';
const records=[
 {meeting:12696831,home:0,away:6},
 {meeting:12742553,home:7,away:2},
 {meeting:12702107,home:4,away:2},
 {meeting:12695005,home:3,away:3}
];
const dir=mkdtempSync(join(tmpdir(),'btv-reports-pilot-'));
try{
 for(const r of records){
  const u=new URL('https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument');
  u.searchParams.set('dokument','MeetingReportFOP');u.searchParams.set('meeting',String(r.meeting));
  try {
   const reply=await fetch(u,{signal:AbortSignal.timeout(18000),headers:{Accept:'application/pdf','User-Agent':'TSV-2026-OfficialReportParserValidation/1.0'}});
   if(reply.status===403||reply.status===429){
    console.log('PARSER_BLOCKED='+reply.status);break;
   }
   if(!reply.ok)throw Error('SOURCE_HTTP_'+reply.status);
   const bytes=Buffer.from(await reply.arrayBuffer());
   if(bytes.length>9000000||bytes.toString('ascii',0,4)!=='%PDF')throw Error('INVALID_OFFICIAL_PDF');
   const file=join(dir,r.meeting+'.pdf');writeFileSync(file,bytes);
   const txt=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:12000,maxBuffer:2000000});
   if(!/TSV\s+Feldkirchen/i.test(txt))throw Error('WRONG_CLUB');
   const result=parseOfficialMeetingText(txt,{expectedHomePoints:r.home,expectedAwayPoints:r.away});
   console.log('PARSER_PILOT='+JSON.stringify({meeting:r.meeting,verification:result.verification_status,
     singles:result.singles.length,doubles:result.doubles.length,total:result.total,errors:result.errors}));
  }catch(error){
   const msg=String(error.message||error);
   console.log('PARSER_PILOT='+JSON.stringify({meeting:r.meeting,error:/^SOURCE_HTTP_\d{3}$/.test(msg)?msg:'PARSER_UNAVAILABLE'}));
  }
  await new Promise(resolve=>setTimeout(resolve,500));
 }
}finally{rmSync(dir,{recursive:true,force:true})}
console.log('PARSER_PILOT_PERSONAL_DATA_LOGGED=NO');
