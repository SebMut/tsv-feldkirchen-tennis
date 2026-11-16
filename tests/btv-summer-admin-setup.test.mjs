import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leagueSeasonFromSetting, sourceForYear } from '../scripts/btv-schedule.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('BTV league season ID comes from the public admin setting btv_league_seasons', () => {
  assert.equal(leagueSeasonFromSetting({ 2027: '12345' }, 2027), '12345');
  assert.equal(leagueSeasonFromSetting({ '2027': 18999 }, 2027), '18999');
  assert.equal(leagueSeasonFromSetting({ 2027: '12345' }, 2028), null);
  assert.equal(leagueSeasonFromSetting({ 2027: 'abc' }, 2027), null);
  assert.equal(leagueSeasonFromSetting([], 2027), null);
  assert.equal(leagueSeasonFromSetting(null, 2027), null);
  const url = new URL(sourceForYear(2027, '12345'));
  assert.equal(url.searchParams.get('season'), '12345');
  assert.equal(url.searchParams.get('club'), '23391');
  assert.throws(() => sourceForYear(2027, null), /not verified\/configured/);
  assert.match(read('scripts/btv-schedule.mjs'), /key=eq\.btv_league_seasons/);
  assert.doesNotMatch(read('scripts/btv-schedule.mjs'), /sb_secret_|SUPABASE_SECRET_KEY/);
});

test('summer check is optional until ID, season and teams exist', () => {
  const sync = read('scripts/sync-btv.mjs');
  assert.match(sync, /BTV_SUMMER_OPTIONAL === 'true'/);
  assert.match(sync, /noch keine BTV-Saison-ID im Admin-Bereich hinterlegt/);
  assert.match(sync, /noch keine Mannschaften im Admin-Bereich gemeldet/);
  assert.match(sync, /Saison ist in der Datenbank nicht angelegt/);
});

test('daily workflow checks the current summer year after winter, independently', () => {
  const wf = read('.github/workflows/btv-club-sync.yml');
  assert.match(wf, /BTV_SEASON_CODE="sommer-\$\(TZ=Europe\/Berlin date \+%Y\)" node scripts\/sync-btv\.mjs --apply/);
  assert.match(wf, /BTV_SUMMER_OPTIONAL: 'true'/);
  assert.ok(wf.indexOf('BTV_SEASON_CODE: winter-2026-2027') < wf.indexOf('sommer-$(TZ=Europe/Berlin date +%Y)'));
  assert.match(wf, /if: \$\{\{ !cancelled\(\) \}\}/);
});
