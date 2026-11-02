import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
const admin = source('src/scripts/admin.ts');
const css = source('src/styles/global.css');

test('visible regular-set tie-break copy is exactly TieBreak and no lengthy explanation',()=>{
  assert.match(admin,/<strong class="encounter-regular-tiebreak__title">TieBreak<\/strong>/);
  assert.doesNotMatch(admin, /Entschieden · Korrektur über Minus möglich/);
  assert.doesNotMatch(admin, /Ab 7 Punkten mit 2 Punkten Abstand beendet/);
  assert.match(admin, /aria-label="TieBreak Satz \$\{setIndex \+ 1\}"/);
});
test('tie-break +/- is one shared full-width editing panel below all three set cells',()=>{
  assert.match(admin, /const tiebreakPanels = \[0, 1\]\.map\(tiebreakStepper\)\.filter\(Boolean\)\.join\(''\)/);
  assert.match(admin, /\$\{tiebreakPanels \? `<div class="encounter-tiebreaks">\$\{tiebreakPanels\}<\/div>` : ''\}/);
  assert.match(admin, /class="encounter-tiebreak-counter"/);
  assert.match(admin, /\$\{button\(-1\)\}<strong aria-live="off">\$\{value\}<\/strong>\$\{button\(1\)\}/);
  assert.match(admin, /data-enc-tb-step="\$\{setIndex\}"/);
  assert.match(admin, /await persistSetScore\(index, score, undefined, points\)/);
  assert.match(admin, /adjustRegularTiebreak\(prior, side, delta\)/);
});
test('set scoring retains independent accessible above-and-below controls and compact title',()=>{
  assert.match(admin, /\$\{button\(1\)\}<strong>\$\{digit\}<\/strong>\$\{button\(-1\)\}/);
  assert.match(admin, /data-enc-step="\$\{setIndex\}"/);
  assert.match(admin, /data-enc-set="\$\{index\}"/);
  assert.match(admin, /class="encounter-set-button__result"/);
  assert.match(css, /#panel-matches \.encounter-set-cell \.encounter-set-button\{/);
  assert.match(css, /min-height:35px/);
  assert.match(css, /#panel-matches \.encounter-set-stepper__control\{/);
  assert.match(css, /min-height:36px/);
  assert.match(css, /#panel-matches \.encounter-result-row\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:420px\)/);
});
