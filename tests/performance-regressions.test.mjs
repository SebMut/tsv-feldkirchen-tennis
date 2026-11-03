import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('team list loads match state only for selected season and retries errors', () => {
  const code = source('src/scripts/public.ts');
  const list = code.slice(code.indexOf('export async function loadTeams'), code.indexOf('export async function loadTeamDetail'));
  assert.match(list, /const seasonMatchCache = new Map/);
  assert.match(list, /const ids = teamsForSeason\(seasonByCode\.get\(code\)\)/);
  assert.match(list, /\.in\('team_season_id', ids\)/);
  assert.match(list, /data-retry-team-season/);
  assert.doesNotMatch(list, /publishedTeamSeasons\.map\(\(ts: Row\) => ts\.id\)/);
});
test('team detail does not fetch past seasons when viewing the current one', () => {
  const code = source('src/scripts/public.ts');
  const part = code.slice(code.indexOf('export async function loadTeamDetail'), code.indexOf('export async function loadMatchDetail'));
  assert.doesNotMatch(part, /allTeamMatches/);
  assert.match(part, /\.eq\('team_season_id', current\.id\)/);
});
test('public live ticker holds last successful result on request errors', () => {
  const code = source('src/scripts/public.ts');
  const live = code.slice(code.indexOf('export async function loadLiveTicker'));
  assert.match(live, /connectionStatus\.hidden = false/);
  assert.match(live, /responses\.some\(result => result\.error\)/);
  assert.match(live, /const snapshot = JSON\.stringify/);
});
test('mobile Lighthouse includes all core pages and diagnostics', () => {
  const code = source('scripts/lighthouse-audit.mjs');
  for (const section of ['startseite','aktuelles','mannschaften','spieltag','liveticker']) assert.ok(code.includes("['"+section+"'"));
  for (const metric of ['lcp_ms','cls','tbt_ms','transfer_bytes','requests']) assert.ok(code.includes(metric+':'));
  assert.match(code, /Performance-Hinweise/);
});
