import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('News pages avoid eagerly loading full article bodies',()=>{
  const js=read('src/scripts/public.ts');
  const part=js.slice(js.indexOf('export async function loadNews'),js.indexOf('export async function loadManagedPage'));
  assert.match(part,/const pageSize = 6/);
  assert.match(part,/\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(part,/\.select\('id,slug,title,excerpt,hero_image_path,published_at,button_label,button_url'\)/);
  assert.match(part,/data-news-body/);
  assert.match(part,/requestedNews/);
  assert.doesNotMatch(part,/\.select\('\*'\)/);
});
test('Paginated News remains linked to detail, filter and event deduplication',()=>{
  const page=read('src/pages/aktuelles/index.astro');
  assert.match(page,/document\.addEventListener\('tsv-news-batch', decorateNewsCards\)/);
  assert.match(page,/decorateNewsCards\(\)/);
  assert.match(page,/details\.querySelector<HTMLElement>\('\[data-news-body\]'\)/);
  assert.match(page,/\.select\('body'\)/);
  assert.match(page,/linkedNewsIds\.has\(card\.id\.slice\(5\)\)/);
});
