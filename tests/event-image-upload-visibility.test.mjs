import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const editor = read('src/scripts/event-rsvp-admin.ts');
const publicPage = read('src/pages/aktuelles/index.astro');
const media = read('src/lib/media-upload.ts');
const supabase = read('src/lib/supabase.ts');

test('a new event image is referenced only after its DB path is confirmed', () => {
  assert.match(editor, /replaceMediaImage\(\{/);
  assert.match(editor, /select\('hero_image_path'\)\.single\(\)/);
  assert.match(editor, /stored\?\.hero_image_path === path/);
  assert.match(editor, /renderImage\(newPath\)/);
  assert.match(editor, /await refresh\(data\.id\)/);
  assert.match(media, /await options\.persistPath\(path\)/);
  assert.match(media, /await removeUploadedPath\(path\)/);
});

test('admin preview shows stored original rather than clipping new poster', () => {
  assert.match(editor, /object-fit:contain;background:#fff/);
  assert.match(editor, /Gespeichertes Originalbild öffnen/);
  assert.match(editor, /addEventListener\('error'/);
  assert.doesNotMatch(editor, /object-fit:cover;border-radius:14px/);
});

test('every newly uploaded event image is displayed through its relative Supabase Storage path', () => {
  assert.match(publicPage, /event\.hero_image_path \? mediaUrl\(event\.hero_image_path\)/);
  assert.match(publicPage, /data-event-has-image/);
  assert.doesNotMatch(publicPage, /content-card__media--trim-frame/);
  assert.match(publicPage, /object-fit:contain/);
  assert.match(supabase, /storage\/v1\/object\/public\/media/);
});
