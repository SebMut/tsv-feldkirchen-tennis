import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const homepage = source('src/pages/index.astro');
const script = source('src/scripts/public.ts');
const stylesheet = source('src/styles/global.css');

test('homepage combines upcoming events and news while keeping their image sources', () => {
  assert.match(homepage, /id="home-news"/);
  assert.match(script, /supabase\.from\('news'\)\.select\('\*'\)/);
  assert.match(script, /supabase\.from\('events'\)\.select\('id,slug,title,starts_at,hero_image_path,rsvp_enabled,external_url'\)/);
  assert.match(script, /image: item\.hero_image_path/);
  assert.match(script, /linkedNewsIds\.has\(item\.id\)/);
  assert.match(script, /const homeItems = \[/);
  assert.match(script, /item\.image \? `<img class="home-news-item__image"/);
  assert.match(script, /item\.image \? `<img class="home-news-item__image/);
  assert.match(script, /width="108" height="80" loading="lazy" decoding="async"/);
  assert.match(script, /class="news-row home-news-item/);
  assert.match(script, /item\.label/);
});

test('article detail image and homepage thumbnail reference the same stored image field', () => {
  assert.match(script, /item\.hero_image_path \? `<img src="\$\{escapeHtml\(mediaUrl\(item\.hero_image_path\)\)\}"/);
  assert.match(script, /image: item\.hero_image_path/);
  assert.match(script, /class="home-news-item__image/);
  assert.match(script, /mediaUrl\(item\.image\)/);
});

test('news thumbnail layout has mobile sizing, keyboard focus and no layout shift', () => {
  assert.match(stylesheet, /\.home-news-column \.home-news-item__link\{\s*display:flex/);
  assert.match(stylesheet, /\.home-news-column \.home-news-item__image\{[\s\S]*?width:108px;height:80px;object-fit:cover/);
  assert.match(stylesheet, /@media\(max-width:480px\)/);
  assert.match(stylesheet, /\.home-news-column \.home-news-item__image\{flex-basis:84px;width:84px;height:72px/);
  assert.match(stylesheet, /\.home-news-column \.home-news-item__link:focus-visible/);
});
