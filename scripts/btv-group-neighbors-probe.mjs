// Narrow, read-only probe around a user-supplied, confirmed official ID
// to identify any contemporaneous TSV group pages. Not a broad scan.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const ids=Array.from({length:19},(_,i)=>2216727+i);
for(const id of ids){
  const url=new URL('/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument','https://btv.liga.nu');
  url.searchParams.set('dokument','ScheduleReportFOP');url.searchParams.set('group',String(id));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
  let r;try{r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/pdf', 'User-Agent':'TSV-Feldkirchen-Tennis-GroupCorrelation/1.0'}})}
  catch(e){console.log('BTV_NEAR_GROUP='+JSON.stringify({id,error:String(e.message||e).slice(0,85)}));continue}
  finally{clearTimeout(timer)}
  if(r.status===403||r.status===429){console.log('BTV_NEAR_GROUP='+JSON.stringify({id,blocked:r.status}));break}
  if(!r.ok){console.log('BTV_NEAR_GROUP='+JSON.stringify({id,http:r.status}));await delay(550);continue}
  const b=Buffer.from(await r.arrayBuffer());
  if(b.toString('ascii',0,4)!=='%PDF'){console.log('BTV_NEAR_GROUP='+JSON.stringify({id,notPdf:true}));continue}
  const dir=mkdtempSync(join(tmpdir(),'btv-group-near-'));
  try{const file=join(dir,'g.pdf');writeFileSync(file,b);
    const t=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:14000,maxBuffer:800000});
    const lines=t.split(/\r?\n/).slice(0,13).map(x=>x.trim());
    console.log('BTV_NEAR_GROUP='+JSON.stringify({id,valid:true,
      club: t.includes('TSV Feldkirchen'),title:lines.slice(0,3),
      snippet:lines.filter(x=>x.includes('TSV Feldkirchen')).slice(0,2).map(x=>x.slice(0,160))}));
  }finally{rmSync(dir,{recursive:true,force:true})}
  await delay(550);
}
