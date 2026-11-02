import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('src/pages/admin/index.astro');
const admin=read('src/scripts/admin.ts');
const publicJs=read('src/scripts/public.ts');
const migration=read('supabase/migrations/20261102183500_winter_btv_hourly_monitor.sql');
const route=read('supabase/migrations/20261102180500_winter_2026_venue_route_bc_attaching.sql');
const audit=read('scripts/audit-winter-2026.mjs');
const flow=read('.github/workflows/btv-club-sync.yml');

test('public winter BTV audit checks all 15 actual fixtures and group assignments',()=>{
  assert.match(audit,/getWinterSchedule\(\)/);
  assert.match(audit,/assert\.equal\(official\.fixtures\.length,15\)/);
  assert.match(audit,/assert\.equal\(matched\.size,15\)/);
  assert.match(audit,/fixture\.isHome/);
  assert.match(audit,/fixture\.startsAt/);
  assert.match(audit,/new URL\(game\.external_url\)\.searchParams\.get\('groupid'\)/);
  assert.match(flow,/node scripts\/audit-winter-2026\.mjs/);
});

test('single missing route uses verified club address with explicit hall caution',()=>{
  assert.match(route,/venue_address = 'Am Sportplatz 3, 85356 Freising-Attaching'/);
  assert.match(route,/and m\.is_home=false/);
  assert.match(route,/Hallenadresse|Tennishalle/);
  assert.match(publicJs,/match\.notes\.includes\('\[Routing\]'\)/);
  assert.match(publicJs,/match-venue__warning/);
});

test('hourly monitor and SuperAdmin panel expose stale and inconsistent BTV imports',()=>{
  assert.match(migration,/cron\.schedule\('tsv-winter-btv-health-hourly','22 \* \* \* \*'/);
  assert.match(migration,/interval '24 hours'/);
  assert.match(migration,/interval '8 hours'/);
  assert.match(migration,/from public\.btv_import_runs/);
  assert.match(page,/letzte[nr]? Datenbank-Abgleich|Datenbank wird stündlich/);
  assert.match(admin,/async function refreshWinterBtvHealth\(\)/);
  assert.match(admin,/supabase\.from\('btv_import_runs'\)/);
  assert.match(admin,/state\.isSuper/);
  assert.match(admin,/name === 'btv-import'/);
  assert.doesNotMatch(page,/BTV-Spielplan 2026 \(PDF\) öffnen/);
});
