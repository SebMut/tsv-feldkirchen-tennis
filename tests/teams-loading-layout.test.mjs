import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/pages/mannschaften/index.astro',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/global.css',import.meta.url),'utf8');
test('Mannschaften reserves geometry for season navigation and team cards before data arrives',()=>{
  assert.match(page,/teams-season-skeleton/);
  assert.match(page,/team-card-skeleton/);
  assert.match(page,/role="status" aria-label="Saisons werden geladen"/);
  assert.match(css,/\.teams-season-skeleton\{min-height:175px/);
  assert.match(css,/\.team-card-skeleton\{min-height:330px/);
});
