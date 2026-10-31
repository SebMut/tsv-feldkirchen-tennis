const REPORT_PATH='/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument';

export function normalized(value){
  return String(value||'').normalize('NFKC').toLocaleLowerCase('de-DE')
    .replace(/\([^)]*\)/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}

export function meetingIdsFromLinks(links){
  const found=new Map();
  for(const raw of links){
    let url;
    try{url=new URL(raw,'https://www.btv.de/');}catch{continue;}
    if(url.protocol!=='https:'||!['btv.liga.nu','www.btv.de','btv.de'].includes(url.hostname))continue;
    const direct=url.searchParams.get('meeting');
    const embedded=url.href.match(/[?&]meeting=(\d{6,10})(?:&|$)/)?.[1];
    const id=direct||embedded;
    if(!id||!/^\d{6,10}$/.test(id))continue;
    found.set(Number(id),new URL(REPORT_PATH+'?dokument=MeetingReportFOP&meeting='+id,'https://btv.liga.nu').toString());
  }
  return [...found].sort((a,b)=>a[0]-b[0]).map(([meetingId,reportUrl])=>({meetingId,reportUrl}));
}

export function meetingIdsFromDocuments(documents){
  const links=[];
  for(const document of documents){
    for(const match of String(document||'').matchAll(/(?:meeting(?:%3D|=)|meeting["'\s:,]+)(\d{6,10})/gi)){
      links.push('https://btv.liga.nu'+REPORT_PATH+'?dokument=MeetingReportFOP&meeting='+match[1]);
    }
  }
  return meetingIdsFromLinks(links);
}

export function matchOfficialReport({title,date,score},matches){
  const titleNorm=normalized(title);
  const scoreNorm=String(score||'').replace(/\s+/g,'');
  const reportDay=date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?Date.parse(date+'T12:00:00Z'):null;
  const candidates=matches.filter(m=>{
    if(!titleNorm.includes(normalized(m.opponent)))return false;
    const tsvFirst=titleNorm.indexOf('tsv feldkirchen');
    const opponentAt=titleNorm.indexOf(normalized(m.opponent));
    if(tsvFirst<0||opponentAt<0||((tsvFirst<opponentAt)!==Boolean(m.is_home)))return false;
    if(scoreNorm&&String(m.btv_result_text||'').replace(/\s+/g,'')!==scoreNorm)return false;
    if(reportDay!=null&&Math.abs(Date.parse(m.starts_at)-reportDay)>3*86400000)return false;
    return true;
  });
  return candidates.length===1?candidates[0]:null;
}

export function fiveSearchWays({groupId,club='23391',seasonId,opponentClub=null}){
  const base='https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument';
  return [
    {way:'club_schedule',url:`${base}?dokument=ScheduleReportFOP&club=${club}&season=${seasonId}`},
    {way:'group_page',url:`https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=${groupId}`},
    {way:'opponent_schedule',url:opponentClub?`${base}?dokument=ScheduleReportFOP&club=${opponentClub}&season=${seasonId}`:null},
    {way:'tennis_de',url:'https://www.tennis.de/spielen/spielbetrieb/vereinsspielplan.html?verband=btv&verein=01012'},
    {way:'group_document',url:`${base}?dokument=ScheduleReportFOP&group=${groupId}`},
  ];
}

