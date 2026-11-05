import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const helper = readFileSync(new URL('../src/lib/home-news-images.ts',import.meta.url),'utf8');
const js=ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {eventImagePathCandidates}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const christmasId='3d850fed-e607-4b7d-8527-6e7a6e192552';
const linkedId='add97d79-2d9c-46bb-af2e-fe6bdef2a434';
const christmasEvent={
  id:christmasId,title:'Weihnachtsfeier 2026 🎄',
  slug:'news-'+linkedId,external_url:'news:'+linkedId,
  hero_image_path:null,
};
const christmasNews={
  id:linkedId,title:'Weihnachtsfeier 2026 🎄',
  hero_image_path:'news/'+linkedId+'/TSV-Feldkirchen-Weihnachtsfeier-2026.webp',
  related_event_id:null,
};
test('Christmas party homepage card uses linked News picture when event has none',()=>{
  assert.deepEqual(eventImagePathCandidates(christmasEvent,[christmasNews]),[christmasNews.hero_image_path]);
});
test('event-specific image always outranks linked News image',()=>{
  assert.deepEqual(eventImagePathCandidates({...christmasEvent,hero_image_path:'events/picture.webp'},[christmasNews]),
    ['events/picture.webp',christmasNews.hero_image_path]);
});
test('reverse relation and equivalent editorial title still find available image',()=>{
  assert.deepEqual(eventImagePathCandidates({...christmasEvent,slug:'weihnachten',external_url:null},[
    {...christmasNews,id:'different',related_event_id:christmasId},
  ]),[christmasNews.hero_image_path]);
  assert.deepEqual(eventImagePathCandidates({...christmasEvent,slug:'plain',external_url:null},[
    {...christmasNews,id:'different'},
  ]),[christmasNews.hero_image_path]);
});
test('no broken derived Storage path and no duplicate image candidate',()=>{
  assert.deepEqual(eventImagePathCandidates({...christmasEvent,hero_image_path:christmasNews.hero_image_path},[christmasNews]),
    [christmasNews.hero_image_path]);
  assert.deepEqual(eventImagePathCandidates({...christmasEvent,title:'Other',slug:'no-link',external_url:null},[christmasNews]),[]);
});
test('public home card renders fallback when image lookup or Storage object fails',()=>{
  const code=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');
  assert.match(code,/select\('id,title,hero_image_path,related_event_id'\)/);
  assert.match(code,/\.in\('id', linkedIdsToFetch\)/);
  assert.match(code,/\.in\('related_event_id', missingEventIds\)/);
  assert.match(code,/eventImagePathCandidates\(item, relatedNews\)\.map\(mediaUrl\)/);
  assert.match(code,/\/images\/veranstaltung-ai\.svg/);
  assert.match(code,/image\.addEventListener\('error', onError\)/);
  assert.match(code,/data-home-image-alternates/);
  assert.match(code,/!linkedNewsIds\.has\(item\.id\)/);
  assert.match(code,/event\.id === item\.related_event_id/);
});
