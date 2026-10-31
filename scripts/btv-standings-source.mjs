import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {officialGroupPdfUrl} from './btv-withdrawal-source.mjs';

const validSeason=(code)=>/^sommer-20\d{2}$|^winter-20\d{2}-20\d{2}$/.test(String(code));

export function parseBtvStandings(text,{seasonCode,groupName}){
  if(typeof text!=='string'||text.length<120||text.length>1000000)throw Error('STANDINGS_INVALID_TEXT');
  if(!validSeason(seasonCode))throw Error('STANDINGS_INVALID_SEASON');
  const years=[...seasonCode.matchAll(/20\d{2}/g)].map(x=>x[0]);
  const seasonLabel=seasonCode.startsWith('sommer-')
    ? `Sommer ${years[0]}`:`Winter ${years[0]}/${years[1]}`;
  const group=String(groupName).match(/Gr\.\s*(\d{1,4})\b/);
  if(!group||!text.includes(seasonLabel)||!new RegExp(`\\bGr\\.\\s*0*${Number(group[1])}\\b`).test(text))
    throw Error('STANDINGS_GROUP_SEASON_MISMATCH');
  if(!/TSV Feldkirchen\s*(?:\(?01012\)?)?/i.test(text))throw Error('STANDINGS_WRONG_CLUB');

  const rows=[];
  for(const raw of text.replace(/\f/g,'\n').split(/\r?\n/)){
    const line=raw.replace(/\s+/g,' ').trim();
    const match=line.match(/^(\d{1,2})\s+(.+?)\s+\((\d{5})\)\s+(.+)$/);
    if(!match)continue;
    const rank=Number(match[1]);
    const teamName=match[2].replace(/^z\s+/i,'').trim();
    const standingText=match[4].trim();
    if(rank<1||rank>30||!teamName||teamName.length>100||!/\d/.test(standingText))continue;
    if(rows.some(row=>row.rank===rank))throw Error('STANDINGS_DUPLICATE_RANK');
    rows.push({rank,teamName,clubCode:match[3],standingText});
  }
  rows.sort((a,b)=>a.rank-b.rank);
  if(rows.length<4||rows.length>12||!rows.some(row=>row.clubCode==='01012'))
    throw Error('STANDINGS_INCOMPLETE');
  const expected=rows.map((_,index)=>index+1);
  if(rows.some((row,index)=>row.rank!==expected[index]))throw Error('STANDINGS_RANK_GAP');
  return rows;
}

export async function readBtvStandings(groupId,metadata){
  const sourceUrl=officialGroupPdfUrl(groupId);
  const response=await fetch(sourceUrl,{headers:{Accept:'application/pdf','User-Agent':'TSV Feldkirchen public standings sync'},signal:AbortSignal.timeout(23000)});
  if(response.status===403||response.status===429)throw Error('BTV_STANDINGS_RATE_LIMITED');
  if(!response.ok)throw Error('BTV_STANDINGS_HTTP_'+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<1000||bytes.length>10000000||bytes.toString('ascii',0,4)!=='%PDF')throw Error('BTV_STANDINGS_NOT_PDF');
  const dir=mkdtempSync(join(tmpdir(),'btv-standings-'));
  try{
    const file=join(dir,'group.pdf');writeFileSync(file,bytes);
    const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:18000,maxBuffer:1024*1024});
    const rows=parseBtvStandings(text,metadata);
    return {rows,sourceUrl,sourceHash:createHash('sha256').update(bytes).digest('hex')};
  }finally{rmSync(dir,{recursive:true,force:true});}
}
