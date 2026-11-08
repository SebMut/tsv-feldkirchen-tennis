import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const get = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const layout = get('src/layouts/MainLayout.astro');
const team = get('src/pages/mannschaften/[slug].astro');
const sitemap = get('src/pages/sitemap.xml.ts');
const htaccess = get('public/.htaccess');
const tv = get('src/pages/spieltag/live-ticker/index.astro');

test('team pages have unique static search metadata and SportsTeam schema', () => {
  assert.match(team, /title=\{`\$\{teamName\} \| TSV Feldkirchen Tennis`\}/);
  assert.match(team, /<h1>\{teamName\}<\/h1>/);
  assert.match(team, /description=\{teamDescription\}/);
  assert.match(team, /'@type': 'SportsTeam'/);
});

test('sitemap exposes hall finder and important public pages with lastmod', () => {
  for (const path of ['/hallenplaetze/', '/ueber-uns/', '/live/', '/spieltag/live-ticker/']) assert.ok(sitemap.includes(path));
  assert.match(sitemap, /<lastmod>\$\{lastmod\}<\/lastmod>/);
});

test('about page is served directly and static assets receive cache headers', () => {
  assert.doesNotMatch(htaccess, /Redirect 301 \/ueber-uns\//);
  assert.match(htaccess, /Cache-Control "public, max-age=31536000, immutable"/);
  assert.match(htaccess, /AddOutputFilterByType DEFLATE/);
});

test('global and TV layouts provide social cards and structured data', () => {
  for (const source of [layout, tv]) {
    assert.match(source, /twitter:card/);
    assert.match(source, /application\/ld\+json/);
  }
  assert.match(layout, /SportsOrganization/);
});
