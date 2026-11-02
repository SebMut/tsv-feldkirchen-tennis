import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/aktuelles/index.astro', import.meta.url), 'utf8');

test('published events suppress the misleading empty news message', () => {
  assert.match(source, /const hasPublishedEvents = !!list\?\.querySelector\('\.content-card--event'\)/);
  assert.match(source, /const hasVisibleNews = !!newsList\?\.querySelector\('\.content-card--news'\)/);
  assert.match(source, /if \(!hasVisibleNews && hasPublishedEvents && !newsLoadFailed\)/);
  assert.match(source, /if \(newsSection\) newsSection\.hidden = true;/);
});

test('empty combined page still shows useful feedback, and news loading errors remain visible', () => {
  assert.match(source, /const newsLoadFailed = newsMessage\.includes\('Beiträge sind momentan nicht abrufbar\.'\)/);
  assert.match(source, /!hasVisibleNews && !hasPublishedEvents && newsMessage === 'Noch keine Beiträge veröffentlicht\.'/);
  assert.match(source, /Derzeit sind keine Neuigkeiten oder Veranstaltungen veröffentlicht\./);
  assert.match(source, /await loadNews\(\);/);
  assert.match(source, /card\.classList\.add\('content-card', 'content-card--news'\)/);
});
