// Copyright of the official match schedule remains with BTV / nuLiga.
// This reader performs ONE PDF request per execution and only parses the
// public club-fixture table, never player/member details or private areas.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

export const CLUB_ID = '01012';
export const NULIGA_CLUB = '23391';
export const LEAGUE_SEASONS = Object.freeze({ 2026: '18105' });
export const SOURCE_ORIGIN = 'https://btv.liga.nu';
const PDF_PATH = '/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument';
export function sourceForYear(year) {
  const season = LEAGUE_SEASONS[year];
  if (!season) throw new Error('BTV season ID for year ' + year + ' is not verified/configured. No import.');
  const url = new URL(PDF_PATH, SOURCE_ORIGIN);
  url.searchParams.set('club', NULIGA_CLUB);
  url.searchParams.set('dokument', 'ScheduleReportFOP');
  url.searchParams.set('season', season);
  return url.toString();
}

const TEAM_SLUGS = new Map(Object.entries({
  'herren': 'herren', 'herren ii':'herren-ii', 'herren iii':'herren-iii',
  'herren 40':'herren-40', 'herren 40 ii':'herren-40-ii',
  'herren 50':'herren-50', 'herren 50 ii':'herren-50-ii',
  'damen':'damen', 'damen 30':'damen-30','damen 40':'damen-40','damen 50':'damen-50',
  'junioren 18':'junioren-18','junioren 18 ii':'junioren-18-ii',
  'knaben 15':'knaben-15','knaben 15 ii':'knaben-15-ii',
  'mädchen 15':'maedchen-15','maedchen 15':'maedchen-15',
  'bambini 12':'bambini-12','bambini 12 ii':'bambini-12-ii','bambini 12 iii':'bambini-12-iii',
  'kleinfeld u9':'kleinfeld-u9'
}));

