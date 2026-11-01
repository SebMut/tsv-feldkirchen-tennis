import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const publicScript=read('src/scripts/public.ts');
const admin=read('src/scripts/admin.ts');
const page=read('src/pages/admin/index.astro');
const sync=read('scripts/sync-btv.mjs');
const workflow=read('.github/workflows/btv-club-sync.yml');

test('official match values outrank any live or finished ticker result',()=>{
  assert.doesNotMatch(publicScript,/status === 'scheduled' \? officialBtvScore\(match\) : null/);
  assert.match(publicScript,/const official = officialBtvScore\(match\);/);
  assert.match(publicScript,/const home = official\?\.home \?\? state\?\.home_score \?\? 0/);
  assert.match(publicScript,/const away = official\?\.away \?\? state\?\.away_score \?\? 0/);
  assert.match(publicScript,/const officialScore = officialBtvScore\(match\);/);
  assert.match(publicScript,/const homeScore = officialScore\?\.home \?\? liveState\?\.home_score \?\? 0/);
  assert.match(publicScript,/const awayScore = officialScore\?\.away \?\? liveState\?\.away_score \?\? 0/);
  assert.match(publicScript,/const homeScore = official\?\.home \?\? Number\(state\?\.home_score \?\? 0\)/);
  assert.match(publicScript,/const awayScore = official\?\.away \?\? Number\(state\?\.away_score \?\? 0\)/);
  assert.match(publicScript,/const homeScore = official\?\.home \?\? state\?\.home_score \?\? 0/);
});

test('official status has priority in both ticker view and match detail',()=>{
  assert.match(publicScript,/official \? '<span class="status-pill btv-official">Offizielles BTV-Ergebnis<\/span>'/);
  assert.match(publicScript,/offici(?:al|alScore) \? 'Offizielles BTV-Ergebnis'/);
  assert.match(publicScript,/BTV-Ergebnis bestätigt/);
  assert.match(publicScript,/Offizielles BTV-Endergebnis/);
  assert.match(publicScript,/Offizielle Wertung hat Vorrang/);
  assert.match(publicScript,/Liveticker-Einträge bleiben als Verlauf erhalten/);
  assert.match(publicScript,/if \(home === 0 && away === 0\) return null/);
});

test('verified BTV final result is updated without mutating any live ticker data',()=>{
  assert.match(sync,/btv_result_text: officialScore\(fixture\.score\)/);
  assert.match(sync,/officialUpdates = \[\]/);
  assert.match(sync,/verified && matched\.btv_result_text !== verified/);
  assert.match(sync,/officialUpdates\.push\(\{ id: matched\.id/);
  assert.match(sync,/for \(const update of officialUpdates\)/);
  assert.match(sync,/db\.from\('matches'\)\.update\(\{/);
  assert.match(sync,/btv_result_text: update\.score/);
  assert.doesNotMatch(sync,/\.from\('match_encounters'\)\.update\(/);
  assert.doesNotMatch(sync,/\.from\('match_live_state'\)\.update\(/);
  assert.doesNotMatch(sync,/\.from\('live_ticker_entries'\)\.update\(/);
  assert.match(sync,/if \(verified && matched/);
});

test('super admin can edit source URL by team and season, with official HTTPS host restrictions',()=>{
  assert.match(page,/<section id="panel-btv-import" class="admin-panel" data-super-only>/);
  assert.match(page,/id="btv-source-season"/);
  assert.match(page,/id="btv-source-list"/);
  assert.match(page,/Offizielle Ergebnisse haben immer Vorrang/);
  assert.match(admin,/function initBtvSourceRegistry\(\)/);
  assert.match(admin,/function verifiedBtvSourceUrl\(raw: string\)/);
  assert.match(admin,/\['btv\.de', 'www\.btv\.de', 'btv\.liga\.nu'\]/);
  assert.match(admin,/data-btv-source-save/);
  assert.match(admin,/supabase\.from\('team_seasons'\)[\s\S]{0,120}\.update\(\{ btv_url: validated \}\)/);
  assert.match(admin,/initBtvSourceRegistry\(\);/);
  assert.match(page,/Ein Link allein aktiviert noch keinen Import/);
});

test('existing six hour cron is truthfully documented as conditional, not silently active',()=>{
  assert.match(workflow,/cron: '17 \*\/6 \* \* \*'/);
  assert.match(workflow,/vars\.BTV_IMPORT_ENABLED == 'true'/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(page,/nur wenn die Importfreigabe aktiviert ist/);
});
