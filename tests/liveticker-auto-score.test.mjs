import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeSetResult, homeAwaySetScore} from '../src/lib/tennis-score.mjs';

const source=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('one finished set is a live interim score, never a final result',()=>{
  const tsvLead=summarizeSetResult('6:3');
  assert.deepEqual([tsvLead.tsvSets,tsvLead.opponentSets], [1,0]);
  assert.equal(tsvLead.complete,false);
  assert.equal(tsvLead.winner,null);
  const opponentLead=summarizeSetResult('1:6');
  assert.deepEqual([opponentLead.tsvSets,opponentLead.opponentSets],[0,1]);
  assert.equal(opponentLead.winner,null);
  const tied=summarizeSetResult('6:4 3:6');
  assert.deepEqual([tied.tsvSets,tied.opponentSets],[1,1]);
  assert.equal(tied.complete,false);
});

test('straight-sets 2:0 and 0:2 determine winner without a third set',()=>{
  const tsv=summarizeSetResult('6:3 7:6');
  assert.deepEqual([tsv.tsvSets,tsv.opponentSets], [2,0]);
  assert.equal(tsv.winner,'tsv');
  assert.equal(tsv.complete,true);
  const opponent=summarizeSetResult('3:6 4:6');
  assert.deepEqual([opponent.tsvSets,opponent.opponentSets],[0,2]);
  assert.equal(opponent.winner,'opponent');
  assert.equal(opponent.complete,true);
  const ignored=summarizeSetResult('6:3 6:4 10:8');
  assert.deepEqual(ignored.scores,['6:3','6:4','']);
  assert.equal(ignored.winner,'tsv');
});

test('match tiebreak resolves 2:1 or 1:2 only after split sets',()=>{
  const tsv=summarizeSetResult('6:3 4:6 11:9');
  assert.deepEqual([tsv.tsvSets,tsv.opponentSets],[2,1]);
  assert.equal(tsv.winner,'tsv');
  const opponent=summarizeSetResult('3:6 6:4 9:11');
  assert.deepEqual([opponent.tsvSets,opponent.opponentSets],[1,2]);
  assert.equal(opponent.winner,'opponent');
  const unfinished=summarizeSetResult('6:3 4:6');
  assert.deepEqual([unfinished.tsvSets,unfinished.opponentSets],[1,1]);
  assert.equal(unfinished.winner,null);
});

test('home and away mapping preserve correct match winner and reverse display',()=>{
  const fieldkirchenWinner=summarizeSetResult('6:2 6:3');
  const guestWinner=summarizeSetResult('2:6 3:6');
  assert.deepEqual(homeAwaySetScore(fieldkirchenWinner,true),{homeSets:2,awaySets:0});
  assert.deepEqual(homeAwaySetScore(guestWinner,true),{homeSets:0,awaySets:2});
  assert.deepEqual(homeAwaySetScore(fieldkirchenWinner,false),{homeSets:0,awaySets:2});
  assert.deepEqual(homeAwaySetScore(guestWinner,false),{homeSets:2,awaySets:0});
  assert.equal(fieldkirchenWinner.winner,'tsv');
  assert.equal(guestWinner.winner,'opponent');
});

test('invalid or missing scores cannot prematurely finish a match',()=>{
  for (const text of ['', '6:3', '6:3 4:6', '7:7', '10:8']) {
    assert.equal(summarizeSetResult(text).complete,false);
  }
  assert.equal(summarizeSetResult('6:3 4:6 12:10').winner,'tsv');
});

test('admin has Live anzeigen and publishes finished result automatically',()=>{
  const admin=source('src/scripts/admin.ts');
  assert.match(admin,/data-enc-live>Live anzeigen/);
  assert.doesNotMatch(admin,/data-enc-winner="tsv"/);
  assert.doesNotMatch(admin,/data-enc-winner="opponent"/);
  assert.match(admin,/normalized\.complete \? 'finished'/);
  assert.match(admin,/winner: normalized\.winner/);
  assert.match(admin,/await ensureMatchLive\(\)/);
  assert.match(admin,/updateEncounter\(encounterId, patch\)/);
});

test('public ticker hides prepared scores and marks live vs final from home and away perspective',()=>{
  const publicScript=source('src/scripts/public.ts');
  assert.match(publicScript,/encounter\.status === 'scheduled'\) return '<span>Ergebnis<\/span><strong>–<\/strong>'/);
  assert.match(publicScript,/homeAwaySetScore\(result, !!match\.is_home\)/);
  assert.match(publicScript,/final \? 'Endstand' : 'Zwischenstand'/);
  assert.match(publicScript,/Sätze:/);
  assert.match(publicScript,/publicEncounterSetResult\(match, encounter\)/);
});
