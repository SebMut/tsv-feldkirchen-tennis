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
  assert.match(css,/\.home-intro-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
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
  assert.equal(firstGrid[1], secondGrid[1], 'Willkommen/Wetter und Aktuelles/Spiele müssen alle dieselben 50/50-Spalten haben');

  assert.match(css,/@media\(max-width:820px\)\{\.premium-content\{gap:22px\}/);
  assert.match(css,/@media\(max-width:520px\)\{\.premium-content,\.home-intro-grid,\.home-columns\{gap:18px\}/);
});

test('mobile TSV dock offers five icon tabs, accessible more links and login',()=>{
  const header=readFileSync(new URL('../src/components/SiteHeader.astro',import.meta.url),'utf8');
  assert.match(header,/class="mobile-dock"/);
  assert.match(header,/aria-label="Mobile Hauptnavigation"/);
  const dockStart = header.indexOf('<nav class="mobile-dock"');
  const dockEnd = header.indexOf('</nav>', dockStart);
  const dockMarkup = header.slice(dockStart, dockEnd);
  const primaryLabels = Array.from(dockMarkup.matchAll(/<span>(Live-Ticker|Aktuelles|Training|Kalender|Mehr)<\/span>/g), match => match[1]);
  assert.deepEqual(primaryLabels, ['Live-Ticker', 'Aktuelles', 'Training', 'Kalender', 'Mehr']);
  const topLinks = dockMarkup.slice(0, dockMarkup.indexOf('<details class="mobile-dock__more">'));
  const primaryHrefs = Array.from(topLinks.matchAll(/href="([^"]+)"/g), match => match[1]);
  assert.deepEqual(primaryHrefs, ['/spieltag/', '/aktuelles/', '/training/', '/termine/']);
  assert.match(header, /const activeMore = !activePlay && !active\('\/aktuelles\/'\) && !active\('\/training\/'\) && !active\('\/termine\/'\);/);
  for(const href of ['/', '/mannschaften/', '/spieltag/', '/termine/']) {
    assert.ok(header.includes('href="' + href + '"'), 'Missing mobile navigation route ' + href);
  }
  for(const href of ['/aktuelles/', '/training/', '/ueber-uns/', '/mitglied-werden/', '/sponsoren/', '/kontakt/', '/admin/']) {
    assert.ok(header.includes('href="' + href + '"'), 'Missing further menu route ' + href);
  }
  assert.match(header, /class="mobile-dock__more"/);
  assert.match(header, /data-auth-link>Login/);
  assert.match(header, /aria-current=\{activePlay \? 'page' : undefined\}/);
  assert.match(header, /dockMore\.open = false/);
  assert.match(css,/\.mobile-dock\{display:none\}/);
  assert.match(css,/@media\(max-width:980px\)\{[\s\S]*?\.mobile-dock\{[\s\S]*?position:fixed;/);
  assert.match(css,/\.mobile-dock__panel\{/);
  assert.match(css,/\.site-header \.mobile-nav\{display:none\}/);
});

test('small screens have shorter hero, closer card spacing and usable bottom dock space',()=>{
  assert.match(css,/\.premium-hero\{min-height:365px\}/);
  assert.match(css,/\.premium-metrics>div\{padding:12px 8px\}/);
  assert.match(css,/\.premium-content\{padding-top:15px;padding-bottom:24px;gap:13px\}/);
  assert.match(css,/\.home-welcome>p:nth-of-type\(2\)\{display:none\}/);
  assert.match(css,/body\{padding-bottom:calc\(90px \+ env\(safe-area-inset-bottom,0px\)\)\}/);
  assert.match(css,/@media\(max-width:370px\)/);
});
