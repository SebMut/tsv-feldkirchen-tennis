import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/global.css',import.meta.url),'utf8');

test('homepage promotes the live hall finder before the welcome content',()=>{
  const promo=home.indexOf('class="home-hallfinder-promo"');
  const welcome=home.indexOf('class="home-intro-grid"');
  assert.ok(promo>0&&promo<welcome);
  assert.match(home,/href="\/hallenplaetze\/">Hallen vergleichen/);
  assert.match(home,/Aschheim, Ismaning, Sporttraum, Racket-Park Haar und Kirchheim/);
});

test('hall finder promotion is visually prominent and responsive',()=>{
  assert.match(css,/\.home-hallfinder-promo\{[^}]*display:grid/);
  assert.match(css,/\.home-hallfinder-promo\{[^}]*background:linear-gradient/);
  assert.match(css,/@media\(max-width:900px\)\{\.home-hallfinder-promo\{grid-template-columns:1fr/);
  assert.match(css,/@media\(max-width:520px\)\{\.home-hallfinder-promo\{gap:20px/);
});
