import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  readRegularTiebreak, validateRegularTiebreak, adjustRegularTiebreak,
  regularSetFromTiebreak, regularSetDisplayValues, regularSetDisplayHtml,
} from '../src/lib/regular-tiebreak.mjs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('regular tie-break is available only in sets 1 and 2, from 6:6 onward',()=>{
  assert.deepEqual(readRegularTiebreak({'1':[3,2],'2':[0,4]},0),[3,2]);
  assert.deepEqual(readRegularTiebreak({'1':[3,2],'2':[0,4]},1),[0,4]);
  assert.equal(readRegularTiebreak({'1':[3,2]},2),null);
  assert.equal(regularSetFromTiebreak([0,0]),'6:6');
  assert.equal(regularSetFromTiebreak([6,6]),'6:6');
  assert.equal(regularSetFromTiebreak([7,6]),'6:6','7:6 TB points must keep game score at 6:6');
  assert.equal(regularSetFromTiebreak([7,5]),'7:6');
  assert.equal(regularSetFromTiebreak([5,7]),'6:7');
  assert.equal(regularSetFromTiebreak([8,6]),'7:6');
  assert.equal(regularSetFromTiebreak([10,12]),'6:7');
});

test('tie-break finishes only at >=7 and a lead of at least two, extending beyond 6:6',()=>{
  for(const score of [[0,0],[6,4],[6,6],[7,6],[7,7],[8,7],[9,8],[10,9]]){
    assert.equal(validateRegularTiebreak(score).valid,true);
    assert.equal(validateRegularTiebreak(score).complete,false,score.join(':'));
  }
  for(const score of [[7,0],[7,5],[5,7],[8,6],[6,8],[9,7],[15,13],[13,15]]){
    assert.equal(validateRegularTiebreak(score).valid,true);
    assert.equal(validateRegularTiebreak(score).complete,true,score.join(':'));
  }
  for(const score of [[8,5],[9,6],[10,7],[-1,2],[100,99],[1.2,3]]){
    assert.equal(validateRegularTiebreak(score).valid,false,score.join(':'));
  }
  assert.deepEqual(adjustRegularTiebreak([6,6],'tsv',1).points,[7,6]);
  assert.equal(adjustRegularTiebreak([7,6],'tsv',1).complete,true);
  assert.equal(adjustRegularTiebreak([7,5],'opponent',1).valid,false,'closed tie-break cannot continue');
  assert.equal(adjustRegularTiebreak([7,5],'tsv',-1).complete,false,'winner can undo last point');
  assert.equal(adjustRegularTiebreak([7,5],'opponent',-1).valid,false,'cannot rewrite history by subtracting loser point');
  assert.equal(adjustRegularTiebreak([0,0],'opponent',-1).valid,false);
});

test('finished and running regular sets show small tiebreak points for both players',()=>{
  const pointMap={'1':[8,6],'2':[7,9]};
  assert.deepEqual(regularSetDisplayValues('7:6',0,pointMap,true),
    {first:7,second:6,smallFirst:8,smallSecond:6});
  assert.deepEqual(regularSetDisplayValues('7:6',0,pointMap,false),
    {first:6,second:7,smallFirst:6,smallSecond:8});
  assert.deepEqual(regularSetDisplayValues('6:7',1,pointMap,true),
    {first:6,second:7,smallFirst:7,smallSecond:9});
  assert.deepEqual(regularSetDisplayValues('6:6',0,pointMap,true),
    {first:6,second:6,smallFirst:8,smallSecond:6});
  assert.equal(regularSetDisplayValues('7:6',0,null,true).smallSecond,null,'legacy 7:6 remains unchanged');
  const html=regularSetDisplayHtml('7:6',0,pointMap,true);
  assert.match(html,/ticker-set-side">7<sup class="ticker-set-tiebreak" aria-label="Tiebreak-Punkte 8">8<\/sup><\/span>/);
  assert.match(html,/ticker-set-side">6<sup class="ticker-set-tiebreak"/);
  assert.match(html,/aria-label="Tiebreak-Punkte 6"/);
  assert.match(html,/aria-label="Tiebreak-Punkte 8"/);
  const awayHtml=regularSetDisplayHtml('6:7',1,pointMap,false);
  assert.match(awayHtml,/aria-label="Tiebreak-Punkte 9"/);
  assert.match(awayHtml,/aria-label="Tiebreak-Punkte 7"/);
  assert.equal((awayHtml.match(/ticker-set-tiebreak/g)||[]).length,2);
  assert.equal((html.match(/ticker-set-tiebreak/g)||[]).length,2);
  assert.doesNotMatch(regularSetDisplayHtml('8:10',2,pointMap,true),/sup/,'match tie-break uses normal large digits');
});

test('admin +/- tie-break writes the same match encounter row through existing RLS',()=>{
  const admin=read('src/scripts/admin.ts');
  assert.match(admin,/data-enc-tb-step/);
  assert.match(admin,/adjustRegularTiebreak\(prior, side, delta\)/);
  assert.match(admin,/await persistSetScore\(index, score, undefined, points\)/);
  assert.match(admin,/tiebreak_points: tiebreakPoints/);
  assert.match(admin,/\.select\('id,result_text,status,tiebreak_points'\)/);
  assert.match(admin,/tiebreakMismatch/);
  assert.match(admin,/setScore !== '6:6'/);
  const tv=read('src/scripts/tv-live-ticker.ts');
  assert.match(tv,/tiebreak_points,winner,finished_at/);
  assert.match(tv,/tv-ticker__tb-point/);
  const pub=read('src/scripts/public.ts');
  assert.match(pub,/regularSetDisplayHtml/);
  const scorecenter=read('src/scripts/live-scorecenter.ts');
  assert.match(scorecenter,/ticker-set-score/);
  assert.match(scorecenter,/sides\[0\]\.innerHTML/);
  const migration=read('supabase/migrations/20261102214500_match_encounter_regular_tiebreak_points.sql');
  assert.match(migration,/alter table public\.match_encounters/);
  assert.doesNotMatch(migration,/create table|create policy/i);
});
