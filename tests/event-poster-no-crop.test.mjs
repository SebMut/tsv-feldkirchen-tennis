import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const actual = read('src/pages/aktuelles/index.astro');
const global = read('src/styles/global.css');
const pub = read('src/scripts/public.ts');

test('event poster retains original aspect ratio and contains its entire image', () => {
  assert.match(actual, /event\.hero_image_path \? ' content-card__media--poster'/);
  assert.match(actual, /:global\(\.content-card--event \.content-card__media--poster\)\{aspect-ratio:auto;overflow:visible/);
  assert.match(actual, /:global\(\.content-card--event \.content-card__media--poster img\)\{width:100%;height:auto;object-fit:contain;aspect-ratio:auto\}/);
});

test('poster rules override both desktop and mobile generic 16-to-9 cropping', () => {
  assert.match(actual, /:global\(\.content-card__media\)\{display:block;aspect-ratio:16\/8\.5/);
  assert.match(actual, /@media\(max-width:760px\)/);
  assert.match(actual, /:global\(\.content-card__media\)\{aspect-ratio:16\/8\.8\}/);
  assert.match(actual, /:global\(\.content-card--event \.content-card__media--poster\)\{aspect-ratio:auto/);
  assert.match(actual, /:global\(\.content-card__media img\)\{[^}]*object-fit:cover/);
  assert.match(actual, /:global\(\.content-card--event \.content-card__media--poster img\)\{[^}]*object-fit:contain/);
});

test('event previews also retain full artwork in the homepage thumbnail', () => {
  assert.match(pub, /item\.label === 'Veranstaltung' \? ' home-news-item__image--event'/);
  assert.match(global, /\.home-news-column \.home-news-item__image--event\{object-fit:contain;background:#fff\}/);
  assert.match(global, /@media\(max-width:480px\)/);
});

test('fallbacks and news articles preserve their existing layout', () => {
  assert.match(actual, /const eventImage = event\.hero_image_path \? mediaUrl\(event\.hero_image_path\) : '\/images\/veranstaltung-ai\.svg'/);
  assert.match(actual, /card\.classList\.add\('content-card', 'content-card--news'\)/);
  assert.match(pub, /const homeItems = \[/);
});
