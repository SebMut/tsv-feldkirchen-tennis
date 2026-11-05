import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/pages/aktuelles/index.astro',import.meta.url),'utf8');
const style=readFileSync(new URL('../src/styles/global.css',import.meta.url),'utf8');

test('News and events occupy a single grid while preserving data load targets',()=>{
  assert.match(page,/id="aktuelles-card-grid" class="content-card-grid"/);
  assert.match(page,/id="event-news-list" class="content-card-grid__items"/);
  assert.match(page,/id="news-list" class="content-card-grid__items"/);
  assert.match(page,/\.content-card-grid__items\{display:contents\}/);
  assert.match(page,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(page,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(page,/grid-template-columns:1fr/);
  assert.doesNotMatch(page,/newsSection\.hidden = true/);
});
test('heading sizes are reduced across public pages',()=>{
  assert.match(style,/h1\{font-size:clamp\(1\.7rem,2\.75vw,2\.55rem\)/);
  assert.match(style,/h2\{font-size:clamp\(1\.2rem,1\.9vw,1\.75rem\)/);
  assert.match(style,/\.premium-hero h1\{font-size:clamp\(2\.4rem,4\.8vw,3\.7rem\)/);
  assert.match(style,/\.teams-page__intro h1\{margin:0;font-size:clamp\(1\.75rem,3\.2vw,2\.7rem\)/);
});
