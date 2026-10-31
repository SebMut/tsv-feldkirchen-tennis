import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/mannschaften/index.astro', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const publicJs = readFileSync(new URL('../src/scripts/public.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261031234000_tennisde_team_portrait_links.sql', import.meta.url), 'utf8');

test('DTB widget belongs to TSV Feldkirchen (01012) and cannot replace the TSV match view', () => {
  assert.match(page, /verein=01012&amp;linkfarbe=20aebd/);
  assert.match(page, /verband=BTV/);
  assert.match(page, /id="teams-grid"/);
  assert.match(page, /loadTeams\(\)/);
  assert.match(page, /Offizielle Mannschaftsübersicht/);
});

test('user example portrait is a direct external link and not a guessed team association', () => {
  assert.match(page, /#teamportrait\/3728614/);
  assert.match(page, /rel="noopener noreferrer"/);
  assert.match(page, /Beispiel: direktes Mannschaftsportrait/);
});

test('third-party iframe connects only when opened by visitor', () => {
  assert.match(page, /<details class="card teams-official-widget__details" id="official-tennisde-widget">/);
  assert.match(page, /data-src="https:\/\/services\.tennis\.de\/extern\/tennisdeteamsearch\.zul/);
  assert.doesNotMatch(page, /<iframe[^>]*\s+src="https:\/\/services\.tennis\.de/);
  assert.match(page, /officialWidget\?\.addEventListener\('toggle'/);
  assert.match(page, /if \(!officialWidget\.open\) return/);
  assert.match(page, /frame\.src = frame\.dataset\.src/);
  assert.match(page, /loading="lazy"/);
});

test('small screens retain a usable full-width iframe and accessible disclosure', () => {
  assert.match(page, /title="Offizielle tennis\.de-Mannschaftssuche/);
  assert.match(css, /\.teams-official-widget__frame\{display:block;width:100%;max-width:100%/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /\.teams-official-widget__details>summary:focus-visible/);
});

test('portrait 3728614 is stored only for verified winter 2026/27 Herren', () => {
  assert.match(migration, /teamportrait\/3728614/);
  assert.match(migration, /t\.slug = 'herren' and s\.code = 'winter-2026-2027'/);
  assert.match(migration, /tennis_de_portrait_url is null/);
  assert.match(migration, /team_seasons_tennis_de_portrait_url_check/);
});

test('season-specific portraits appear only for explicitly mapped teams', () => {
  assert.match(publicJs, /function officialTennisDePortraitUrl\(teamSeason: Row \| undefined\)/);
  assert.match(publicJs, /url\.origin !== 'https:\/\/www\.tennis\.de'/);
  assert.match(publicJs, /url\.searchParams\.get\('verein'\) !== '01012'/);
  assert.match(publicJs, /tennisDePortraitUrl \? /);
  assert.match(publicJs, /tennis\.de Mannschaftsportrait/);
  assert.match(publicJs, /teamSeason\?\.tennis_de_portrait_url/);
});
