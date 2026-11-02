import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const modalCss = source('src/styles/live-flashscore.css');
const tvCss = source('src/styles/tv-live-ticker.css');
const browser = source('scripts/tv-ticker-browser-qa.mjs');

test('TV name and set-score columns use one header and exactly two shared rows', () => {
  assert.match(tvCss, /--tv-set-head:22px/);
  assert.match(tvCss, /--tv-set-player:30px/);
  assert.match(tvCss, /\.tv-ticker__players::before\s*\{[\s\S]*?grid-row:1/);
  assert.match(tvCss, /\.tv-ticker__players>div:first-of-type\{grid-row:2\}/);
  assert.match(tvCss, /\.tv-ticker__players>div:last-of-type\{grid-row:3\}/);
  assert.match(tvCss, /\.tv-ticker__set\{\s*grid-template-rows:var\(--tv-set-head\) repeat\(2,var\(--tv-set-player\)\)/);
  assert.match(tvCss, /\.tv-ticker__game-body\{--tv-set-head:16px;--tv-set-player:24px\}/);
  assert.match(browser, /await assertAlignedScoreRows\('1920px TV'\)/);
  assert.match(browser, /await assertAlignedScoreRows\('390px phone'\)/);
  assert.match(browser, /await assertAlignedScoreRows\('320px phone'\)/);
});
test('Spieltag modal uses full-width aligned separators and identical grid rows', () => {
  assert.match(modalCss, /--live-score-header:30px/);
  assert.match(modalCss, /--live-score-player:44px/);
  assert.match(modalCss, /\.ticker-running-encounter__line::before,/);
  assert.match(modalCss, /\.ticker-running-encounter__line::after/);
  assert.match(modalCss, /top:calc\(var\(--live-score-header\) \+ var\(--live-score-player\)\)/);
  assert.match(modalCss, /\.ticker-running-encounter__result>strong,\s*\.live-match-modal__body \.ticker-running-encounter__set\{/);
  assert.match(browser, /Spieltag live modal: all name separators align with scores and tiebreaks/);
  assert.match(browser, /for\(const width of \[1366,390,320\]\)/);
  assert.match(browser, /ticker-set-tiebreak/);
});
