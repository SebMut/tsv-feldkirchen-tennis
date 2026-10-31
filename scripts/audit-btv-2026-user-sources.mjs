// One-off read-only validation of user-supplied official public BTV PDFs.
// Never treat TV Feldkirchen (02091) as TSV Feldkirchen (01012).
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const root='https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument';
const sources=[
 {key:'user-siegertsbrunn-group',query:{dokument:'ScheduleReportFOP',group:'2226499',etag:'fd2a8663-f746-4a8f-b414-4a0835409b96'}},
 {key:'user-stk-garching-club',query:{dokument:'ScheduleReportFOP',club:'23376',season:'18105'}},
 {key:'current-tsv-verein',query:{dokument:'ScheduleReportFOP',club:'23391',season:'18105'}},
 {key:'legacy-herren-50-II-group',query:{dokument:'ScheduleReportFOP',group:'2155116'}},
 {key:'legacy-knaben-15-II-group',query:{dokument:'ScheduleReportFOP',group:'2155363'}}
];
for(const source of sources){
 const u=new URL(root);for(const [k,v] of Object.entries(source.query))u.searchParams.set(k,v);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 let res;try{res=await fetch(u,{signal:controller.signal,headers:{Accept:'application/pdf', 'User-Agent':'TSV-Feldkirchen-2026-OfficialSourceVerification/1.0'}})}
 catch(e){console.log('SOURCE_2026='+JSON.stringify({key:source.key,error:String(e.message||e).slice(0,180)}));continue}
 finally{clearTimeout(timer)}
 if([403,429].includes(res.status)){console.log('SOURCE_2026='+JSON.stringify({key:source.key,blocked:res.status}));break}
 if(!res.ok){console.log('SOURCE_2026='+JSON.stringify({key:source.key,http:res.status}));continue}
 const buf=Buffer.from(await res.arrayBuffer());if(buf.toString('ascii',0,4)!=='%PDF') {console.log('SOURCE_2026='+JSON.stringify({key:source.key,validPdf:false,http:res.status}));continue}
 const dir=mkdtempSync(join(tmpdir(),'btv-2026-match-source-'));
 try{
  const file=join(dir,'report.pdf');writeFileSync(file,buf);
  const txt=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
  const lines=txt.split(/\r?\n/);
  const context=[];
  for(let i=0;i<lines.length;i++){
   if(/STK Garching|Siegertsbrunn II|TSV Feldkirchen II|TV Feldkirchen II|10\.07\.2026|16\.05\.2026|Gr\.\s*(?:349|396|646)\b/i.test(lines[i])){
    if(context.length<37) context.push({line:i+1,rows:lines.slice(Math.max(0,i-1),i+2).map(x=>x.trim().slice(0,190))});
   }
  }
  console.log('SOURCE_2026='+JSON.stringify({key:source.key,http:res.status,bytes:buf.length,
     header:lines.slice(0,6).map(x=>x.trim()),hasClub01012:txt.includes('TSV Feldkirchen (01012)'),
     hasTV02091:txt.includes('TV Feldkirchen II (02091)'),context}).slice(0,17000));
 }catch(e){console.log('SOURCE_2026='+JSON.stringify({key:source.key,parseError:String(e.message||e).slice(0,200)}))}
 finally{rmSync(dir,{recursive:true,force:true})}
 await new Promise(ok=>setTimeout(ok,700));
}
