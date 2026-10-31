import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../src/scripts/manual-results-admin.ts', import.meta.url),'utf8');
const admin = readFileSync(new URL('../src/pages/admin/index.astro', import.meta.url),'utf8');

// Execute the actual pure filter expression from the TypeScript file.
function activeFilter(manualIds, withdrawalIds = new Set(), externalIds = new Set()) {
  const match = script.match(/function isNotYetRecorded\(m: Entry\) \{ return ([^;]+); \}/);
  assert.ok(match, 'unprocessed-match filter must exist');
  const actual = new Function('m','isOfficial','manual','withdrawalFlags','externalReports','return ('+match[1]+');');
  return m => actual(m, row => Boolean(row.btv_result_text?.trim()), new Map([...manualIds].map(id=>[id,true])), new Map([...withdrawalIds].map(id=>[id,true])), new Map([...externalIds].map(id=>[id,true])));
}

test('saved manual withdrawal is absent from outstanding task list', () => {
  const match={match_id:'test-knaben15-unterfoehring',btv_result_text:null};
  const before=activeFilter(new Set());
  const after=activeFilter(new Set([match.match_id]));
  assert.equal(before(match), true, 'fixture without any score must initially appear');
  assert.equal(after(match), false, 'saved withdrawal/manual result must disappear');
});

test('all official result rows are removed from outstanding tasks too', () => {
  const visible = activeFilter(new Set());
  assert.equal(visible({match_id:'btv-score',btv_result_text:'6:3'}),false);
  assert.equal(visible({match_id:'open',btv_result_text:null}),true);
  assert.equal(visible({match_id:'whitespace',btv_result_text:'   '}),true);
});

test('saved scores remain available to correct when filter is unchecked', () => {
  assert.match(script, /\(!openOnly \|\| isNotYetRecorded\(m\)\)/);
  assert.match(script, /manual\.set\(selected\.match_id,\s*data as Manual\)/);
  assert.match(script, /renderList\(\);\s*showStatus\('Nachtrag für /);
  assert.match(script, /selected = null;\s*byId<HTMLFormElement>\('manual-result-form'\)\?\.classList\.add\('hidden'\)/);
  assert.match(admin, /id="manual-results-open-only" type="checkbox" checked/);
  assert.match(admin, /Nur noch nicht erfasste Spiele/);
});

test('confirmation checkbox is required and saving is a separate action', () => {
  assert.match(admin, /id="manual-result-confirm" type="checkbox" required/);
  assert.match(admin, /id="manual-result-save" type="submit"/);
  assert.match(admin, /Erst „Ergebnis manuell speichern“/);
  assert.match(script, /if \(!byId<HTMLInputElement>\('manual-result-confirm'\)\?\.checked\)/);
});

test('a specifically reported withdrawal is no longer an unresolved score task', () => {
  const forstinning = {
    match_id: '6533cb1a-c344-4f4b-a517-1214db28ffa8',
    btv_result_text: null
  };
  assert.equal(activeFilter(new Set())(forstinning), true);
  assert.equal(activeFilter(new Set(), new Set([forstinning.match_id]))(forstinning), false);
  assert.match(script, /from\('match_withdrawal_flags'\)/);
  assert.match(script, /offizielle Prüfung ausstehend|BTV-Bestätigung offen/);
  assert.match(admin, /id="manual-results-withdrawal"/);
});

test('externally documented 2026 result is counted as processed but still marked not official', () => {
  const oberding = {match_id:'30261461-6e38-4835-ad37-06dc9691052a',btv_result_text:null};
  assert.equal(activeFilter(new Set())(oberding), true);
  assert.equal(activeFilter(new Set(),new Set(),new Set([oberding.match_id]))(oberding), false);
  assert.match(script, /from\('external_match_result_reports'\)/);
  assert.match(script, /BTV-Bestätigung offen/);
  assert.match(script, /Externer Ergebnisnachweis/);
  assert.match(script, /if \(save\) save.disabled = isOfficial\(selected\) \|\| !!external/);
});
