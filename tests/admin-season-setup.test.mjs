import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ui = src('src/scripts/admin-advanced.ts');
const page = src('src/pages/admin/index.astro');

test('new seasons get type, code and end year (code is NOT NULL)', () => {
  assert.match(page, /id="season-type"/);
  assert.match(ui, /`winter-\$\{year\}-\$\{year \+ 1\}`/);
  assert.match(ui, /`sommer-\$\{year\}`/);
  assert.match(ui, /season_type: type, code/);
  // Teams are only copied from a season of the same type.
  assert.match(ui, /\(season\.season_type \?\? 'summer'\) === type/);
});

test('BTV league season ID is stored as a public setting for the sync jobs', () => {
  assert.match(ui, /const LEAGUE_SEASONS_KEY = 'btv_league_seasons'/);
  assert.match(ui, /upsert\(\{ key: LEAGUE_SEASONS_KEY, value: next, is_public: true \}/);
  assert.match(ui, /\/\^\\d\{4,6\}\$\/\.test\(raw\)/);
});

test('team registrations: add per season, never remove a team that already has matches', () => {
  assert.match(ui, /data-season-teams-form/);
  assert.match(ui, /from\('team_seasons'\)\.insert\(toAdd\)/);
  assert.match(ui, /from\('matches'\)\.select\('id', \{ count: 'exact', head: true \}\)\.eq\('team_season_id', row\.id\)/);
  assert.match(ui, /if \(\(count \?\? 0\) > 0\) \{ kept\.push/);
});
