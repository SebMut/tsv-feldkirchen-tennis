import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBtvStandings} from '../scripts/btv-standings-source.mjs';

const text=[
  'Südbayern | Sommer 2026',
  'Herren 40 Südliga 2 Gr. 315',
  'Rang Mannschaft Begegnungen Punkte Matches Sätze Spiele',
  '1 TSV Feldkirchen II (01012) 7 12:2 45:18 96:42',
  '2 SC Baldham-Vaterstetten II (02035) 7 10:4 40:23 88:55',
  '3 TC Muster (09991) 7 8:6 35:28 74:61',
  '4 VfB Beispiel (09992) 7 6:8 30:33 65:71',
  'Legende'
].join('\n');

test('parses only a verified group table with contiguous ranks',()=>{
  const rows=parseBtvStandings(text,{seasonCode:'sommer-2026',groupName:'Gr. 315'});
  assert.equal(rows.length,4);
  assert.deepEqual(rows[0],{rank:1,teamName:'TSV Feldkirchen II',clubCode:'01012',standingText:'7 12:2 45:18 96:42'});
  assert.throws(()=>parseBtvStandings(text,{seasonCode:'sommer-2025',groupName:'Gr. 315'}),/MISMATCH/);
  assert.throws(()=>parseBtvStandings(text,{seasonCode:'sommer-2026',groupName:'Gr. 316'}),/MISMATCH/);
});

test('daily workflow writes only on main with the server key',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/btv-standings-sync.yml',import.meta.url),'utf8');
  assert.match(workflow,/cron: '41 4 \* \* \*'/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/BTV_SUPABASE_SECRET_KEY/);
});

test('scheduled result importer includes winter instead of summer-only filter',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/btv-results-private-import.yml',import.meta.url),'utf8');
  const importer=readFileSync(new URL('../scripts/btv-results-import.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(workflow,/BTV_RESULTS_ONLY_SOMMER_2026/);
  assert.match(importer,/const ACTIVE_SEASONS=SEASONS/);
});
