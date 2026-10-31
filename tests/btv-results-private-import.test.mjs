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
  assert.doesNotMatch(workflow,/upload-artifact/);
  assert.match(workflow,/schedule:/);
  assert.match(workflow,/cron: '23 1,7,13,19 \* \* \*'/);
  assert.match(workflow,/github\.event_name == 'schedule'/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(text,/BTV_RESULTS_ONLY_SOMMER_2026/);
  assert.match(text,/ACTIVE_SEASONS\.map\(s=>s\.code\)/);
});


test('Sommer 2026 rescheduled 84-day official result is matched only when explicitly enabled',()=>{
  const original='2026-05-02T07:00:00Z';
  const official='2026-07-25T07:00:00Z';
  const source=[fixture('TS Jahn München II',false,official,'4:2')];
  const saved=[match('m1','TS Jahn München II',false,original)];
  const regular=selectOfficialResults(source,saved,ts,[],now);
  assert.equal(regular.updates.length,0);
  assert.equal(regular.farDate,1);
  const summer=selectOfficialResults(source,saved,ts,[],now,120);
  assert.deepEqual(summer.updates.map(x=>[x.id,x.score]),[['m1','4:2']]);
});

test('2026 extended window still excludes conflicting or ambiguous matches',()=>{
  const official='2026-07-25T07:00:00Z';
  const source=[fixture('TS Jahn München II',false,official,'4:2')];
  const original='2026-05-02T07:00:00Z';
  const wrongSide=[match('m1','TS Jahn München II',true,original)];
  assert.equal(selectOfficialResults(source,wrongSide,ts,[],now,120).updates.length,0);
  const duplicate=[match('m1','TS Jahn München II',false,original),
    match('m2','TS Jahn München II',false,original)];
  assert.equal(selectOfficialResults(source,duplicate,ts,[],now,120).updates.length,0);
  const tooFar=match('m3','TS Jahn München II',false,'2026-01-01T07:00:00Z');
  assert.equal(selectOfficialResults(source,[tooFar],ts,[],now,120).updates.length,0);
  assert.throws(()=>selectOfficialResults(source,[tooFar],ts,[],now,121),/INVALID_OFFICIAL_MATCH_DATE_WINDOW/);
  assert.match(text,/source\.code==='sommer-2026'\?120:45/);
});


test('both 2026 opponent-club fixtures are matched only to exact TSV team and home/away',()=>{
  const teams=new Map([['herren-50-ii','ts50'],['knaben-15-ii','ts15']]);
  const official=[
    {slug:'herren-50-ii',opponent:'ETC Siegertsbrunn II',isHome:false,
     startsAt:'2026-05-16T07:00:00Z',score:'3:3'},
    {slug:'knaben-15-ii',opponent:'STK Garching',isHome:false,
     startsAt:'2026-07-10T13:00:00Z',score:'5:1'}
  ];
  const stored=[
    {id:'m50',team_season_id:'ts50',opponent:'ETC Siegertsbrunn II',
     is_home:false,starts_at:'2026-05-16T07:00:00Z',btv_result_text:null},
    {id:'m15',team_season_id:'ts15',opponent:'STK Garching',
     is_home:false,starts_at:'2026-07-10T13:00:00Z',btv_result_text:null}
  ];
  assert.deepEqual(selectOfficialResults(official,stored,teams,[],now,120).updates
    .map(u=>[u.id,u.score]),[['m50','3:3'],['m15','5:1']]);
  assert.equal(selectOfficialResults(official,[{...stored[0],opponent:'TC Siegertsbrunn'},stored[1]],teams,[],now,120).updates.length,1);
  assert.equal(selectOfficialResults(official,[{...stored[0],is_home:true},stored[1]],teams,[],now,120).updates.length,1);
});
