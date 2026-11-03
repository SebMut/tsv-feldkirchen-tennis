import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src=readFileSync(new URL('../src/pages/aktuelles/index.astro',import.meta.url),'utf8');

test('in-place full event text works even when news requests are still pending',()=>{
  const listener=src.indexOf("document.addEventListener('click', event => {");
  const eventFetch=src.indexOf("const { data: events } = await supabase");
  const newsFetch=src.indexOf('const newsLoading = loadNews();');
  const newsFinished=src.indexOf('await newsLoading;');
  assert.ok(listener>0,'missing delegated detail handler');
  assert.ok(listener<eventFetch,'event handlers must be registered before fetching events');
  assert.ok(listener<newsFetch,'event handlers must be registered before loading news');
  assert.ok(newsFetch<eventFetch,'news must load in parallel with events');
  assert.ok(newsFinished>eventFetch,'event links must be bound after independent requests finish');
  assert.match(src,/target\.closest<HTMLAnchorElement>\('a\[data-open-detail\]'\)/);
  assert.match(src,/details\.open = true/);
  assert.match(src,/event\.preventDefault\(\)/);
  assert.match(src,/history\.replaceState/);
});
