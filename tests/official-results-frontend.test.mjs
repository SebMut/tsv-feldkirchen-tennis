import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');

test('prefer official BTV scores irrespective of the manual live ticker status',()=>{
  assert.match(code,/function officialBtvScore\(match: Row\)/);
  assert.match(code,/match\.btv_result_text/);
  assert.match(code,/home === 0 && away === 0/);
  assert.doesNotMatch(code,/status === 'scheduled' \? officialBtvScore\(match\) : null/);
  assert.match(code,/const official = officialBtvScore\(match\)/);
  assert.match(code,/official \? '<span class="status-pill btv-official">Offizielles BTV-Ergebnis/);
});

test('match page distinguishes BTV official result from live ticker status',()=>{
  assert.match(code,/Offizielles BTV-Ergebnis/);
  assert.match(code,/Noch kein Ergebnis vorhanden/);
  assert.match(code,/const clubScore = match\.is_home \? homeScore : awayScore/);
  assert.match(code,/const opponentScore = match\.is_home \? awayScore : homeScore/);
  assert.match(code,/matchRouteButton\(match\)/);
});

test('homepage recent results and team statistics include BTV finals',()=>{
  assert.match(code,/scoreRows\.find\(s => s\.match_id === m\.id\)\?\.status === 'finished' \|\| officialBtvScore\(m\)/);
  assert.match(code,/seasonLiveMap\.get\(m\.id\)\?\.status === 'finished' \|\| officialBtvScore\(m\)/);
  assert.match(code,/Spiele ohne veröffentlichten Endstand werden nicht als 0:0 gewertet/);
});
