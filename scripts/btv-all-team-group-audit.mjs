// Checks each known public TSV team-season BTV URL against the official
// ScheduleReportFOP PDF. Read-only. Does not scrape persons or infer IDs.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const teams=[
 ['Sommer 2026','Bambini 12',849,2155567],
 ['Sommer 2026','Bambini 12 II',852,2155581],
 ['Sommer 2026','Bambini 12 III',850,2216736],
 ['Sommer 2026','Damen',240,2154955],
 ['Sommer 2026','Damen 30',424,2159626],
 ['Sommer 2026','Damen 40',95,2165644],
 ['Sommer 2026','Damen 50',476,2155190],
 ['Sommer 2026','Herren',21,2165579],
 ['Sommer 2026','Herren 40',39,2165602],
 ['Sommer 2026','Herren 40 II',315,2160998],
 ['Sommer 2026','Herren 50',369,2155074],
 ['Sommer 2026','Herren 50 II',396,2155116],
 ['Sommer 2026','Herren II',23,2154741],
 ['Sommer 2026','Herren III',55,2154762],
 ['Sommer 2026','Junioren 18',493,2155193],
 ['Sommer 2026','Junioren 18 II',514,2155235],
 ['Sommer 2026','Kleinfeld U9',965,2162214],
 ['Sommer 2026','Knaben 15',565,2180638],
 ['Sommer 2026','Knaben 15 II',646,2155363],
 ['Sommer 2026','Mädchen 15',730,2155462],
 ['Winter 2026/27','Herren',18,2257673],
 ['Winter 2026/27','Herren 50',166,2257828],
 ['Winter 2026/27','Herren II',20,2257681]
];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
for (let i=0;i<teams.length;i++){
  const [season,team,group,id]=teams[i];
  const u=new URL('/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument','https://btv.liga.nu');
  u.searchParams.set('dokument','ScheduleReportFOP');
  u.searchParams.set('group',String(id));
  const c=new AbortController(), timer=setTimeout(()=>c.abort(),16000);
  let res;
  try{
    res=await fetch(u,{signal:c.signal,headers:{Accept:'application/pdf', 'User-Agent':'TSV-Feldkirchen-Tennis-PublicGroupAudit/1.0'}});
  }catch(e){
    console.log('BTV_TEAM_GROUP_AUDIT='+JSON.stringify({season,team,group,id,status:'fetch-error',reason:String(e.message||e).slice(0,110)}));
    continue;
  }finally{clearTimeout(timer)}
  if([403,429].includes(res.status)){
    console.log('BTV_TEAM_GROUP_AUDIT='+JSON.stringify({season,team,group,id,status:'blocked',http:res.status}));
    break;
  }
  if(!res.ok){
    console.log('BTV_TEAM_GROUP_AUDIT='+JSON.stringify({season,team,group,id,status:'unreachable',http:res.status}));
    await delay(700);continue;
  }
  const bytes=Buffer.from(await res.arrayBuffer());
  if(bytes.toString('ascii',0,4)!=='%PDF'||bytes.length<500){
    console.log('BTV_TEAM_GROUP_AUDIT='+JSON.stringify({season,team,group,id,status:'not-pdf',http:res.status}));
    continue;
  }
  const folder=mkdtempSync(join(tmpdir(),'btv-team-audit-'));
  try{
    const path=join(folder,'group.pdf');
    writeFileSync(path,bytes);
    const content=execFileSync('pdftotext',['-layout',path,'-'],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
    const match=content.match(/Gr\.\s*0*(\d{1,4})(?:\s+SU)?/);
    const actual=match?Number(match[1]):null;
    const seasonMatch=season==='Sommer 2026'?content.includes('Sommer 2026'):/Winter\s+(?:2026\/27|2026\/2027)/.test(content);
    const clubMatch=content.includes('TSV Feldkirchen');
    console.log('BTV_TEAM_GROUP_AUDIT='+JSON.stringify({
      season,team,group,id,status:actual===group&&seasonMatch&&clubMatch?'verified':'mismatch',
      officialGroup:actual,seasonMatch,clubMatch,
      title:content.split(/\r?\n/).slice(0,4).map(x=>x.trim().slice(0,120))
    }));
  }catch(e){console.log('BTV_TEAM_GROUP_AUDIT='+JSON.stringify({season,team,group,id,status:'parse-error',error:String(e.message||e).slice(0,100)}));}
  finally{rmSync(folder,{recursive:true,force:true})}
  await delay(700);
}
