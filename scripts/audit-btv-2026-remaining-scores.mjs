// Read only 2026 official BTV public match/group report PDFs.
// No personal rosters, no player names, no database writes, and no unbounded crawl.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
const targets=[
 {key:'Herren 40 Malgersdorf',group:'2165602',markers:['Malgersdorf','Feldkirchen']},
 {key:'Damen Oberding',group:'2154955',markers:['Oberding','Feldkirchen']},
 {key:'Herren 50 II Siegertsbrunn',group:'2155116',markers:['Siegertsbrunn','Feldkirchen']},
 {key:'Knaben 15 II STK Garching',group:'2155363',markers:['Garching','Feldkirchen']},
 {key:'Bambini 12 Oberpframmern',group:'2216734',markers:['Oberpframmern','Feldkirchen']},
];
for(const t of targets){
 const url=new URL('https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument');
 url.searchParams.set('dokument','ScheduleReportFOP');url.searchParams.set('group',t.group);
 const ctrl=new AbortController();const tm=setTimeout(()=>ctrl.abort(),14000);
 let res;
 try{res=await fetch(url,{signal:ctrl.signal,headers:{Accept:'application/pdf',
   'User-Agent':'TSV-Feldkirchen-Tennis-2026-Public-Group-Results-Audit/1.0'}})}
 catch(e){console.log('GROUP_2026='+JSON.stringify({key:t.key,group:t.group,error:String(e.message||e).slice(0,130)}));continue}
 finally{clearTimeout(tm)}
 if(res.status===403||res.status===429){console.log('GROUP_2026='+JSON.stringify({key:t.key,blocked:res.status}));break}
 if(!res.ok){console.log('GROUP_2026='+JSON.stringify({key:t.key,group:t.group,http:res.status}));continue}
 const bytes=Buffer.from(await res.arrayBuffer());
 if(bytes.toString('ascii',0,4)!=='%PDF'||bytes.length<700||bytes.length>10000000){console.log('GROUP_2026='+JSON.stringify({key:t.key,invalid:true}));continue}
 const dir=mkdtempSync(join(tmpdir(),'btv-2026-groups-'));
 try{
  const file=join(dir,'g.pdf');writeFileSync(file,bytes);
  const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  const lines=text.split(/\r?\n/);
  const selected=[];
  for(let i=0;i<lines.length;i++){
   if(t.markers.some(m=>lines[i].toLowerCase().includes(m.toLowerCase()))){
     selected.push({line:i,near:lines.slice(Math.max(0,i-1),Math.min(i+3,lines.length)).map(v=>v.trim().slice(0,200))});
   }
  }
  const groupLabel=lines.slice(0,7).map(x=>x.trim()).filter(Boolean);
  console.log('GROUP_2026='+JSON.stringify({key:t.key,group:t.group,http:res.status,groupLabel,
    relevant:selected.slice(0,20)}).slice(0,10000));
 }finally{rmSync(dir,{recursive:true,force:true})}
 await new Promise(r=>setTimeout(r,800));
}
// One 2026 official TSV club group listing, for withdrawals not on match schedule.
const url='https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?club=23391&dokument=ResultReportFOP&season=18105&type=group';
const ctrl=new AbortController();const tm=setTimeout(()=>ctrl.abort(),22000);
let resp;
try{resp=await fetch(url,{signal:ctrl.signal,headers:{Accept:'application/pdf','User-Agent':'TSV-Feldkirchen-Tennis-2026-Withdrawal-Audit/1.0'}})}
catch(e){console.log('CLUB_GROUP_2026='+JSON.stringify({error:String(e.message||e).slice(0,130)}));process.exit(0)}
finally{clearTimeout(tm)}
if(resp.status===403||resp.status===429){console.log('CLUB_GROUP_2026='+JSON.stringify({blocked:resp.status}));process.exit(0)}
if(!resp.ok){console.log('CLUB_GROUP_2026='+JSON.stringify({http:resp.status}));process.exit(0)}
const bytes=Buffer.from(await resp.arrayBuffer());
if(bytes.toString('ascii',0,4)!=='%PDF'){console.log('CLUB_GROUP_2026='+JSON.stringify({invalid:true}));process.exit(0)}
const dir=mkdtempSync(join(tmpdir(),'btv-2026-club-'));
try{
 const file=join(dir,'club.pdf');writeFileSync(file,bytes);
 const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:15000,maxBuffer:1500000});
 const lines=text.split(/\r?\n/);
 const regex=/Oberpframmern II|VfB Forstinning|SV DJK Taufkirchen|TC Moosburg|Gr\.\s*(?:849|315|396|565)\b/i;
 const relevant=[];
 for(let i=0;i<lines.length;i++)if(regex.test(lines[i])){
  relevant.push({line:i,near:lines.slice(Math.max(0,i-1),i+4).map(s=>s.trim().slice(0,350))});
 }
 console.log('CLUB_GROUP_2026='+JSON.stringify({http:resp.status,relevant:relevant.slice(0,35)}).slice(0,18000));
}finally{rmSync(dir,{recursive:true,force:true})}
