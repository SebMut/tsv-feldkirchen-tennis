import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const header = read('src/components/SiteHeader.astro');
const nav = read('src/scripts/live-nav-pulse.ts');
const css = read('src/styles/global.css');

test('mobile dock has one live destination and one visible teams fallback in the same slot', () => {
  assert.match(header, /js-live-nav-dock-link/);
  assert.match(header, /js-live-nav-fallback/);
  assert.match(header, /href="\/spieltag\/"[^>]*hidden/);
  assert.match(header, /js-live-nav-fallback[\s\S]*?href="\/mannschaften\/" /);
  assert.match(css, /\.mobile-dock > \.mobile-dock__tab\[hidden\]\{display:none!important\}/);
});

test('only mobile dock changes destination, desktop ticker remains available', () => {
  assert.match(header, /class="js-live-nav-link">Live-Ticker<\/a>/);
  assert.match(nav, /link\.hidden = link\.classList\.contains\('js-live-nav-dock-link'\) && !anyLive/);
  assert.match(nav, /fallback\.hidden = anyLive/);
  assert.match(nav, /link\.classList\.toggle\('has-live-match', anyLive\)/);
  assert.match(nav, /document\.visibilityState === 'visible'/);
  assert.match(nav, /\.eq\('status', 'live'\)/);
  assert.match(nav, /setInterval\(\(\) => void refresh\(\), 30000\)/);
});
