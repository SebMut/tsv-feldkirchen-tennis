// Verify public BTV competition results without storing player information.
// This job is read-only and accepts only known TSV seasons and teams.
import { getClubSchedule } from './btv-schedule.mjs';
import { getWinterSchedule } from './btv-winter-schedule.mjs';

const sources = [
  { code:'sommer-2026', expected:120, get:()=>getClubSchedule(2026) },
  { code:'winter-2026-2027', expected:15, get:getWinterSchedule },
];
for (const source of sources) {
  const {fixtures} = await source.get();
  if (fixtures.length !== source.expected) throw Error('SOURCE_FIXTURE_COUNT_UNEXPECTED:' + source.code);
  const teamCounts = new Map();
  let scores=0, finalPast=0;
  for (const f of fixtures) {
    const score = f.score?.replace(/\s+/g,'') || null;
    if (score && !/^\d{1,2}:\d{1,2}$/.test(score)) throw Error('UNEXPECTED_SCORE_FORMAT');
    const item = teamCounts.get(f.slug) || {all:0,played:0,scored:0};
    item.all++;
    if (new Date(f.startsAt).getTime() < Date.now()) { item.played++; finalPast++; }
    if (score) {item.scored++;scores++;}
    teamCounts.set(f.slug,item);
  }
  console.log('BTV_RESULTS_SEASON=' + source.code);
  console.log('BTV_RESULTS_FIXTURES=' + fixtures.length);
  console.log('BTV_RESULTS_PAST_FIXTURES=' + finalPast);
  console.log('BTV_RESULTS_PUBLISHED=' + scores);
  console.log('BTV_RESULTS_TEAMS=' + teamCounts.size);
  for (const [slug,c] of [...teamCounts].sort((a,b)=>a[0].localeCompare(b[0]))) {
    console.log('BTV_RESULTS_TEAM=' + slug + ': ' + c.scored + '/' + c.played + ' previous games');
  }
  if (source.code==='winter-2026-2027') {
    for (const f of fixtures.filter(x=>x.score && new Date(x.startsAt)<Date.now())) {
      console.log('BTV_WINTER_FINAL=' + f.slug + ' | ' + f.date + ' | ' +
        (f.isHome?'home':'away') + ' | '+f.opponent+' | '+f.score);
    }
  }
}
console.log('BTV_RESULT_AUDIT=READ_ONLY_SUCCESS');
