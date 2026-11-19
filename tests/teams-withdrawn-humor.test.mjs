import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('src/scripts/public.ts');
const css=read('src/styles/global.css');
const migration=read('supabase/migrations/20261119230000_herren_ii_withdrawn_herren_50_humor_image.sql');

test('Herren II withdrawn status is season-specific, visible on card and detail, and does not show a false upcoming game',()=>{
  assert.match(migration,/team_seasons set\s+summary='Mannschaft zurückgezogen\./);
  assert.match(migration,/b8deac3d-67f8-43fa-a6f4-fb5e875b9827/);
  assert.match(page,/function seasonStatusNote\(/);
  assert.match(page,/seasonStatusNote\(ts\)/);
  assert.match(page,/seasonStatusNote\(current\)/);
  assert.match(page,/const featured = isWithdrawnTeamSeason\(ts\) \? undefined/);
  assert.match(page,/const featuredMatch = isWithdrawnTeamSeason\(current\) \? undefined/);
  assert.match(css,/\.team-season-notice--withdrawn/);
});

test('Herren 50 humor image uses only relative media path; existing season-first image priority is preserved',()=>{
  assert.match(migration,/teams\/32956024-41ca-4a69-b26f-d8d8ea097d36\/herren50-humor-20261119\.avif/);
  assert.match(migration,/storage\.objects/);
  assert.match(page,/mediaUrl\(ts\.team_image_path \|\| team\.image_path\)/);
  assert.match(page,/mediaUrl\(current\?\.team_image_path \|\| team\.image_path\)/);
  assert.match(page,/teamImageAlt\(team, ts\.team_image_path \|\| team\.image_path\)/);
  assert.match(page,/KI-Platzhalterbild/);
  assert.match(page,/keine echten Mannschaftsspieler/);
  assert.ok(!page.includes('data:image/avif;base64'));
  assert.ok(!migration.includes('decode('));
});

test('original Herren 50 photo path is replaced only when the exact team matches; other 50+ teams remain unchanged',()=>{
  assert.match(migration,/where id='32956024-41ca-4a69-b26f-d8d8ea097d36' and slug='herren-50'/);
  assert.ok(!migration.includes('herren-50-ii'));
  assert.match(migration,/if not found then raise exception/);
});
