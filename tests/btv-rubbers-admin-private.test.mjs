import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../src/scripts/official-reports-admin.ts',import.meta.url),'utf8');
const admin=readFileSync(new URL('../src/scripts/admin.ts',import.meta.url),'utf8');
const page=readFileSync(new URL('../src/pages/admin/index.astro',import.meta.url),'utf8');

test('detailed BTV rubbers are fetched only by authenticated SuperAdmin panel',()=>{
  assert.match(admin,/if \(state\.isSuper\) \{\s*initManualResultsPanel\(\);\s*initOfficialReportsPanel\(\)/);
  assert.match(admin,/if \(name === 'official-rubbers' && !state\.isSuper\) return/);
  assert.match(page,/data-panel="official-rubbers" data-super-only/);
  assert.match(page,/id="panel-official-rubbers" class="admin-panel" data-super-only/);
  assert.match(script,/from\('official_report_rubbers'\)/);
  assert.match(script,/from\('official_meeting_reports'\)/);
  assert.doesNotMatch(script,/localStorage|sessionStorage|upload|download|writeFileSync|console\.log/);
});
test('only 2026 matches with verified BTV report may show player names',()=>{
  assert.match(script,/eq\('season_code','sommer-2026'\)/);
  assert.match(script,/report\.verification_status!=='verified'/);
  assert.match(script,/Fehlende|fehlt noch ein vollständig verifizierter/);
  assert.match(script,/r\.home_participants/);
  assert.match(script,/r\.away_participants/);
  assert.match(script,/r\.set_results/);
  assert.match(script,/r\.special_status==='walkover'/);
  assert.match(script,/textContent/);
  assert.doesNotMatch(script,/\.innerHTML|renderToString/);
});
test('all missing reports remain countable per team and across full season',()=>{
  assert.match(script,/reports\.get\(x\.match_id\)\?\.verification_status==='verified'/);
  assert.match(script,/matches\.length-verified/);
  assert.match(script,/btv-rubbers-missing/);
  assert.match(page,/Nur Begegnungen mit fehlendem Spielbericht/);
});
