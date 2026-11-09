import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const home=read('src/pages/index.astro');
const style=read('src/styles/global.css');
const news=read('supabase/migrations/20261109210433_publish_hallfinder_and_pyramid_news.sql');
const deploy=read('.github/workflows/deploy-united-domains.yml');

test('hall finder and Summer 2027 pyramid are promoted in the homepage hero',()=>{
  assert.match(home,/class="premium-hero__features"/);
  assert.match(home,/href="\/hallenplaetze\/"/);
  assert.match(home,/href="\/forderungspyramide\/"/);
  assert.match(home,/Hallenplätze in der Nähe/);
  assert.match(home,/Forderungspyramide/);
  assert.match(style,/hallenplaetze-in-der-naehe-1773x885\.webp/);
  assert.match(style,/forderungspyramide-sommer-2027-1773x885\.webp/);
});

test('both feature stories are published as news with wide banner images',()=>{
  assert.match(news,/'hallenplaetze-in-der-naehe'/);
  assert.match(news,/'forderungspyramide-sommer-2027'/);
  assert.match(news,/Hallenplätze in der Nähe/);
  assert.match(news,/Forderungspyramide für den Sommer 2027/);
  assert.match(news,/hallenplaetze-in-der-naehe-1773x885\.webp/);
  assert.match(news,/forderungspyramide-sommer-2027-1773x885\.webp/);
  assert.match(news,/on conflict \(slug\) do update/);
});

test('production verification expects both public homepage feature links',()=>{
  assert.match(deploy,/grep -Fq 'href="\/forderungspyramide\/"' \/tmp\/home-live\.html/);
  assert.match(deploy,/grep -Fq 'href="\/hallenplaetze\/"' \/tmp\/home-live\.html/);
  assert.doesNotMatch(deploy,/Unexpected public navigation link to pyramid/);
});
