import { getClubSchedule } from './btv-schedule.mjs';
const year=Number(process.env.BTV_SEASON_YEAR||2026);
const data=await getClubSchedule(year);
const counts=new Map();
for(const fixture of data.fixtures) counts.set(fixture.slug,(counts.get(fixture.slug)||0)+1);
console.log('BTV schedule valid:',JSON.stringify({
 year,pages:data.pages,rows:data.rawRows,recognized:data.fixtures.length,unmatched:data.unrecognized.length,teams:counts.size
}));
console.log('Teams:',[...counts].sort((a,b)=>a[0].localeCompare(b[0])).map(x=>x.join(':')).join(', '));
console.log('First fixtures:',JSON.stringify(data.fixtures.slice(0,4).map(f=>({slug:f.slug,date:f.date,opponent:f.opponent,home:f.isHome,score:f.score}))));
if(counts.size!==20) throw new Error('Expected 20 teams, found '+counts.size+'. No import until checked.');
