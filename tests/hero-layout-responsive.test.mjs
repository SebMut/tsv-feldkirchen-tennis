import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const home=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/global.css',import.meta.url),'utf8');
const image=new URL('../public/images/tsv-feldkirchen-tennisanlage-hero.avif',import.meta.url);

test('actual uploaded TSV photo exists in static assets and homepage hero',()=>{
  const bytes=readFileSync(image);
  assert.equal(bytes.toString('ascii',4,8),'ftyp');
  assert.ok(bytes.includes(Buffer.from('avif','ascii')));
  assert.ok(statSync(image).size>15000);
  assert.match(home,/images\/tsv-feldkirchen-tennisanlage-hero\.avif/);
  assert.match(home,/premium-hero__photo/);
  assert.match(home,/loading="eager" fetchpriority="high"/);
  assert.doesNotMatch(home,/news\/platzaufbau\.png/);
});
test('desktop page fills exactly four fifths of viewport, white gutters on sides',()=>{
  assert.match(css,/body\{background:#fff\}/);
  assert.match(css,/\.site-header,main,\.site-footer\{\s*width:80%/);
  assert.match(css,/@media\(max-width:1023px\)\{\s*\.site-header,main,\.site-footer\{width:100%\}/);
  assert.match(css,/\.container\{\s*width:calc\(100% - 48px\)/);
  assert.match(css,/\.premium-hero__photo\{[\s\S]*?object-fit:cover/);
});

test('welcome and three-day tennis weather share a responsive homepage row',()=>{
  const script=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');
  assert.match(home, /class="home-intro-grid"/);
  assert.match(home, /class="card home-welcome"/);
  assert.match(home, /class="card home-weather"/);
  const intro=home.indexOf('class="home-intro-grid"');
  const weather=home.indexOf('class="card home-weather"',intro);
  const close=home.indexOf('    </div>',weather);
  assert.ok(intro>=0 && weather>intro && close>weather);
  assert.match(css,/\.home-intro-grid\{display:grid;grid-template-columns:minmax\(0,1\.65fr\) minmax\(320px,1fr\)/);
  assert.match(css,/@media\(max-width:820px\)\{\.premium-content\{gap:22px\}\.home-intro-grid,\.home-columns\{grid-template-columns:1fr;gap:22px\}/);
  assert.match(css,/\.weather-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(script,/forecast_days=3/);
  assert.match(script,/weatherResult\.daily\.time\.slice\(0, 3\)/);
  assert.doesNotMatch(script,/forecast_days=4/);
});

test('homepage cards have consistent spacing between both rows and columns',()=>{
  assert.match(css,/\.premium-content\{display:flex;flex-direction:column;gap:28px;/);
  assert.match(css,/\.home-intro-grid\{[^}]*gap:28px;/);
  assert.match(css,/\.home-columns\{[^}]*gap:28px;/);
  assert.match(css,/\.home-columns\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:28px;align-items:stretch\}/);
  assert.match(home, /class="home-columns home-columns--equal"/);
  assert.match(css, /\.home-columns--equal\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  const firstGrid = css.match(/\.home-intro-grid\{[^}]*grid-template-columns:([^;]+);/);
  const secondGrid = css.match(/\.home-columns\{[^}]*grid-template-columns:([^;]+);/);
  assert.ok(firstGrid && secondGrid);
  assert.equal(secondGrid[1], 'repeat(2,minmax(0,1fr))', 'Aktuelles und Kommende Spiele müssen 50/50 aufgeteilt sein');
  assert.notEqual(secondGrid[1], firstGrid[1], 'Die obere Reihe behält ihr eigenes Verhältnis');

  assert.match(css,/@media\(max-width:820px\)\{\.premium-content\{gap:22px\}/);
  assert.match(css,/@media\(max-width:520px\)\{\.premium-content,\.home-intro-grid,\.home-columns\{gap:18px\}/);
});
