// Read-only club-specific index across officially identified Südbayern seasons.
// The season IDs are taken from dated official BTV club PDFs, not guessed.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const seasons=[
 {label:'Sommer 2022',id:11223},
 {label:'Sommer 2023',id:12263},
 {label:'Sommer 2024',id:13403},
 {label:'Sommer 2025',id:14843},
 {label:'Sommer 2026',id:18105}
];
for(const season of seasons){
 for(const kind of ['ScheduleReportFOP','ResultReportFOP']){
  const url=new URL('/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument','https://btv.liga.nu');
  url.searchParams.set('club','23391');url.searchParams.set('dokument',kind);
  url.searchParams.set('season',String(season.id));
  if(kind==='ResultReportFOP')url.searchParams.set('type','group');
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),25000);
  let result;
  try{result=await fetch(url,{headers:{Accept:'application/pdf','User-Agent':'TSV-Feldkirchen-Tennis-HistoricalClubAudit/1.0'},
    signal:ctrl.signal})}
  catch(e){console.log('BTV_HISTORY='+JSON.stringify({season:season.label,seasonId:season.id,kind,error:String(e.message||e).slice(0,140)}));continue}
  finally{clearTimeout(timer)}
  if(result.status===403||result.status===429){
    console.log('BTV_HISTORY='+JSON.stringify({season:season.label,seasonId:season.id,kind,status:result.status,blocked:true}));
    process.exit(0);
  }
  if(!result.ok){console.log('BTV_HISTORY='+JSON.stringify({season:season.label,seasonId:season.id,kind,http:result.status,ok:false}));continue;}
  const bytes=Buffer.from(await result.arrayBuffer());
  if(bytes.length<500||bytes.length>18000000||bytes.toString('ascii',0,4)!=='%PDF'){
    console.log('BTV_HISTORY='+JSON.stringify({season:season.label,seasonId:season.id,kind,http:result.status,pdf:false}));continue;
  }
  const dir=mkdtempSync(join(tmpdir(),'btv-historical-'));
  try{
    const file=join(dir,'source.pdf');writeFileSync(file,bytes);
    const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',maxBuffer:3*1024*1024,timeout:20000});
    const info=execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:10000});
    const pages=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    const lines=text.split(/\r?\n/);
    const documentClub=text.includes('TSV Feldkirchen (01012)');
    const header=lines.slice(0,11).map(s=>s.trim()).filter(Boolean);
    const groupLines=lines.filter(l=>/^\s*(?:Herren|Damen|Junior|Knaben|Mädchen|Bambini|Dunlop|Kleinfeld|Mixed|Freizeit).*(?:Südliga|Landesliga|Bayernliga|Gr\.)/i.test(l))
      .slice(0,42).map(s=>s.replace(/\s+/g,' ').trim().slice(0,120));
    const dateRows=lines.filter(l=>/\b(?:Sa|So|Fr|Do|Mi|Di|Mo)\.\s*\d{2}\.\d{2}\.\d{4}/.test(l)).length;
    const scores=(text.match(/(?<!\d)\d{1,2}:\d{1,2}(?!\d)/g)||[]).length;
    const dateRange=[...text.matchAll(/(\d{2}\.\d{2}\.\d{4})/g)].map(m=>m[1]);
    console.log('BTV_HISTORY='+JSON.stringify({season:season.label,seasonId:season.id,kind,url:url.toString(),
      valid:true,club:documentClub,pages,bytes:bytes.length,header,dateRows,scoreTokens:scores,
      dateRange:[dateRange[0],dateRange[dateRange.length-1]],groupLines,
      top:text.slice(0,2100).replace(/\s+/g,' ').slice(0,1450)}).slice(0,8700));
  }catch(e){console.log('BTV_HISTORY='+JSON.stringify({season:season.label,kind,parseError:String(e.message||e).slice(0,140)}))}
  finally{rmSync(dir,{recursive:true,force:true});}
  await new Promise(ok=>setTimeout(ok,700));
 }
}
