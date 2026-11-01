import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const admin = read('src/scripts/admin.ts');
const page = read('src/pages/admin/index.astro');
const css = read('src/styles/global.css');

function options(name) {
  const block = admin.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\] as const;'))?.[1];
  assert.ok(block, 'Missing available results: ' + name);
  return [...block.matchAll(/'([0-9]+:[0-9]+)'/g)].map((item) => item[1]);
}

test('first and second set use only the 14 given score choices in given order', () => {
  const expected = ['6:0','0:6','6:1','1:6','6:2','2:6','6:3','3:6','6:4','4:6','7:5','5:7','7:6','6:7'];
  assert.deepEqual(options('regularSetScores'), expected);
  assert.match(admin, /setIndex === 2 \? matchTieBreakScores : regularSetScores/);
});

test('third set is a match tiebreak with all 26 requested choices', () => {
  const expected = ['10:0','0:10','10:1','1:10','10:2','2:10','10:3','3:10','10:4','4:10','10:5','5:10','10:6','6:10','10:7','7:10','10:8','8:10','11:9','9:11','12:10','10:12','13:11','11:13','14:12','12:14'];
  assert.deepEqual(options('matchTieBreakScores'), expected);
});

test('encounter has three buttons rather than an editable result text field', () => {
  assert.match(admin, /class="encounter-set-grid"/);
  assert.match(admin, /data-enc-set="\$\{index\}"/);
  assert.match(admin, /\['1\. Satz', '2\. Satz', '3\. Satz'\]/);
  assert.match(admin, /type="hidden" data-enc-result/);
  assert.doesNotMatch(admin, /<input data-enc-result /);
  assert.match(admin, /data-enc-live/);
  assert.doesNotMatch(admin, /data-enc-winner="tsv"/);
  assert.doesNotMatch(admin, /data-enc-winner="opponent"/);
});

test('modal selection persists score through existing private encounter update', () => {
  assert.match(page, /<dialog id="encounter-set-dialog"/);
  assert.match(page, /id="encounter-set-dialog-options"/);
  assert.match(page, /data-set-score-clear/);
  assert.match(page, /data-set-score-close/);
  assert.match(admin, /dialog\.showModal\(\)/);
  assert.match(admin, /if \(await updateEncounter\(encounterId, patch\)\)/);
  assert.match(admin, /await refreshChangedEncounter\(encounterId, normalized\.complete/);
  assert.match(admin, /if \(!score && next\.slice\(setIndex \+ 1\)\.some\(Boolean\)/);
  assert.match(admin, /window\.confirm\('Wenn du diesen Satz löschst/);
  assert.match(admin, /dialog\.oncancel/);
});

test('set buttons and dialog stay usable on small screens and with a keyboard', () => {
  assert.match(css, /\.encounter-set-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.encounter-set-dialog::backdrop/);
  assert.match(css, /\.encounter-set-button:focus-visible/);
  assert.match(css, /\.encounter-set-dialog__options\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(page, /aria-labelledby="encounter-set-dialog-title"/);
});
