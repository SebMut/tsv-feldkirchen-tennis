// TSV Feldkirchen — BTV MeetingReportFOP 2026 parser.
// Only parse rows explicitly present in the official report. No roster inference.
// This module is pure and MUST NOT print any player names or identity numbers.
const scoreRegex=/\b(\d{1,2}):(\d{1,2})\b/g;
const playerId=/\b\d{8}\b/g;
const singleRow=/^\s*(?<position>\d{1,2})\s+(?<homeRank>\d{1,2})\s+(?<homeId>\d{8})\s+(?<homeRaw>.+?)\s{2,}(?<awayRank>\d{1,2})\s+(?<awayId>\d{8})\s+(?<awayRaw>.+?)\s{2,}(?<set1>\d{1,2}:\d{1,2})(?:\s+(?<set2>\d{1,2}:\d{1,2}))?(?:\s+(?<set3>\d{1,2}:\d{1,2}))?/d;

function playerName(raw){
  const name=String(raw||'')
    .replace(/\s+\b(?:GER|AUT|CRO|SUI|FRA|ITA|POL|CZE|UKR|USA|TUR)\b(?=\s|$)/g,'')
    .replace(/\s*\(LK\d{1,2}(?:,\d)?\)\s*/gi,' ')
    .replace(/\s*\(w\.o\.\)\s*/gi,' ')
    .replace(/\s*\(\d{1,2}\)\s*$/,'')
    .replace(/\s+/g,' ').trim();
  if(name.length<4||name.length>100||!name.includes(',')||/\d{5,}/.test(name))
    return null;
  return name;
}
function sets(raw){
  return [...String(raw).matchAll(scoreRegex)].slice(0,3).map(m=>({
    home:Number(m[1]),away:Number(m[2])
  }));
}
function winnerOf(setsList){
  if(setsList.length<2||setsList.length>3)return null;
  let h=0,a=0;
  for(const s of setsList){
    if(s.home===s.away||s.home>99||s.away>99)return null;
    if(s.home>s.away)h++;else a++;
  }
  if(h===a)return null;
  return h>a?'home':'away';
}
const rowWithScores=line=>[...line.matchAll(scoreRegex)].length>=2;
const sum=(xs,key)=>xs.filter(x=>x.winner_side===key).length;
const exactNameRe=/^[^\d\n]{1,100},\s*[^\d\n,]{1,100}$/u;

export function parseOfficialMeetingText(text,{expectedHomePoints,expectedAwayPoints}={}){
  if(typeof text!=='string'||text.length<150||text.length>500000)throw Error('REPORT_TEXT_INVALID');
  const lines=text.split(/\r?\n/);
  const idxSingle=lines.findIndex(x=>/^\s*Einzel\s*$/i.test(x));
  const idxDouble=lines.findIndex((x,i)=>i>idxSingle&&/^\s*Doppel\s*$/i.test(x));
  if(idxSingle<0||idxDouble<0||idxSingle>=idxDouble)throw Error('REPORT_SECTIONS_MISSING');
  const singles=[],doubles=[],errors=[];
  let layout=null;
  for(const line of lines.slice(idxSingle+1,idxDouble)){
    const m=singleRow.exec(line);
    if(!m)continue;
    const {position,homeRaw,awayRaw}=m.groups;
    const homeName=playerName(homeRaw),awayName=playerName(awayRaw);
    const scores=sets([m.groups.set1,m.groups.set2,m.groups.set3].filter(Boolean).join(' '));
    const winner=winnerOf(scores);
    if(!homeName||!awayName||!winner||position==='0'){
      errors.push('SINGLE_UNPARSED');continue;
    }
    const pos=Number(position);
    if(singles.some(x=>x.position===pos)){errors.push('DUPLICATE_SINGLE');continue;}
    const idx=m.indices.groups;
    layout={homeNameStart:idx.homeRaw[0],awayRankStart:idx.awayRank[0],
      awayNameStart:idx.awayRaw[0],setStart:idx.set1[0]};
    singles.push({discipline:'single',position:pos,
      home_participants:[{name:homeName}],away_participants:[{name:awayName}],
      set_results:scores,winner_side:winner,special_status:null,
      result_text:scores.map(s=>s.home+':'+s.away).join(' '),
      source_section:'BTV MeetingReportFOP Einzel',verification_status:'verified'});
  }
  if(!singles.length||!layout)errors.push('NO_SINGLES');

  const {homeNameStart=47,awayRankStart=90,awayNameStart=122,setStart=159}=layout||{};
  function namesAt(line){
    const home=playerName(line.slice(homeNameStart,awayRankStart));
    const away=playerName(line.slice(awayNameStart,setStart));
    return {home,away};
  }
  const section=lines.slice(idxDouble+1);
  for(let i=0;i<section.length;i++){
    const line=section[i];
    const scoreParts=sets(line.slice(Math.max(0,setStart-3)));
    const posMatch=line.match(/^\s*(\d{1,2})\s{2,}/);
    if(!posMatch||scoreParts.length<2||!winnerOf(scoreParts))continue;
    const position=Number(posMatch[1]);
    if(position<1||position>6||!rowWithScores(line))continue;
    const before=section[i-1]||'',after=section[i+1]||'';
    const first=namesAt(before),second=namesAt(after);
    if(!first.home||!first.away||!second.home||!second.away){
      errors.push('DOUBLE_PARTICIPANT_UNPARSED');continue;
    }
    if(doubles.some(x=>x.position===position)){errors.push('DUPLICATE_DOUBLE');continue;}
    doubles.push({discipline:'double',position,
      home_participants:[{name:first.home},{name:second.home}],
      away_participants:[{name:first.away},{name:second.away}],
      set_results:scoreParts,winner_side:winnerOf(scoreParts),special_status:null,
      result_text:scoreParts.map(s=>s.home+':'+s.away).join(' '),
      source_section:'BTV MeetingReportFOP Doppel',verification_status:'verified'});
  }
  const all=[...singles,...doubles];
  const total=Number(expectedHomePoints)+Number(expectedAwayPoints);
  if(Number.isInteger(total)&&total>0 && all.length!==total)errors.push('RUBBER_COUNT_MISMATCH');
  if(expectedHomePoints!=null && expectedAwayPoints!=null &&
    (sum(all,'home')!==Number(expectedHomePoints)||sum(all,'away')!==Number(expectedAwayPoints)))
    errors.push('RUBBER_WINNERS_DISAGREE_WITH_REPORT');
  for(const row of all){
    if(row.discipline==='double'&&(row.home_participants.length!==2||row.away_participants.length!==2))
      errors.push('DOUBLE_LINEUP_INVALID');
    if(row.discipline==='single'&&(row.home_participants.length!==1||row.away_participants.length!==1))
      errors.push('SINGLE_LINEUP_INVALID');
    for(const p of [...row.home_participants,...row.away_participants])
      if(!exactNameRe.test(p.name))errors.push('PLAYER_NAME_FORMAT_UNVERIFIED');
  }
  const unique=new Set(all.map(x=>x.discipline+':'+x.position));
  if(unique.size!==all.length)errors.push('DUPLICATE_RUBBER');
  if(all.length===0)errors.push('NO_VERIFIABLE_RUBBERS');
  return {singles,doubles,total:all.length,
    verification_status:errors.length?'partial':'verified',errors:[...new Set(errors)]};
}
