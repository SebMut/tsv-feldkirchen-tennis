import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VERIFIED_GROUPS, WINTER_CODE, WINTER_YEAR, winterGroupUrl, normalizeWinterName,
} from '../scripts/btv-winter-schedule.mjs';

test('only three verified TSV Feldkirchen winter 2026/27 groups are monitored', () => {
  assert.equal(WINTER_CODE, 'winter-2026-2027');
  assert.equal(WINTER_YEAR, 2027);
  assert.deepEqual(VERIFIED_GROUPS.map(x=>x.slug), ['herren','herren-ii','herren-50']);
  assert.deepEqual(VERIFIED_GROUPS.map(x=>x.group), [2257673,2257681,2257828]);
  assert.equal(new Set(VERIFIED_GROUPS.map(x=>x.group)).size, 3);
});

test('group URLs use public verified PDF source and reject unknown competition', () => {
  for (const item of VERIFIED_GROUPS) {
    const url = new URL(winterGroupUrl(item.group));
    assert.equal(url.origin, 'https://btv.liga.nu');
    assert.equal(url.searchParams.get('group'), String(item.group));
    assert.equal(url.searchParams.get('dokument'), 'ScheduleReportFOP');
  }
  assert.throws(()=>winterGroupUrl(12345),/Unknown \/ unverified/);
  assert.equal(normalizeWinterName('  TC   Muster  '),'tc muster');
});

test('six-hour sync has independent season handling and preserves hall locations', () => {
  const script = readFileSync(new URL('../scripts/sync-btv.mjs',import.meta.url),'utf8');
  assert.match(script,/BTV_SEASON_CODE === WINTER_CODE/);
  assert.match(script,/\.eq\('code', seasonCode\)/);
  assert.match(script,/isWinter \|\| fixture\.four \? '4_2' : '6_3'/);
  assert.match(script,/season_code: seasonCode/);
  assert.doesNotMatch(script,/venue_name:\s*fixture\./);
  assert.doesNotMatch(script,/venue_address:\s*fixture\./);
});

test('schedule checks every six hours, with no secret exposure in pull requests', () => {
  const workflow = readFileSync(new URL('../.github/workflows/btv-club-sync.yml',import.meta.url),'utf8');
  assert.match(workflow,/cron: '17 \*\/6 \* \* \*'/);
  assert.match(workflow,/BTV_SEASON_CODE: winter-2026-2027/);
  assert.match(workflow,/vars\.BTV_IMPORT_ENABLED == 'true'/);
  assert.match(workflow,/vars\.BTV_IMPORT_ENABLED != 'true'/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/SUPABASE_SECRET_KEY: \$\{\{ secrets\.BTV_SUPABASE_SECRET_KEY \}\}/);
});
