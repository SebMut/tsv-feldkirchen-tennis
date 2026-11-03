import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code=readFileSync(new URL('../src/pages/aktuelles/index.astro',import.meta.url),'utf8');
test('deep links to linked event news resolve to visible event card',()=>{
  assert.match(code,/const eventByNewsId = new Map<string, string>\(\)/);
  assert.match(code,/eventByNewsId\.set\(match\[1\], String\(event\.id\)\)/);
  assert.match(code,/const eventId = candidate\.startsWith\('news-'\) \? eventByNewsId\.get\(candidate\.slice\(5\)\)/);
  assert.match(code,/expandCard\(eventId \? 'event-' \+ eventId : candidate, true\)/);
});
test('old news deep links are retained after duplicate event cards are deduplicated',()=>{
  assert.match(code,/eventByTitle\.set\(eventTitle, String\(event\.id\)\)/);
  assert.match(code,/if \(eventId\) eventByNewsId\.set\(newsId, eventId\)/);
  assert.match(code,/card\.remove\(\);\s+openFromUrl\(\);/);
});
