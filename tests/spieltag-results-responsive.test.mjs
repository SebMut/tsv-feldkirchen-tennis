import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const css = read('src/styles/global.css');
const ticker = read('src/pages/spieltag/index.astro');
const script = read('src/scripts/public.ts');

const fix = css.slice(css.indexOf('/* Spieltag – lesbare Spielkarten auch in der rechten Ergebnis-Spalte.'));
test('fixtures: the result and upcoming cards stack info above actions instead of compressing it', () => {
  assert.ok(ticker.includes('id="recent-matches"'));
  assert.ok(ticker.includes('id="upcoming-matches"'));
  assert.match(fix, /\.matchday-page--ticker \.match-row\{\s*display:grid;\s*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(fix, /\.matchday-page--ticker \.match-row__main\{[\s\S]*?width:100%/);
  assert.match(fix, /\.matchday-page--ticker \.match-row>\.actions\{[\s\S]*?flex-wrap:wrap/);
  assert.ok(fix.includes('.matchday-page--ticker .match-row>.actions .button'));
});

test('fixture text and venue are readable on white cards instead of white-on-white', () => {
  assert.match(fix, /\.matchday-page--ticker \.match-row__main \.match-meta\{[\s\S]*?overflow-wrap:break-word;\s*word-break:normal/);
  assert.match(fix, /\.matchday-page--ticker \.match-row__main \.match-venue strong\{\s*color:#293e30/);
  assert.match(fix, /\.matchday-page--ticker \.match-row__main \.match-venue small\{\s*color:#65766a/);
  assert.ok(css.indexOf('/* Spieltag – lesbare Spielkarten') > css.indexOf('.matchday-page .match-venue strong{color:#fff}'));
});

test('mobile fixture cards keep controls readable and prevent tiny columns', () => {
  assert.match(fix, /@media\(max-width:480px\)/);
  assert.match(fix, /\.matchday-page--ticker \.match-row>\.actions \.button\{\s*flex:1 1 126px/);
  assert.match(fix, /\.matchday-page--ticker \.match-row>\.actions \.score\{[\s\S]*?white-space:nowrap/);
  assert.match(fix, /\.matchday-page--ticker \.match-row__teamline\{[\s\S]*?flex-wrap:wrap/);
});

test('results, official status, match navigation and route button are retained', () => {
  assert.ok(script.includes('function matchRow('));
  assert.ok(script.includes('matchRouteButton(match)'));
  assert.ok(script.includes('BTV-Ergebnis'));
  assert.ok(script.includes('<span class="score">'));
  assert.ok(script.includes('Spiel öffnen'));
  assert.ok(script.includes('href="${detailUrl}"'));
});
