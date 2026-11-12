// Read-only diagnostics for official public BTV team/group *scores*.
// The short source excerpt contains competition/team information, never player names.
// Use explicit group IDs, never guess 2027 IDs or write results from this probe.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const raw=process.argv.slice(2);
const ids=raw.length?raw:['2216736','2180636'];
if(ids.length<1||ids.length>4||ids.some(id=>!/^\d{7,8}$/.test(id)))
  throw Error('Expected 1-4 explicit verified BTV group IDs');
for(const id of ids) {
  const url=new URL('/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument','https://btv.liga.nu');
  url.searchParams.set('dokument','ScheduleReportFOP');
  url.searchParams.set('group',id);
  let response;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/pdf',
    'User-Agent':'TSV-Feldkirchen-Tennis-Group-ID-Check/1.0 (public official team scores only)'}});}
  catch(err){console.log('GROUP_PROBE='+JSON.stringify({id,error:String(err?.message||err).slice(0,140)}));continue;}
  finally{clearTimeout(timer)}
  const status=response.status,ct=response.headers.get('content-type');
  if(status===403||status===429){
    console.log('GROUP_PROBE='+JSON.stringify({id,http:status,blocked:true}));break;
  }
  if(!response.ok){
    console.log('GROUP_PROBE='+JSON.stringify({id,http:status,contentType:ct}));continue;
  }
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<1000||bytes.length>10000000||bytes.toString('ascii',0,4)!=='%PDF'){
    console.log('GROUP_PROBE='+JSON.stringify({id,http:status,contentType:ct,validPDF:false}));continue;
  }
  const dir=mkdtempSync(join(tmpdir(),'btv-group-check-'));
  try{
    const file=join(dir,'group.pdf');writeFileSync(file,bytes);
    const txt=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:12000,maxBuffer:1024*1024});
    const lines=txt.split(/\r?\n/);
    const title=lines.filter(l=>/Sommer 2026|Bambini 12|Gr\.\s*850|Tabelle und Spielplan|TSV Feldkirchen|TC Rot.Weiß Poing/.test(l))
      .map(s=>s.trim()).slice(0,17);
    const position=lines.findIndex(l=>l.includes('TC Rot-Weiß Poing')&&l.includes('TSV Feldkirchen'));
    const gameContext=position>=0?lines.slice(Math.max(0,position-3),position+4).map(s=>s.trim().slice(0,170)):[];
    const firstLines=lines.slice(0,55).map(s=>s.trim().slice(0,180)).filter(Boolean).slice(0,30);
    console.log('GROUP_PROBE='+JSON.stringify({id,http:status,validPDF:true,
      bytes:bytes.length,title,gameContext,firstLines}).slice(0,7000));
  }finally{rmSync(dir,{recursive:true,force:true})}
}
