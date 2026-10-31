import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {selectOfficialResults} from '../scripts/btv-results-match.mjs';
const text=readFileSync(new URL('../scripts/btv-results-import.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/btv-results-private-import.yml',import.meta.url),'utf8');
const ts=new Map([['herren','ts1']]);
const now=Date.parse('2026-10-31T17:00:00Z');
const match=(id,name,home,start,btv=null)=>({
  id,team_season_id:'ts1',opponent:name,is_home:home,starts_at:start,btv_result_text:btv
});
const fixture=(name,home,date,score)=>({slug:'herren',opponent:name,isHome:home,
  startsAt:date,score});

test('only exact official source pairing home/away and opponent updates',()=>{
  const date='2026-06-01T14:00:00Z';
  const source=[fixture('TC Muster',true,date,'6:3'),
    fixture('TC Test',false,date,'3:6')];
  const db=[match('m1','TC Muster',true,date),match('m2','TC Test',false,date)];
  const result=selectOfficialResults(source,db,ts,[],now);
  assert.deepEqual(result.updates.map(x=>[x.id,x.score]),[['m1','6:3'],['m2','3:6']]);
  assert.equal(result.unmatched,0);
});

test('source without score, ambiguous fixtures, and official 0:0 do not update',()=>{
  const date='2026-06-01T14:00:00Z';
  const result=selectOfficialResults([
    fixture('TC Muster',true,date,'0:0'),
    fixture('TC Test',true,date,null),
    fixture('TC Test',false,date,'3:3'),
  ],[match('m1','TC Test',false,date),match('m2','TC Test',false,date)],ts,[],now);
  assert.equal(result.updates.length,0);
  assert.equal(result.withoutResult,2);
  assert.equal(result.ambiguous,1);
});

test('do not overwrite existing BTV scores or manually finished live ticker',()=>{
  const date='2026-06-01T14:00:00Z';
  const source=[fixture('TC Muster',true,date,'6:3'),fixture('TC Test',false,date,'3:6')];
  const db=[match('m1','TC Muster',true,date,'2:7'),match('m2','TC Test',false,date)];
  const state=[{match_id:'m2',status:'finished',home_score:6,away_score:3}];
  const result=selectOfficialResults(source,db,ts,state,now);
  assert.equal(result.updates.length,0);
  assert.equal(result.oldConflict,2);
});

test('live, future and stale/unsupported fixtures are never edited',()=>{
  const date='2026-06-01T14:00:00Z';
  const source=[fixture('TC Muster',true,date,'6:3'),fixture('TC Zukunft',true,'2027-05-01T14:00:00Z','6:0')];
  const db=[match('m1','TC Muster',true,date),match('m2','TC Zukunft',true,'2027-05-01T14:00:00Z')];
  const res=selectOfficialResults(source,db,ts,[{match_id:'m1',status:'live'}],now);
  assert.equal(res.live,1);
  assert.equal(res.future,1);
  assert.equal(res.updates.length,0);
});

test('repository and secret scope are strictly restricted, only score fields change',()=>{
  assert.match(text,/eaurnufdochjapfzqwvm/);
  assert.match(text,/BTV_RESULTS_WRITE_ENABLED/);
  assert.match(text,/btv_result_text:u\.score,btv_last_synced_at/);
  assert.doesNotMatch(text,/venue_address:u\.|venue_name:u\.|is_home:u\.|home_score:u\.|away_score:u\./);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/github\.event_name == 'push'/);
  assert.match(workflow,/secrets\.BTV_SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(workflow,/upload-artifact|schedule:|cron:/);
});
