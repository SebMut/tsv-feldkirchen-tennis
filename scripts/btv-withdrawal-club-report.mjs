// A single official BTV "Gruppeneinteilung" PDF covers *all* of the club's
// summer groups. This is a fallback for group schedule PDFs (many return 500).
// Only explicitly dated withdrawal rows in exactly identified groups qualify.
// No member data, missing-fixture inference, or unverified competition IDs.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LEAGUE_SEASONS} from './btv-schedule.mjs';
import {normalizeBtvTeam} from './btv-withdrawal-source.mjs';

export function officialClubGroupReportUrl(seasonCode){
  const y=String(seasonCode).match(/^sommer-(20\d{2})$/)?.[1];
  const season=y && LEAGUE_SEASONS[y];
  if(!season) return null; // no guessed competition references
  const url=new URL('/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument','https://btv.liga.nu');
  url.searchParams.set('club','23391');
  url.searchParams.set('dokument','ResultReportFOP');
  url.searchParams.set('season',season);
  url.searchParams.set('type','group');
  return url.toString();
}
function localISO(raw){
  const m=String(raw).match(/^(\d{2})\.(\d{2})\.(20\d{2})$/);
  if(!m) return null;
  const iso=m[3]+'-'+m[2]+'-'+m[1];
  const d=new Date(iso+'T00:00:00Z');
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10)===iso ? iso : null;
}
// The PDF contains five adjacent group columns. PDF-to-text must be cropped
// *per column*; pdftotext without crop interleaves unrelated group rows.
export function parseClubReportColumn(text){
  const lines=String(text).split(/\r?\n/);
  let group=null;
  const entries=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    const heading=line.match(/\bGr\.\s*0*(\d{1,4})(?:\s+SU)?\s*$/);
    if(heading && /^(?:Herren|Damen|Junior|Knaben|Mädchen|Bambini|Dunlop|Mixed|Freizeit)/i.test(line)){
      group=Number(heading[1]);
      continue;
    }
    const candidate=line.match(/^(\d{1,2})\s+(.+?)\s+zurückgezogen(?:\s*\/\s*gesperrt)?\s+am\b/i);
    if(!group||!candidate)continue;
    const rank=Number(candidate[1]);
    if(rank<1||rank>20)continue;
    const name=candidate[2].trim();
    if(name.length<3||name.length>90)continue;
    // Date and code may be on next line. Keep tightly within this one team row.
    const continuation=lines.slice(i,Math.min(i+3,lines.length)).join(' ');
    const nextRank=continuation.search(/\s\d{1,2}\s+[A-ZÄÖÜ]/);
    const span=nextRank>0?continuation.slice(0,nextRank):continuation;
    const date=span.match(/['’]?(\d{2}\.\d{2}\.20\d{2})['’]?/);
    const code=span.match(/\((\d{5})\)/);
    if(!date||!code)continue;
    const day=localISO(date[1]);
    if(!day)continue;
    entries.push({group,team:normalizeBtvTeam(name),displayName:name,clubCode:code[1],withdrawnOn:day});
  }
  return entries;
}

export function parseClubGroupReport(columns,{seasonCode,club='TSV Feldkirchen'}){
  if(!Array.isArray(columns)||!columns.length||columns.length>100)
    throw Error('BTV_GROUP_REPORT_INVALID_COLUMNS');
  if(!/^sommer-20\d{2}$/.test(seasonCode))throw Error('BTV_GROUP_REPORT_INVALID_SEASON');
  if(!club||club!=='TSV Feldkirchen')throw Error('BTV_GROUP_REPORT_WRONG_CLUB');
  const entries=columns.flatMap(parseClubReportColumn);
  const keyed=new Map();
  for(const entry of entries){
    const key=[entry.group,entry.team,entry.clubCode].join('|');
    const prev=keyed.get(key);
    if(prev && prev.withdrawnOn!==entry.withdrawnOn)
      throw Error('BTV_GROUP_REPORT_CONFLICT_'+key);
    keyed.set(key,entry);
  }
  return [...keyed.values()];
}

export async function fetchClubGroupReport(seasonCode){
  const url=officialClubGroupReportUrl(seasonCode);
  if(!url) return null;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),26000);
  let resp;
  try{
    resp=await fetch(url,{headers:{
      Accept:'application/pdf',
      'User-Agent':'TSV-Feldkirchen-Tennis-WithdrawalSync/1.1 (official club group report; 1 request/season)'
    },signal:controller.signal});
  }finally{clearTimeout(timer);}
  if(resp.status===403||resp.status===429)throw Error('BTV_CLUB_GROUP_BLOCKED');
  if(!resp.ok)throw Error('BTV_CLUB_GROUP_HTTP_'+resp.status);
  const bytes=Buffer.from(await resp.arrayBuffer());
  if(bytes.length<1000||bytes.length>15000000||bytes.toString('ascii',0,4)!=='%PDF')
    throw Error('BTV_CLUB_GROUP_NOT_PDF');
  const dir=mkdtempSync(join(tmpdir(),'btv-club-groups-'));
  try{
    const file=join(dir,'groups.pdf');
    writeFileSync(file,bytes);
    const info=execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:12000});
    const pages=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    const size=info.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)/m);
    if(!pages||pages>12||!size||Number(size[1])<700)
      throw Error('BTV_CLUB_GROUP_UNEXPECTED_LAYOUT');
    // Verify the *uncropped* PDF's club and season identity before using any
    // cropped text. Do not assume a download succeeded based on HTTP alone.
    const full=execFileSync('pdftotext',['-layout',file,'-'],{
      encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024
    });
    const year=seasonCode.slice(7);
    if(!full.includes('Sommer '+year) ||
       !full.includes('TSV Feldkirchen (01012)') ||
       !full.includes('Gruppeneinteilung'))
      throw Error('BTV_CLUB_GROUP_IDENTITY_MISMATCH');
    const width=Number(size[1]),height=Number(size[2]);
    const columns=[];
    for(let page=1;page<=pages;page++){
      // Five ranking columns across a landscape sheet, isolated to preserve
      // the group heading and its matching withdrawal row.
      for(let col=0;col<5;col++){
        const x=Math.floor(width*col/5);
        const w=Math.ceil(width*(col+1)/5)-x;
        const text=execFileSync('pdftotext',[
          '-layout','-f',String(page),'-l',String(page),
          '-x',String(x),'-y','0','-W',String(w),
          '-H',String(Math.ceil(height)),file,'-'
        ],{encoding:'utf8',timeout:15000,maxBuffer:512*1024});
        columns.push(text);
      }
    }
    const entries=parseClubGroupReport(columns,{seasonCode});
    return {url,entries,pages,sourceKind:'club_group_report'};
  }finally{rmSync(dir,{recursive:true,force:true});}
}
