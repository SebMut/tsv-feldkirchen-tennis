// Official BTV group fixture parser. Reads public team standings only, never rosters.
// Only a literal, dated "zurückgezogen/gesperrt am" on a ranked team row counts.
// The generic legend "z...Mannschaft zurückgezogen" MUST NOT trigger detection.
import {normalizedName} from './btv-schedule.mjs';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const ORIGIN='https://btv.liga.nu';
export function officialGroupPdfUrl(groupId){
  if(!Number.isSafeInteger(Number(groupId))||Number(groupId)<1000000||Number(groupId)>99999999)
    throw Error('INVALID_GROUP_ID');
  const url=new URL('/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument',ORIGIN);
  url.searchParams.set('dokument','ScheduleReportFOP');
  url.searchParams.set('group',String(groupId));
  return url.toString();
}
export function groupIdFromBtvUrl(url){
  try{
    const parsed=new URL(url);
    if(parsed.origin!=='https://www.btv.de' ||
       parsed.pathname!=='/de/spielbetrieb/tabelle-spielplan.html')return null;
    const raw=parsed.searchParams.get('groupid');
    if(!/^[0-9]{7,8}$/.test(raw||''))return null;
    return Number(raw);
  }catch{return null;}
}
export function normalizeBtvTeam(value){
  return normalizedName(value).replace(/\s*\(\d{5}\)\s*/g,'').replace(/\s*\(\s*4er\s*\)/gi,'').trim();
}

function validISO(dmy){
  const match=dmy.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(!match)return null;
  const iso=match[3]+'-'+match[2]+'-'+match[1];
  const date=new Date(iso+'T00:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===iso?iso:null;
}

export function parseGroupWithdrawals(text,{seasonCode,groupName}){
  if(typeof text!=='string'||text.length<120||text.length>1000000)
    throw Error('BTV_GROUP_INVALID_TEXT');
  const seasonMatch=String(seasonCode).match(/^sommer-(20\d{2})$|^winter-(20\d{2})-(20\d{2})$/);
  if(!seasonMatch)throw Error('BTV_UNVERIFIED_SEASON');
  const seasonLabel=seasonMatch[1]?'Sommer '+seasonMatch[1]:
    'Winter '+seasonMatch[2]+'/'+seasonMatch[3];
  const g=String(groupName).match(/Gr\.\s*(\d{1,4})\b/);
  if(!g)throw Error('BTV_GROUP_LABEL_MISSING');
  if(!text.includes(seasonLabel) || !new RegExp('\\bGr\\.\\s*0*'+Number(g[1])+'\\b').test(text))
    throw Error('BTV_GROUP_SEASON_MISMATCH');
  if(!/TSV Feldkirchen\s*(?:\(?01012\)?)?/i.test(text))
    throw Error('BTV_WRONG_CLUB_GROUP');

  const lines=text.replace(/\f/g,'\n').split(/\r?\n/);
  const entries=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    const marker=line.search(/\bzurückgezogen\s*\/\s*gesperrt\s+am\b/i);
    if(marker<0)continue;
    const before=line.slice(0,marker).trim();
    const rank=before.match(/^(\d{1,2})\s+(.+)$/);
    if(!rank)continue; // fail closed: do not mistake paragraph or legend for team
    const rawName=rank[2].replace(/\s*\(\d{5}\)\s*$/,'').trim();
    if(!rawName || rawName.length>85 || /^(?:legende|spielleiter|gruppe)\b/i.test(rawName))continue;
    const context=lines.slice(i,Math.min(i+3,lines.length)).join(' ');
    const dateMatch=context.match(/\b(\d{2}\.\d{2}\.\d{4})\b/);
    const codeMatch=context.match(/\((\d{5})\)/);
    const withdrawnOn=dateMatch?validISO(dateMatch[1]):null;
    if(!withdrawnOn||!codeMatch)continue; // explicit team date and club-code evidence
    const team=normalizeBtvTeam(rawName);
    if(!team)continue;
    if(entries.some(e=>e.team===team && e.clubCode===codeMatch[1]))continue;
    entries.push({team,displayName:rawName,clubCode:codeMatch[1],withdrawnOn});
  }
  return entries;
}

export function matchWithdrawalToFixture(flag,match,teamName){
  if(!flag||!match||!/^\d{4}-\d{2}-\d{2}$/.test(flag.withdrawnOn))return null;
  // BTV may still show earlier played matches before withdrawal. Never relabel those.
  const localDate=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(match.starts_at));
  if(localDate<flag.withdrawnOn)return null;
  if(match.btv_result_text?.trim())return null;
  if(normalizeBtvTeam(match.opponent)===flag.team)
    return match.is_home?'away':'home';
  // The TSV team itself is only safely identifiable by its official ranking
  // label inside this already verified group; never match arbitrary club names.
  const suffix=String(teamName).match(/\s+(II|III|IV)$/)?.[1]||'';
  const own=normalizeBtvTeam('TSV Feldkirchen'+(suffix?' '+suffix:''));
  if(flag.team===own&&flag.clubCode==='01012')
    return match.is_home?'home':'away';
  return null;
}

export async function readBtvGroupWithdrawals(groupId,metadata){
  const url=officialGroupPdfUrl(groupId);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  let result;
  try{
    result=await fetch(url,{headers:{
      Accept:'application/pdf',
      'User-Agent':'TSV-Feldkirchen-Tennis-OfficialWithdrawalAudit/1.0 (public group table)'
    },signal:controller.signal});
  }finally{clearTimeout(timer);}
  if(result.status===403||result.status===429)throw Error('BTV_BLOCKED_OR_RATE_LIMITED');
  if(!result.ok)throw Error('BTV_GROUP_HTTP_'+result.status);
  const bytes=Buffer.from(await result.arrayBuffer());
  if(bytes.length<1000||bytes.length>10000000||bytes.toString('ascii',0,4)!=='%PDF')
    throw Error('BTV_GROUP_NOT_PDF');
  const dir=mkdtempSync(join(tmpdir(),'btv-withdrawals-'));
  try{
    const file=join(dir,'btv-group.pdf');
    writeFileSync(file,bytes);
    const info=execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:12000});
    const pages=Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
    if(!pages||pages>8)throw Error('BTV_GROUP_UNEXPECTED_PAGES');
    const text=execFileSync('pdftotext',['-layout',file,'-'],{
      encoding:'utf8',timeout:16000,maxBuffer:1024*1024
    });
    return {url,entries:parseGroupWithdrawals(text,metadata),pages};
  }finally{rmSync(dir,{recursive:true,force:true});}
}
