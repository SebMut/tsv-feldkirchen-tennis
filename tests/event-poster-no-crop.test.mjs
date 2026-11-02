import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const actual = read('src/pages/aktuelles/index.astro');
const live = read('src/pages/live/index.astro');
const global = read('src/styles/global.css');
const pub = read('src/scripts/public.ts');

test('event and news cards have precisely equal 16:9 image frames', () => {
  assert.match(actual, /:global\(\.content-card__media\)\{display:block;position:relative;aspect-ratio:16\/9;overflow:hidden/);
  assert.match(actual, /:global\(\.content-card__media img\)\{display:block;position:absolute;inset:0;width:100%;height:100%/);
  assert.match(actual, /:global\(\.content-card--event \.content-card__media--poster\)\{aspect-ratio:16\/9;overflow:hidden/);
  assert.match(actual, /:global\(\.content-card--event \.content-card__media--poster img\)\{width:100%;height:100%;object-fit:contain\}/);
  assert.match(actual, /event\.hero_image_path \? ' content-card__media--poster'/);
  assert.match(actual, /event\.slug === 'platzabbau-2026-11-07' \? ' content-card__media--trim-frame'/);
  assert.match(actual, /:global\(\.content-card--event \.content-card__media--trim-frame img\)\{object-fit:cover;object-position:center;transform:scale\(1\.02\)/);
});

test('desktop and mobile both preserve the entire poster without cropping', () => {
  assert.match(actual, /object-fit:contain/);
  assert.doesNotMatch(actual, /content-card__media img\)\{[^}]*object-fit:cover/);
  assert.match(actual, /@media\(max-width:760px\)[\s\S]*?:global\(\.content-card__media\)\{aspect-ratio:16\/9\}/);
  assert.doesNotMatch(actual, /content-card__media\)\{aspect-ratio:auto/);
  assert.match(actual, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(actual, /grid-template-columns:1fr/);
});

test('the Liveticker page keeps uniform logo and placeholder image sizes', () => {
  assert.match(live, /\.live-team img\),:global\(\.live-scorecenter \.live-team \.live-opponent-mark\)\{width:52px;height:52px;min-width:52px;aspect-ratio:1;object-fit:contain/);
  assert.match(live, /\.live-encounter-side img\),:global\(\.live-scorecenter \.live-encounter-side \.live-opponent-mark\)\{flex:0 0 27px;width:27px;height:27px;aspect-ratio:1;object-fit:contain/);
  assert.match(live, /width:43px;height:43px;min-width:43px/);
});

test('original event images, linked news images, fallbacks and homepage thumbnails remain intact', () => {
  assert.match(actual, /const eventImage = event\.hero_image_path \? mediaUrl\(event\.hero_image_path\) : '\/images\/veranstaltung-ai\.svg'/);
  assert.match(actual, /data-event-has-image/);
  assert.match(actual, /card\.classList\.add\('content-card', 'content-card--news'\)/);
  assert.match(pub, /item\.label === 'Veranstaltung' \? ' home-news-item__image--event'/);
  assert.match(global, /\.home-news-column \.home-news-item__image--event\{object-fit:contain;background:#fff\}/);
});
