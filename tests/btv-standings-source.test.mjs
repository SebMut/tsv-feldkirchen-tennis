import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBtvStandings,parseClubStandingsColumns,officialClubStandingsUrl,parseStandingStats} from '../scripts/btv-standings-source.mjs';

const text=[
  'Südbayern | Sommer 2027',
  'Herren 40 Südliga 2 Gr. 315',
  'Rang Mannschaft Begegnungen Punkte Matches Sätze Spiele',
  '1 TSV Feldkirchen II (01012) 7 12:2 45:18 96:42 625:457',
  '2 SC Baldham-Vaterstetten II (02035) 7 10:4 40:23 88:55 590:480',
  '3 TC Muster (09991) 7 8:6 35:28 74:61 540:510',
  '4 VfB Beispiel (09992) 7 6:8 30:33 65:71 500:550',
  'Legende'
].join('\n');

test('parses only a verified group table with contiguous ranks',()=>{
  const rows=parseBtvStandings(text,{seasonCode:'sommer-2027',groupName:'Gr. 315'});
  assert.equal(rows.length,4);
  assert.deepEqual(rows[0],{rank:1,teamName:'TSV Feldkirchen II',clubCode:'01012',standingText:'7 12:2 45:18 96:42 625:457'});
  assert.throws(()=>parseBtvStandings(text,{seasonCode:'sommer-2025',groupName:'Gr. 315'}),/MISMATCH/);
  assert.throws(()=>parseBtvStandings(text,{seasonCode:'sommer-2027',groupName:'Gr. 316'}),/MISMATCH/);
});

test('matchday workflow writes only on main with the server key',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/btv-standings-sync.yml',import.meta.url),'utf8');
  assert.match(workflow,/cron: '41 \*\/8 \* \* \*'/);
  assert.match(workflow,/needs\.matchday-window\.outputs\.active == 'true'/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/BTV_SUPABASE_SECRET_KEY/);
});

test('one unavailable BTV group cannot abort every other table',()=>{
  const importer=readFileSync(new URL('../scripts/btv-standings-sync.mjs',import.meta.url),'utf8');
  assert.match(importer,/failures\.push/);
  assert.match(importer,/continue; \/\/ One unavailable BTV group/);
  assert.match(importer,/groups===0/);
});

test('standings importer follows the configured winter season only',()=>{
  const importer=readFileSync(new URL('../scripts/btv-standings-sync.mjs',import.meta.url),'utf8');
  assert.match(importer,/ACTIVE_SEASON_TEAM_COUNTS=new Map\(\[\['winter-2026-2027',3\]\]\)/);
  assert.doesNotMatch(importer,/\['sommer-2026','winter-2026-2027'\]/);
  assert.doesNotMatch(importer,/teamSeasons\.length!==23/);
});

test('official small club report supplies complete summer group tables',()=>{
  const columns=[0,1,2,3].map((_,index)=>[
    `Herren Südliga 2 Gr. ${315+index}`,
    '1 TSV Feldkirchen II (01012) 7 12:2 45:18 96:42 625:457',
    '2 SC Baldham (02035) 7 10:4 40:23 88:55 590:480',
    '3 TC Muster (09991) 7 8:6 35:28 74:61 540:510',
    '4 VfB Beispiel (09992) 7 6:8 30:33 65:71 500:550'
  ].join('\n'));
  const groups=parseClubStandingsColumns(columns,{seasonCode:'sommer-2027'});
  assert.equal(groups.size,4);
  assert.equal(groups.get(315)[0].teamName,'TSV Feldkirchen II');
  // No league season ID is configured until the BTV publishes the summer round.
  assert.equal(officialClubStandingsUrl('sommer-2026'),null);
  assert.equal(officialClubStandingsUrl('sommer-2027'),null);
  assert.equal(parseClubStandingsColumns([columns[0]],{seasonCode:'sommer-2027'}).size,1);
});

test('standings stop before the adjacent fixture column',()=>{
  assert.equal(parseStandingStats('7 14:0 43:20 91:46 625:457 So. 03.05.2026 10:00 Gegner 6:3'),
    '7 14:0 43:20 91:46 625:457');
  assert.equal(parseStandingStats('Spielort: TC Mühldorf'),null);
});

test('scheduled result importer includes winter instead of summer-only filter',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/btv-results-private-import.yml',import.meta.url),'utf8');
  const importer=readFileSync(new URL('../scripts/btv-results-import.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(workflow,/BTV_RESULTS_ONLY_SOMMER_2026/);
  assert.match(importer,/const ACTIVE_SEASONS=\[\{code:'winter-2026-2027'/);
});