export function normalizedName(value) {
  return String(value).replace(/\s*\(\s*4er\s*\)/gi,'').replace(/^Dunlop\s+/i,'')
    .normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('de-DE');
}
export function sideToTeam(home,away) {
  const h = TEAM_SLUGS.get(normalizedName(home));
  const a = TEAM_SLUGS.get(normalizedName(away));
  if (!!h === !!a) return null; // neither/ambiguous: fail closed
  return { slug: h || a, isHome: !!h, opponent: h ? away : home, four: /\(4er\)/i.test(h ? home : away) };
}
function berlinUtc(date, time) {
  const [y,m,d] = date.split('-').map(Number);
  const [hour,minute] = time.split(':').map(Number);
  // Offset at midday in Europe/Berlin; handles winter/summer DST automatically.
  const anchor = new Date(Date.UTC(y,m-1,d,12));
  const part = new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Berlin',timeZoneName:'longOffset'})
    .formatToParts(anchor).find(x=>x.type==='timeZoneName')?.value || 'GMT+00:00';
  const offset = part.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  const min = offset ? (offset[1]==='-'?-1:1)*(Number(offset[2])*60+Number(offset[3]||0)):0;
  return new Date(Date.UTC(y,m-1,d,hour,minute)-min*60000).toISOString();
}
function fixtureKey(year, slug, home, opponent, repeat = 1) {
  // Stable across ordinary date changes, unlike a timestamp-derived key.
  const input=[year,slug,home?'H':'A',normalizedName(opponent),repeat].join('|');
  return createHash('sha256').update(input).digest('hex');
}
export function parseClubSchedulePdf(file,year) {
  const info = execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:12000});
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  const size = info.match(/^Page size:\s+([\d.]+) x ([\d.]+)/m);
  if (!pages || pages>15 || !size || Number(size[1])<700) throw new Error('Unexpected BTV PDF pages/layout');
  const full = execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:22000,maxBuffer:3*1024*1024});
  if (!full.includes('TSV Feldkirchen (01012)') || !full.includes('Sommer '+year) || !full.includes('Vereinsspielplan')) {
    throw new Error('Wrong club, season or PDF type; refusing import');
  }
  const pageWidth=Number(size[1]),pageHeight=Number(size[2]);
  const half=Math.round(pageWidth/2);
  const parsed = [], unrecognized = [];
  let rawRows=0;
  for(let page=1;page<=pages;page++) {
    for(const [x,w] of [[0,half],[half,Math.ceil(pageWidth-half)]]) {
      const text=execFileSync('pdftotext',['-layout','-f',String(page),'-l',String(page),
        '-x',String(x),'-y','0','-W',String(w),'-H',String(Math.ceil(pageHeight)),file,'-'],
        {encoding:'utf8',timeout:12000,maxBuffer:1024*1024});
      let date='';
      for(const line of text.split(/\r?\n/)) {
        const match=line.match(/^\s*(?:(?:Mo|Di|Mi|Do|Fr|Sa|So)\.\s+(\d{2})\.(\d{2})\.(\d{4}))?\s*(\d{2}:\d{2})\s+([A-Z0-9]{1,5})\s{2,}(.+?)\s*$/);
        if(!match) continue;
        if(match[1]) date=`${match[3]}-${match[2]}-${match[1]}`;
        if(!date||!date.startsWith(year+'-')) continue;
        const values=match[6].trim().split(/\s{2,}/).map(s=>s.trim()).filter(Boolean);
        if(values.length<2) continue;
        rawRows++;
        const [home,away]=values;
        const assigned=sideToTeam(home,away);
        if(!assigned) {
          unrecognized.push({date,time:match[4],home,away,page,x});
          continue;
        }
        const score=values.slice(2).find(v=>/^\d{1,2}\s*:\s*\d{1,2}$/.test(v)) || null;
        parsed.push({
          ...assigned,
          date, time:match[4], startsAt:berlinUtc(date,match[4]),
          score, leagueCode:match[5], sourcePage:page,
        });
      }
    }
  }
  // A complete club schedule is expected; fail closed if parsing is partial.
  // Note: pre/post-season counts may differ; 2026 has 20 known teams.
  if(rawRows<70||parsed.length<70||parsed.length>200) {
    throw new Error(`BTV rows incomplete/suspicious: ${parsed.length} assigned, ${rawRows} parsed rows`);
  }
  const duplicates=new Map();
  parsed.sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  for(const item of parsed) {
    const identity=[item.slug,item.isHome?'H':'A',normalizedName(item.opponent)].join('|');
    const repeat=(duplicates.get(identity)||0)+1;
    duplicates.set(identity,repeat);
    item.sourceKey=fixtureKey(year,item.slug,item.isHome,item.opponent,repeat);
  }
  if(new Set(parsed.map(item=>item.sourceKey)).size!==parsed.length) throw new Error('Duplicate import source keys');
  if(unrecognized.length>10 || parsed.length/rawRows < 0.92)
    throw new Error(`Unmatched team names: ${unrecognized.length} of ${rawRows}: ${JSON.stringify(unrecognized.slice(0,5))}`);
  return {fixtures:parsed,rawRows,unrecognized,pages,sourceFile:'BTV Sommer '+year+' Vereinsspielplan'};
}
export async function getClubSchedule(year) {
  const url=sourceForYear(year);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),25000);
  let response;
  try {
    response=await fetch(url,{headers:{
      'Accept':'application/pdf',
      'User-Agent':'TSV-Feldkirchen-Tennis-ScheduleSync/1.0 (club site, 1 request daily)',
    },signal:controller.signal});
  } finally {clearTimeout(timeout)}
  if(response.status===403||response.status===429) throw new Error('BTV rate-limited/blocked the request; no retry or bypass');
  if(!response.ok) throw new Error('BTV HTTP '+response.status+'; no changes made');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.byteLength<1000||bytes.byteLength>10000000||bytes.toString('ascii',0,4)!=='%PDF')
    throw new Error('BTV source is not an expected PDF; no changes made');
  const dir=mkdtempSync(join(tmpdir(),'btv-club-'));
  try {
    const file=join(dir,'schedule.pdf');
    writeFileSync(file,bytes);
    return {sourceUrl:url,bytes:bytes.length,...parseClubSchedulePdf(file,year)};
  } finally {rmSync(dir,{recursive:true,force:true})}
}
