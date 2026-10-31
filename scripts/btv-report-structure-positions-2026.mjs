// One-off structural parser calibration; NO player names, IDs or scores in logs.
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
const samples=[12696831,12742553,12702107];
const dir=mkdtempSync(join(tmpdir(),'btv-struct-'));
try{
for(const meeting of samples){
 const u=new URL('https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument');
 u.searchParams.set('dokument','MeetingReportFOP');u.searchParams.set('meeting',String(meeting));
 try{
 const res=await fetch(u,{signal:AbortSignal.timeout(20000)});
 if(res.status===403||res.status===429){console.log('BTV_STRUCTURE_BLOCKED='+res.status);break}
 if(!res.ok)throw Error('BTV_REPORT_HTTP_'+res.status);
 const bytes=Buffer.from(await res.arrayBuffer());if(bytes.toString('ascii',0,4)!=='%PDF')throw Error('BTV_REPORT_NOT_PDF');
 const file=join(dir,meeting+'.pdf');writeFileSync(file,bytes);
 const raw=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:15000,maxBuffer:1e6});
 const lines=raw.split(/\r?\n/);
 // Every letter and every number is irreversibly masked. Preserve exact column spaces.
 const sanitized=lines.slice(0,38).map((line,i)=>{
  const hidden=line.replace(/\p{L}/gu,'X').replace(/[0-9]/g,'9').replace(/[^\sX9:,.;\-()\/]/g,'?');
  return {line:i,masked:hidden.slice(0,210),columns:[...line.matchAll(/\S+/g)].map(m=>m.index).slice(0,16)};
 });
 console.log('BTV_STRUCTURE='+JSON.stringify({meeting,lineCount:lines.length,maskedRows:sanitized}).slice(0,17500));
 }catch(e){console.log('BTV_STRUCTURE='+JSON.stringify({meeting,error:String(e.message||e).slice(0,90)}))}
}
}finally{rmSync(dir,{force:true,recursive:true})}
