import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeSetResult, validateSetScore, homeAwaySetScore} from '../src/lib/tennis-score.mjs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('manual first set 3:2 is visible as interim and must not count as set victory',()=>{
  const score=summarizeSetResult('3:2');
  assert.deepEqual(score.scores,['3:2','','']);
  assert.equal(score.tsvSets,0);
  assert.equal(score.opponentSets,0);
  assert.equal(score.inProgressSetIndex,0);
  assert.equal(score.winner,null);
  assert.equal(score.complete,false);
  assert.equal(score.hasResult,true);
});

test('manual interim second set preserves finished first set and later can finish it',()=>{
  const midway=summarizeSetResult('6:3 3:2');
  assert.deepEqual(midway.scores,['6:3','3:2','']);
  assert.deepEqual([midway.tsvSets,midway.opponentSets],[1,0]);
  assert.equal(midway.inProgressSetIndex,1);
  assert.equal(midway.complete,false);
  const end=summarizeSetResult('6:3 6:4');
  assert.deepEqual([end.tsvSets,end.opponentSets],[2,0]);
  assert.equal(end.winner,'tsv');
  assert.equal(end.complete,true);
});

test('third-set interim Match-Tiebreak remains live until 10+ and 2 points ahead',()=>{
  const inProgress=summarizeSetResult('6:3 3:6 8:7');
  assert.deepEqual(inProgress.scores,['6:3','3:6','8:7']);
  assert.deepEqual([inProgress.tsvSets,inProgress.opponentSets],[1,1]);
  assert.equal(inProgress.inProgressSetIndex,2);
  assert.equal(inProgress.winner,null);
  const nineNine=summarizeSetResult('6:3 3:6 9:9');
  assert.equal(nineNine.winner,null);
  const tenNine=summarizeSetResult('6:3 3:6 10:9');
  assert.equal(tenNine.complete,false);
  const end=summarizeSetResult('6:3 3:6 15:13');
  assert.equal(end.winner,'tsv');
  assert.deepEqual([end.tsvSets,end.opponentSets],[2,1]);
  const loss=summarizeSetResult('6:3 3:6 12:14');
  assert.equal(loss.winner,'opponent');
  assert.deepEqual([loss.tsvSets,loss.opponentSets],[1,2]);
});

test('new interim set blocks a subsequent set and never yields a premature winner',()=>{
  const changed=summarizeSetResult('4:3 6:0');
  assert.deepEqual(changed.scores,['4:3','','']);
  assert.equal(changed.winner,null);
  assert.equal(changed.complete,false);
  const tiebreakEarly=summarizeSetResult('6:4 2:3 10:8');
  assert.deepEqual(tiebreakEarly.scores,['6:4','2:3','']);
  assert.equal(tiebreakEarly.winner,null);
  const straight=summarizeSetResult('6:4 7:6 10:8');
  assert.deepEqual(straight.scores,['6:4','7:6','']);
  assert.equal(straight.winner,'tsv');
});

test('validates realistic manual scores while keeping all quick-choice final scores',()=>{
  for(const [v,i] of [['0:0',0],['3:2',0],['5:5',1],['6:5',0],['6:6',0],
    ['7:6',0],['6:7',1],['8:7',2],['10:9',2],['11:10',2],['15:13',2],['0:10',2]]) {
    assert.equal(validateSetScore(v,i).valid,true,v);
  }
  for(const [v,i] of [['7:7',0],['8:1',0],['7:4',1],['11:0',2],['14:12',0],
    ['5:8',1],['2:3',3],['',0],['-1:2',1]]) {
    assert.equal(validateSetScore(v,i).valid,false,v);
  }
  for(const [v,i] of [['6:0',0],['7:5',1],['7:6',0],['10:0',2],['14:12',2]]) {
    assert.equal(validateSetScore(v,i).complete,true,v);
  }
});

test('away fixtures display interim set values reversed without changing TSV winner',()=>{
  const result=summarizeSetResult('6:4 2:3');
  assert.deepEqual(homeAwaySetScore(result,false),{homeSets:0,awaySets:1});
  assert.equal(result.inProgressSetIndex,1);
});

test('admin modal supports manual input on all three sets without changing preset choices',()=>{
  const page=read('src/pages/admin/index.astro');
  const admin=read('src/scripts/admin.ts');
  for(const id of ['encounter-set-dialog-manual','encounter-set-dialog-manual-form','encounter-set-manual-tsv',
    'encounter-set-manual-opponent','encounter-set-dialog-manual-error']) {
    assert.ok(page.includes('id="'+id+'"'),id);
  }
  assert.ok(page.includes('Zwischenstand speichern'));
  assert.ok(admin.includes('manualForm.onsubmit = (event) =>'));
  assert.ok(admin.includes('validateSetScore(enteredScore, setIndex)'));
  assert.ok(admin.includes('const maxScore = setIndex === 2 ? 99 : 7'));
  assert.ok(admin.includes('return summarizeSetResult(resultText).scores'));
  assert.ok(admin.includes('const thirdSetAllowed = afterTwoSets.tsvSets === 1 && afterTwoSets.opponentSets === 1'));
  assert.ok(admin.includes('Folgesätze werden entfernt'));
  assert.ok(admin.includes('data-enc-set="${index}"'));
  assert.ok(admin.includes('regularSetScores'));
  assert.ok(admin.includes('matchTieBreakScores'));
  const css=read('src/styles/global.css');
  assert.ok(css.includes('.encounter-set-dialog__manual-inputs'));
  assert.ok(css.includes('.encounter-set-dialog__manual>summary:focus-visible'));
});

test('running-set progress is shown on public match and live overview',()=>{
  const script=read('src/scripts/public.ts');
  assert.ok(script.includes('result.inProgressSetIndex'));
  assert.ok(script.includes('summary.inProgressSetIndex'));
  assert.ok(script.includes('live-set-in-progress'));
  assert.ok(script.includes('ticker-running-encounter__current'));
  assert.ok(script.includes("currentSet.split(':').reverse().join(':')"));
});
