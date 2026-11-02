// Read-only Winter 2026/27 audit: independently compare 15 public BTV PDF fixtures
// against published Supabase rows. No service key, no writes, no player data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getWinterSchedule, VERIFIED_GROUPS } from './btv-winter-schedule.mjs';
import { normalizedName } from './btv-schedule.mjs';

const clientSource = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
const publicKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || clientSource.match(/sb_publishable_[A-Za-z0-9_]+/)?.[0];
if (!publicKey) throw Error('Public Supabase key unavailable; read-only audit cannot run');
const origin = 'https://eaurnufdochjapfzqwvm.supabase.co/rest/v1/';
async function rows(table, params) {
  const url = new URL(table, origin);
  Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));
  const res = await fetch(url, {headers:{apikey:publicKey,'user-agent':'TSV-Winter-Audit/1.0'},
    signal:AbortSignal.timeout(16000)});
  if(!res.ok)throw Error('Supabase public read '+table+' HTTP '+res.status+': '+(await res.text()).slice(0,200));
  return res.json();
}
const official = await getWinterSchedule();
assert.equal(official.fixtures.length,15);
const seasons=await rows('seasons',{code:'eq.winter-2026-2027',select:'id,code'});
assert.equal(seasons.length,1,'Winter season must be unique');
const [teams,seasonsTeams] = await Promise.all([
  rows('teams',{select:'id,slug'}),
  rows('team_seasons',{season_id:'eq.'+seasons[0].id,select:'id,team_id,btv_url,is_published'}),
]);
const byTeam=new Map(teams.map(t=>[t.id,t.slug]));
const bySeason=new Map(seasonsTeams.map(t=>[t.id,{...t,slug:byTeam.get(t.team_id)}]));
assert.equal(bySeason.size,3,'Three distinct winter team seasons are expected');
for(const season of bySeason.values()){
  const config=VERIFIED_GROUPS.find(g=>g.slug===season.slug);
  assert.ok(config,'Unknown winter team '+season.slug);
  assert.equal(new URL(season.btv_url).searchParams.get('groupid'),String(config.group),
    'Wrong verified BTV link for '+season.slug);
  assert.equal(season.is_published,true,'Winter team is not published');
}
const dbMatches=await rows('matches',{team_season_id:'in.('+[...bySeason.keys()].join(',')+')',
  select:'id,team_season_id,opponent,is_home,starts_at,venue_name,venue_address,external_url,btv_result_text,is_published'});
assert.equal(dbMatches.length,15,'15 winter matches expected');
const key=(slug,home,opponent)=>slug+'|'+(home?'H':'A')+'|'+normalizedName(opponent);
const matched=new Set();
const errors=[],warnings=[];
for(const fixture of official.fixtures){
  const found=dbMatches.filter(m=> {
    const team=bySeason.get(m.team_season_id);
    return team && key(team.slug,m.is_home,m.opponent)===key(fixture.slug,fixture.isHome,fixture.opponent);
  });
  if(found.length!==1){errors.push(fixture.slug+' / '+fixture.opponent+': '+found.length+' DB fixtures');continue;}
  const game=found[0];
  matched.add(game.id);
  if(new Date(game.starts_at).toISOString()!==fixture.startsAt)
    errors.push(fixture.slug+' / '+fixture.opponent+': DB='+game.starts_at+' BTV='+fixture.startsAt);
  if(!game.venue_name?.trim())warnings.push('Venue missing: '+fixture.slug+' / '+fixture.opponent);
  if(!game.venue_address?.trim())warnings.push('Route address missing: '+fixture.slug+' / '+fixture.opponent);
  if(!game.is_published)errors.push('Unpublished fixture: '+fixture.slug+' / '+fixture.opponent);
  const config=VERIFIED_GROUPS.find(g=>g.slug===fixture.slug);
  if(new URL(game.external_url).searchParams.get('groupid')!==String(config.group))
    errors.push('Wrong fixture BTV group: '+fixture.slug+' / '+fixture.opponent);
}
if(matched.size!==15)errors.push('Only '+matched.size+' / 15 matched official fixtures');
const summary={season:'winter-2026-2027',checked_at:new Date().toISOString(),
  source:'3 verified official BTV group PDFs',verified_teams:bySeason.size,
  fixtures:dbMatches.length,matched:matched.size,errors,warnings};
console.log('WINTER AUDIT '+JSON.stringify(summary,null,2));
if(errors.length)process.exitCode=1;
