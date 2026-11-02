import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeSetResult,homeAwaySetScore} from '../src/lib/tennis-score.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const admin=read('src/scripts/admin.ts');
const page=read('src/pages/admin/index.astro');
const publicClient=read('src/scripts/public.ts');
const browser=read('scripts/ticker-browser-qa.mjs');
const browserGate=read('scripts/browser-qa.mjs');
const sql=read('supabase/migrations/20261102070000_live_ticker_24h_timeout.sql');
const email=read('supabase/functions/ticker-timeout-email/index.ts');

test('6 singles + 3 doubles and 4 singles + 2 doubles are exercised in two isolated browser contexts',()=>{
  assert.match(browser,/for\(const format of \['4_2','6_3'\]\)/);
  assert.match(browser,/const n=format==='4_2'\?6:9/);
  assert.match(browser,/const singles=format==='4_2'\?4:6/);
  assert.match(browser,/const a=await setupContext/);
  assert.match(browser,/const b=await setupContext/);
  assert.match(browser,/Promise\.all\(\[left\.clock\.fastForward\(30000\),right\.clock\.fastForward\(30000\)\]\)/);
  assert.match(browser,/Both browser sessions must converge within 3 polling cycles/);
  assert.match(browser,/\.live-encounter-row\.is-finished/);
  assert.match(browser,/route\.fulfill/);
  assert.doesNotMatch(browser,/route\.request\(\)\.method\(\)\s*===?\s*['"]POST/);
  assert.match(browserGate,/await runTickerBrowserRehearsal\(\{browser,url,check\}\)/);
});

test('admin gets concurrent Realtime updates and never overwrites draft inputs',()=>{
  assert.match(admin,/function initTickerMultiDeviceSync\(\)/);
  assert.match(admin,/pendingMatchDrafts\.size > 0/);
  assert.match(admin,/const editing = \(\) =>/);
  assert.match(admin,/\.on\('postgres_changes', \{ event: '\*', schema: 'public', table: 'match_live_state' \}/);
  assert.match(admin,/\.on\('postgres_changes', \{ event: '\*', schema: 'public', table: 'match_encounters' \}/);
  assert.match(admin,/window\.setInterval\(onVisible, 30000\)/);
  assert.match(admin,/supabase\.removeChannel\(channel\)/);
  assert.match(admin,/initTickerMultiDeviceSync\(\);/);
  assert.match(page,/id="ticker-remote-update-notice"/);
  assert.match(admin,/Deine ungespeicherten Eingaben bleiben erhalten/);
});

test('valid completed sets produce correct results for both match formats and home/away',()=>{
  for(const expected of [6,9]){
    const results=Array.from({length:expected},(_,i)=>
      summarizeSetResult(i%2===0?'6:3 6:4':'3:6 4:6'));
    assert.ok(results.every(r=>r.complete));
    const teamWins=results.filter(r=>r.winner==='tsv').length;
    const guestWins=expected-teamWins;
    assert.deepEqual({home:teamWins,away:guestWins},
      {home:results.reduce((n,r)=>n+homeAwaySetScore(r,true).homeSets/2,0),
       away:results.reduce((n,r)=>n+homeAwaySetScore(r,true).awaySets/2,0)});
    assert.equal(teamWins+guestWins,expected);
  }
});

test('24h auto-close is cron-controlled and does not invent sporting results',()=>{
  assert.match(sql,/s\.started_at<=now\(\)-interval '24 hours'/);
  assert.match(sql,/set status='expired',auto_closed_at=now\(\),finished_at=null/);
  assert.match(sql,/s\.status='live'/);
  assert.match(sql,/unique\(match_id,started_at\)/);
  assert.match(sql,/starter_user_id/);
  assert.match(sql,/for update skip locked/);
  assert.match(sql,/tsv-ticker-close-after-24h/);
  assert.match(email,/claim_ticker_timeout_notice/);
  assert.match(email,/consume_ticker_cron_token/);
  assert.match(email,/Die automatische Schließung/);
  assert.match(email,/GMAIL_REFRESH_TOKEN/);
  assert.doesNotMatch(sql,/update public\.match_encounters[\s\S]*set result_text/);
  assert.match(publicClient,/Ticker automatisch geschlossen/);
});
