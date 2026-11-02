import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeSetResult, homeAwaySetScore } from '../src/lib/tennis-score.mjs';

const source = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = source('src/pages/spieltag/live-ticker/index.astro');
const client = source('src/scripts/tv-live-ticker.ts');
const styles = source('src/styles/tv-live-ticker.css');
const overview = source('src/pages/spieltag/index.astro');

test('standalone TV route uses screenshot-inspired live heading, real TSV logo and fullscreen action', () => {
  assert.match(page, /Jetzt live dabei/);
  assert.match(page, /LIVE · TSV FELDKIRCHEN TENNIS/);
  assert.match(page, /mediaUrl\('branding\/tennis-logo.png'\)/);
  assert.match(page, /id="tv-ticker-board"/);
  assert.match(page, /id="tv-ticker-count"/);
  assert.match(page, /id="tv-ticker-fullscreen"/);
  assert.match(overview, /href="\/spieltag\/live-ticker\/"/);
  assert.ok(!page.includes('MainLayout'), 'TV fullscreen must not show site header/footer/dock');
});

test('TV only reads real published matches, active live states and original encounter data', () => {
  assert.match(client, /from\('match_live_state'\)/);
  assert.match(client, /\.eq\('status', 'live'\)/);
  assert.match(client, /from\('matches'\)/);
  assert.match(client, /\.eq\('is_published', true\)/);
  assert.match(client, /from\('match_encounters'\)/);
  assert.match(client, /from\('team_seasons'\)/);
  assert.match(client, /from\('teams'\)/);
  assert.match(client, /match\.is_home \? club : String\(match\.opponent/);
  assert.match(client, /match\.is_home \? String\(match\.opponent/);
  assert.match(client, /Number\(state\.home_score \?\? 0\)/);
  assert.match(client, /Number\(state\.away_score \?\? 0\)/);
  assert.match(client, /encounter\.status === 'live' \|\| encounter\.status === 'finished'/);
  assert.match(client, /summarizeSetResult\(encounter\.result_text\)/);
  assert.match(client, /homeAwaySetScore\(result, !!match\.is_home\)/);
  assert.doesNotMatch(client, /insert\(|\.update\(|\.delete\(/);
});

test('TV polls every 30 seconds and preserves last good scoreboard when offline', () => {
  assert.match(client, /const REFRESH_MS = 30_000/);
  assert.match(client, /window\.setInterval\(\(\) => \{ void refresh\(\); \}, REFRESH_MS\);/);
  assert.match(client, /if \(inFlight\) return;/);
  assert.match(client, /if \(!lastSuccessful\)/);
  assert.match(client, /sync\.classList\.add\('tv-ticker__sync--error'\)/);
  assert.match(client, /sync\.classList\.remove\('tv-ticker__sync--error'\)/);
  assert.match(client, /Die Anzeige startet automatisch/);
});

test('three encounters side by side at TV width, two at medium and one on small screens', () => {
  assert.match(styles, /\.tv-ticker__grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:1350px\)\{\.tv-ticker__grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:850px\)\{\.tv-ticker__grid\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(styles, /\.tv-ticker__score-values/);
  assert.match(styles, /\.tv-ticker__sets/);
  assert.match(styles, /\.tv-ticker__game\.is-live:before/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
});

test('set rendering always follows the stored TSV perspective even for away games', () => {
  const result = summarizeSetResult('6:3 4:6 10:7');
  assert.equal(result.winner, 'tsv');
  assert.deepEqual(homeAwaySetScore(result, true), {homeSets:2,awaySets:1});
  assert.deepEqual(homeAwaySetScore(result, false), {homeSets:1,awaySets:2});
});
