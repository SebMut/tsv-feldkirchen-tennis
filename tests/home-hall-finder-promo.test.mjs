import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/global.css',import.meta.url),'utf8');

test('homepage promotes the live hall finder inside the hero before the welcome content',()=>{
  const promo=home.indexOf('class="premium-hero__features"');
  const welcome=home.indexOf('class="home-intro-grid"');
  assert.ok(promo>0&&promo<welcome);
  assert.match(home,/href="\/hallenplaetze\/"[\s\S]*?Hallenplätze in der Nähe/);
  assert.match(home,/Freie Zeiten bei sechs Anlagen vergleichen/);
});

test('hall finder promotion is visually prominent and responsive',()=>{
  assert.match(css,/\.premium-hero__features\{[^}]*display:grid/);
  assert.match(css,/\.premium-hero-feature::after\{[^}]*background:linear-gradient/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.premium-hero__features\{grid-template-columns:1fr/);
  assert.match(css,/\.premium-hero-feature--halls::before\{background-image:/);
});
