import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const code=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');
const helper=readFileSync(new URL('../src/lib/btv-group-url.ts',import.meta.url),'utf8');

test('automatic BTV registry is the only source for team-specific BTV external links',()=>{
  assert.match(code,/from\('verified_team_btv_links'\)\.select\('team_season_id,btv_url'\)/);
  assert.match(code,/officialBtvTeamDestination\(verifiedBtv\.get\(ts\.id\) === ts\.btv_url \? ts\.btv_url : null\)/);
  assert.match(code,/officialBtvTeamDestination\(verifiedBtv\.get\(current\?\.id\) === current\?\.btv_url \? current\?\.btv_url : null\)/);
  assert.match(helper,/^export function officialBtvGroupUrl/m);
  assert.match(helper,/groupid/);
});

test('unverified tennis.de portrait never overrides or duplicates a verified BTV group link',()=>{
  assert.match(code,/return portrait \? \{ href: portrait, isDirect: true \} : null;/);
  assert.match(code,/tennisDeTarget \? `<a class="button ghost"/);
  assert.match(code,/current && tennisDeTarget \? `<a class="button ghost"/);
  assert.doesNotMatch(code,/#teamview\/23391/);
  assert.doesNotMatch(code,/tennis\.de Team suchen ↗/);
  assert.match(code,/BTV Gruppe ↗/);
});
