import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = (p) => readFileSync(new URL('../' + p, import.meta.url),'utf8');
const page = text('src/pages/mannschaften/index.astro');
const publicScript = text('src/scripts/public.ts');
const migration = text('supabase/migrations/20261031235000_private_roster_default.sql');

test('new roster assignments default to private without changing existing approvals',()=>{
  assert.match(migration,/alter column public_visible set default false/);
  assert.doesNotMatch(migration,/\bupdate\b\s+public\.team_players/i);
});

test('official tennis.de widget shows current teams but TSV preserves historic seasons',()=>{
  assert.match(page,/zeigt automatisch die aktuell gemeldete Saison/);
  assert.match(page,/Für frühere Sommer- und Winterrunden/);
  assert.match(page,/data-season="sommer-2026"/);
  assert.match(page,/data-season="winter-2026-2027"/);
  assert.match(page,/data-src="https:\/\/services\.tennis\.de\/extern\/tennisdeteamsearch\.zul\?verband=BTV&amp;verein=01012/);
  assert.match(page,/officialWidget\?\.addEventListener\('toggle'/);
});

test('live TSV fixtures and route buttons never use the generic tennis.de club address',()=>{
  assert.match(publicScript,/const destination = address \|\| venue/);
  assert.match(publicScript,/match\.is_home \? 'Heim' : 'Auswärts'/);
  assert.match(publicScript,/officialTennisDePortraitUrl\(current\)/);
});

test('documentation distinguishes verified summer rosters from unverified winter rosters',()=>{
  const docs = text('docs/btv-tennisde-source-strategy.md');
  assert.match(docs,/134 eindeutige Spielerprofile/);
  assert.match(docs,/414 private Mannschaftszuordnungen/);
  assert.match(docs,/ungeprüftes Kopieren von Sommer-Namen/);
  assert.match(docs,/Mädchen 15 und Kleinfeld U9/);
});
