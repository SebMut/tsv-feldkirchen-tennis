import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../scripts/btv-summer-missing-reconcile.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/btv-summer-missing-reconcile.yml',import.meta.url),'utf8');

test('only TSV 2026 summer schedule and season are compared',()=>{
  assert.match(source,/eaurnufdochjapfzqwvm/);
  assert.match(source,/getClubSchedule\(2026\)/);
  assert.match(source,/sommer-2026/);
  assert.match(source,/source\.length!==120/);
  assert.match(source,/matches\.length!==121/);
});
test('strict read-only: never update database or user live score',()=>{
  assert.doesNotMatch(source,/\.update\(|\.insert\(|\.upsert\(|\.delete\(|match_live_state|team_players|players/);
  assert.match(source,/OFFICIAL_SCORE_MISSED/);
  assert.match(source,/BTV_SOURCE_NO_RESULT/);
  assert.match(source,/OPPONENT_MISMATCH_SAME_DAY/);
});
test('secret only on protected main push; nothing uploaded',()=>{
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/github\.event_name == 'push'/);
  assert.match(workflow,/secrets\.BTV_SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(workflow,/upload-artifact|schedule:|cron:/);
});
