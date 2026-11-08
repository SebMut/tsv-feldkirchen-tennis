import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const get = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const tracker = get('src/scripts/site-analytics.ts');
const admin = get('src/scripts/site-analytics-admin.ts');
const finder = get('src/scripts/hall-finder.ts');
const adminPage = get('src/pages/admin/index.astro');
const migration = get('supabase/migrations/20261108150000_hall_finder_analytics.sql');

test('hall finder is accepted by browser and database analytics allowlists', () => {
  assert.match(tracker, /'\/hallenplaetze\/'/);
  assert.match(migration, /'\/hallenplaetze\/'/);
});

test('provider clicks are tagged, allowlisted and ranked in the admin report', () => {
  assert.match(finder, /data-hall-venue/);
  assert.match(tracker, /track\('action_click',pagePath,'halle:'\+hallVenue\)/);
  assert.match(migration, /'hall_venues'/);
  assert.match(migration, /halle:aschheim/);
  assert.match(adminPage, /Meistgeklickte Hallen/);
  assert.match(admin, /rankings\(data\.hall_venues \|\| \[\],'target'\)/);
});

test('admin analytics exposes a dedicated hall finder metric and readable page label', () => {
  assert.match(migration, /'hall_finder_views'/);
  assert.match(migration, /page_path='\/hallenplaetze\/'/);
  assert.match(admin, /hall_finder_views: number/);
  assert.match(admin, /metric\('Hallenfinder',s\.hall_finder_views,'Aufrufe der Hallenplatzsuche'\)/);
  assert.match(admin, /'\/hallenplaetze\/': 'Hallenfinder'/);
});
