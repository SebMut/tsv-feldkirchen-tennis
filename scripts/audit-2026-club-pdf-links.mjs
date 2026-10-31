// Read-only audit of official BTV TSV Feldkirchen club PDFs for Sommer 2026.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
const scenarios=[
 {name:'2026 club tables small',query:{dokument:'ResultReportFOP',type:'small',club:'23391',season:'18105'}},
 {name:'2026 club tables group',query:{dokument:'ResultReportFOP',type:'group',club:'23391',season:'18105'}},
 {name:'2026 all fixtures',query:{dokument:'ScheduleReportFOP',club:'23391',season:'18105'}},
 {name:'user linked season report',query:{dokument:'ResultReportFOP',type:'small',club:'23391',season:'18661'}}
];
for(const s of scenarios){
 const u=new URL('https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument');
 for(const [key,value] of Object.entries(s.query))u.searchParams.set(key,value);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),16000);
 let response;
 try{response=await fetch(u,{signal:controller.signal,headers:{Accept:'application/pdf','User-Agent':'TSV-2026-Club-PDF-Validation/1.0'}})}
 catch(e){console.log('TSV_CLUB_REPORT='+JSON.stringify({name:s.name,error:String(e.message||e).slice(0,100)}));continue}
 finally{clearTimeout(timeout)}
 if(response.status===403||response.status===429){console.log('TSV_CLUB_REPORT='+JSON.stringify({name:s.name,blocked:response.status}));break}
 if(!response.ok){console.log('TSV_CLUB_REPORT='+JSON.stringify({name:s.name,status:response.status}));continue}
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.toString('ascii',0,4)!=='%PDF'||bytes.length>14000000){console.log('TSV_CLUB_REPORT='+JSON.stringify({name:s.name,format:'not-valid-PDF',status:response.status}));continue}
 const dir=mkdtempSync(join(tmpdir(),'btv-club-report-'));
 try{
  const pdf=join(dir,'report.pdf');writeFileSync(pdf,bytes);
  const text=execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8',timeout:13000,maxBuffer:4000000});
  const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8',timeout:7000});
  const lines=text.split(/\r?\n/);
  const header=lines.slice(0,9).map(x=>x.trim().slice(0,120)).filter(Boolean);
  const teamNames=['Herren','Damen','Bambini','Junioren','Mädchen','Knaben','Kleinfeld'];
  const found=teamNames.filter(name=>text.includes(name));
  const labels=['Tabelle','Spielplan','Punkte','Matches','Sätze','Beg.','Rang','Vereins-Ergebnis','Vereinsergebnis','Gesamt'];
  const includes=labels.filter(name=>text.toLowerCase().includes(name.toLowerCase()));
  const occurrences=(text.match(/TSV Feldkirchen/g)||[]).length;
  console.log('TSV_CLUB_REPORT='+JSON.stringify({name:s.name,status:response.status,
    bytes:bytes.length,pages:info.match(/^Pages:\s+(\d+)/m)?.[1],
    header,teamWords:found,labels:includes,tsvMentions:occurrences,
    hasSummer2026:text.includes('Sommer 2026'),hasWinter:text.includes('Winter 2026')}));
 }catch(e){console.log('TSV_CLUB_REPORT='+JSON.stringify({name:s.name,error:'PDF_EXTRACT_ERROR'}))}
 finally{rmSync(dir,{recursive:true,force:true})}
 await new Promise(r=>setTimeout(r,500));
}
