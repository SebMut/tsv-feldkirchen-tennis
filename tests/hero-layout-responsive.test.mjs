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
  assert.match(css,/@media\(max-width:820px\)\{\.home-intro-grid,\.home-columns\{grid-template-columns:1fr\}/);
  assert.match(css,/\.weather-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(script,/forecast_days=3/);
  assert.match(script,/weatherResult\.daily\.time\.slice\(0, 3\)/);
  assert.doesNotMatch(script,/forecast_days=4/);
});
