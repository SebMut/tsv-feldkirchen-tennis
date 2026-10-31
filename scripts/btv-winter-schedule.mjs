// Public BTV winter 2026/27 group fixture reader. Three verified group PDFs
// cover the three TSV winter squads. No team roster or private BTV data.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';

export const WINTER_CODE='winter-2026-2027';
export const WINTER_YEAR=2027; // Ending year, not Summer 2027.
export const VERIFIED_GROUPS=Object.freeze([
  {slug:'herren',clubName:'TSV Feldkirchen',group:2257673,league:'Herren Südliga 2 Gr. 018'},
  {slug:'herren-ii',clubName:'TSV Feldkirchen II',group:2257681,league:'Herren Südliga 2 Gr. 020'},
  {slug:'herren-50',clubName:'TSV Feldkirchen',group:2257828,league:'Herren 50 Südliga 1 Gr. 166'},
]);
export function normalizeWinterName(name){
  return String(name).normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('de-DE');
}
function berlinUtc(date,time){
  const [y,m,d]=date.split('-').map(Number);
  const [hour,minute]=time.split(':').map(Number);
  const offsetName=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Berlin',timeZoneName:'longOffset'})
    .formatToParts(new Date(Date.UTC(y,m-1,d,12))).find(x=>x.type==='timeZoneName')?.value||'GMT+00:00';
  const offset=offsetName.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  const minutes=offset?(offset[1]==='-'?-1:1)*(Number(offset[2])*60+Number(offset[3]||0)):0;
  return new Date(Date.UTC(y,m-1,d,hour,minute)-minutes*60000).toISOString();
}
export function winterGroupUrl(group){
  if(!VERIFIED_GROUPS.some(g=>g.group===group))throw Error('Unknown / unverified BTV winter group');
  const url=new URL('https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument');
  url.searchParams.set('dokument','ScheduleReportFOP');
  url.searchParams.set('group',String(group));
  return url.toString();
}
export function parseWinterGroupPdf(file,config){
  const meta=execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:12000});
  const pages=Number(meta.match(/^Pages:\s+(\d+)/m)?.[1]);
  const size=meta.match(/^Page size:\s+([\d.]+) x ([\d.]+)/m);
  if(pages!==1||!size||Number(size[1])<780||Number(size[1])>950||Number(size[2])<500)
    throw Error('Unexpected winter PDF layout: '+config.group);
  const width=Number(size[1]),height=Number(size[2]);
  const left=execFileSync('pdftotext',['-layout','-f','1','-l','1','-x','0','-y','0','-W',String(Math.floor(width/2)),'-H',String(Math.ceil(height)),file,'-'],
    {encoding:'utf8',timeout:16000});
  const right=execFileSync('pdftotext',['-layout','-f','1','-l','1','-x',String(Math.floor(width/2)),'-y','0','-W',String(Math.ceil(width/2)),'-H',String(Math.ceil(height)),file,'-'],
    {encoding:'utf8',timeout:16000});
  if(!left.includes('Südbayern Winterrunde | Winter 2026/2027')||!left.includes(config.league)
     ||!left.includes(config.clubName+' (01012)')||!right.includes('Termin')
     ||!right.includes('Heimmannschaft')||!right.includes('Gastmannschaft'))
    throw Error('Unverified club / winter season / competition in group '+config.group);
  let currentDate='';
  let raw=0;
  const matches=[];
  const groupTeams=new Set();
  for(const line of right.split(/\r?\n/)){
    const found=line.match(/^\s*(?:(?:Mo|Di|Mi|Do|Fr|Sa|So)\.\s+(\d{2})\.(\d{2})\.(\d{4})\s+)?(\d{2}:\d{2})\s{2,}(.+?)\s*$/);
    if(!found)continue;
    if(found[1])currentDate=found[3]+'-'+found[2]+'-'+found[1];
    if(!currentDate)throw Error('Winter row without preceding date: '+config.group);
    const date=currentDate;
    if(date<'2026-10-01'||date>'2027-04-30')throw Error('Winter event date out of season: '+date);
    const fields=found[5].trim().split(/\s{2,}/).map(x=>x.trim()).filter(Boolean);
    if(fields.length<2)throw Error('Incomplete winter fixture row group '+config.group);
    const [home,away]=fields;
    groupTeams.add(home);groupTeams.add(away);
    raw++;
    if(home!==config.clubName && away!==config.clubName)continue;
    if(home===away)throw Error('Invalid self-fixture group '+config.group);
    const isHome=home===config.clubName;
    const opponent=isHome?away:home;
    const result=fields.slice(2).find(v=>/^\d{1,2}\s*:\s*\d{1,2}$/.test(v))||null;
    matches.push({
      slug:config.slug,group:config.group,
      opponent,isHome,date,time:found[4],
      startsAt:berlinUtc(date,found[4]),
      score:result,
      league:config.league,
      sourceUrl:winterGroupUrl(config.group)
    });
  }
  if(raw!==15 || groupTeams.size!==6 || matches.length!==5)
    throw Error('Incomplete winter group '+config.group+': '+JSON.stringify({raw,teams:groupTeams.size,clubMatches:matches.length}));
  const repeats=new Map();
  for(const game of matches.sort((a,b)=>a.startsAt.localeCompare(b.startsAt))){
    const sameKey=[config.slug,game.isHome?'H':'A',normalizeWinterName(game.opponent)].join('|');
    const repeat=(repeats.get(sameKey)||0)+1;repeats.set(sameKey,repeat);
    game.sourceKey=createHash('sha256').update([WINTER_CODE,config.slug,game.isHome?'H':'A',normalizeWinterName(game.opponent),repeat].join('|')).digest('hex');
  }
  return {fixtures:matches,group:config.group,rawRows:raw};
}
export async function getWinterSchedule(){
 const dir=mkdtempSync(join(tmpdir(),'btv-winter-'));
 try{
   const all=[];
   for(const config of VERIFIED_GROUPS){
     const url=winterGroupUrl(config.group);
     const response=await fetch(url,{headers:{Accept:'application/pdf','User-Agent':'TSV Feldkirchen tennis verified winter fixture sync'},signal:AbortSignal.timeout(23000)});
     if([403,429].includes(response.status))throw Error('BTV rate limit for '+config.group+'; no retry');
     if(!response.ok)throw Error('Winter group HTTP '+response.status+': '+config.group);
     const bytes=Buffer.from(await response.arrayBuffer());
     if(bytes.byteLength<1000||bytes.byteLength>4000000||bytes.toString('ascii',0,4)!=='%PDF')throw Error('BTV winter PDF missing for '+config.group);
     const file=join(dir,config.group+'.pdf');writeFileSync(file,bytes);
     all.push(...parseWinterGroupPdf(file,config).fixtures);
   }
   if(all.length!==15||new Set(all.map(f=>f.sourceKey)).size!==15)
     throw Error('Winter fixtures missing / duplicate; declining write');
   return {fixtures:all,sourceUrl:'https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften',seasonCode:WINTER_CODE};
 }finally{rmSync(dir,{recursive:true,force:true})}
}
