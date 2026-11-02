import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261102210000_remove_summer_2026.sql');
const home=read('src/pages/mannschaften/index.astro');
const adminPage=read('src/pages/admin/index.astro');
const admin=read('src/scripts/admin.ts');
const publicJs=read('src/scripts/public.ts');
const sync=read('scripts/sync-btv.mjs');
const workflow=read('.github/workflows/btv-club-sync.yml');
const reports=read('src/scripts/official-reports-admin.ts');

test('Sommer 2026 and only its season-scoped records are removed',()=>{
 assert.match(migration,/WHERE code='sommer-2026' FOR UPDATE/);
 for(const name of ['btv_schedule_changes','btv_fixture_snapshots','btv_import_runs','official_import_issues','official_meeting_reports','official_season_sources','team_seasons','seasons']) {
   assert.ok(migration.includes('DELETE FROM public.'+name),name);
 }
 assert.match(migration,/DELETE FROM public.news n WHERE n.match_id IN/);
 assert.match(migration,/DELETE FROM public.team_seasons WHERE season_id=summer_id/);
 assert.doesNotMatch(migration,/DELETE FROM public.teams\b|DELETE FROM public.players\b|DELETE FROM public.team_memberships\b/);
 assert.match(migration,/Winter 2026\/27 preserved/);
});

test('public and admin selection now starts at Winter 2026/27',()=>{
 assert.doesNotMatch(home,/data-season="sommer-2026"/);
 assert.match(home,/data-season="winter-2026-2027"/);
 assert.doesNotMatch(adminPage,/data-team-season="sommer-2026"/);
 assert.doesNotMatch(adminPage,/data-roster-season="sommer-2026"/);
 assert.match(adminPage,/data-team-season="winter-2026-2027" aria-pressed="true"/);
 assert.match(admin,/let teamSeasonFilterCode = 'winter-2026-2027'/);
 assert.match(admin,/let rosterSeasonFilterCode = 'winter-2026-2027'/);
 assert.doesNotMatch(publicJs,/seasonByCode.get\('sommer-2026'\)/);
 assert.match(admin,/function syncAdminSeasonPills\(\)/);
 assert.match(admin,/syncAdminSeasonPills\(\);/);
 assert.match(admin,/button\.textContent = season\.name/);
 assert.match(admin,/season\.code !== 'sommer-2026'/);
 assert.match(publicJs,/const publishedSeasons = reference.seasons.filter/);
 assert.match(home,/data-season="sommer-2027"/);
});

test('2026 fixture import is disabled and official reports use current season',()=>{
 assert.match(sync,/Sommer 2026 wurde vollständig entfernt/);
 assert.doesNotMatch(sync,/BTV_SEASON_YEAR \|\| 2026/);
 assert.doesNotMatch(workflow,/inputs.season_year \|\| '2026'/);
 assert.match(workflow,/BTV_SEASON_CODE: winter-2026-2027/);
 assert.match(reports,/eq\('is_current',true\)/);
 assert.match(reports,/eq\('season_code',seasonCode\)/);
 assert.doesNotMatch(reports,/eq\('season_code','sommer-2026'\)/);
});
