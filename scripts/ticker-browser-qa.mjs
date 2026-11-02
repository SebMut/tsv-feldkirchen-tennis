/**
 * Non-mutating two-browser ticker rehearsal: official UI, synthetic matches/
 * encounters and a shared mock read-model. The actual public Supabase database
 * is never updated and no authenticated test person is involved.
 *
 * This verifies the 30s polling recovery path across independently running
 * Chromium contexts; genuine WebSocket propagation requires a dedicated
 * isolated writable test match and test credentials (reported separately).
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/supabase.ts',import.meta.url),'utf8');
const projectUrl='https://eaurnufdochjapfzqwvm.supabase.co';
const publicKey=process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  source.match(/sb_publishable_[A-Za-z0-9_]+/)?.[0];

async function referenceMatch() {
  assert.ok(publicKey,'public project key not found');
  const res=await fetch(projectUrl+'/rest/v1/matches?select=id&is_published=eq.true&order=starts_at.desc&limit=1',{
    headers:{apikey:publicKey,Authorization:'Bearer '+publicKey},
    signal:AbortSignal.timeout(9000),
  });
  assert.equal(res.status,200,'public match fixture lookup');
  const matches=await res.json();
  assert.ok(matches.length>0,'at least one published match is required');
  return matches[0].id;
}
function fakeEncounter(matchId,format,index){
  const singles=format==='4_2'?4:6;
  const single=index<singles;
  const n=single?index+1:index-singles+1;
  return {
    id:'00000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),
    match_id:matchId,discipline:single?'singles':'doubles',position:n,
    tsv_player_1_id:null,tsv_player_2_id:null,
    tsv_player_1_name:'Testspieler '+String(index+1),
    tsv_player_2_name:single?null:'Testspieler '+String(index+101),
    opponent_slot_1:n,opponent_slot_2:single?null:n+1,
    status:'scheduled',winner:null,result_text:null,sort_order:single?n:100+n,
  };
}
function createModel(matchId,format){
  const n=format==='4_2'?6:9;
  return {
    encounters:Array.from({length:n},(_,i)=>fakeEncounter(matchId,format,i)),
    state:{
      match_id:matchId,status:'live',home_score:0,away_score:0,
      updated_at:new Date().toISOString(),
    },
  };
}
async function setupContext(browser,model,matchId,format,device){
  const context=await browser.newContext({
    viewport:device==='mobile'?{width:390,height:844}:{width:1440,height:900},
    isMobile:device==='mobile',hasTouch:device==='mobile',
    locale:'de-DE',reducedMotion:'reduce',
  });
  await context.route(/\/rest\/v1\/(match_encounters|match_live_state)\?/,async(route)=>{
    const api=new URL(route.request().url());
    const matchParam=api.searchParams.get('match_id');
    if(matchParam!=='eq.'+matchId)return route.continue();
    const isEncounter=api.pathname.endsWith('match_encounters');
    const value=isEncounter?model.encounters:[model.state];
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(value)});
  });
  // Return the actual public match but overlay the tested format in memory.
  await context.route(/\/rest\/v1\/matches\?/,async(route)=>{
    const api=new URL(route.request().url());
    if(api.searchParams.get('id')!=='eq.'+matchId)return route.continue();
    const response=await route.fetch();
    const data=await response.json();
    await route.fulfill({response,body:JSON.stringify(
      data.map(m=>({...m,lineup_format:format,btv_result_text:null})))});
  });
  return context;
}
export async function runTickerBrowserRehearsal({browser,url,check}){
  const matchId=await referenceMatch();
  for(const format of ['4_2','6_3']){
    const model=createModel(matchId,format);
    const a=await setupContext(browser,model,matchId,format,'desktop');
    const b=await setupContext(browser,model,matchId,format,'mobile');
    const left=await a.newPage(),right=await b.newPage();
    try{
      await check('ticker '+format+' two-context initial lineup',async()=>{
        await Promise.all([left.clock.install(),right.clock.install()]);
        await Promise.all([
          left.goto(url('/live/?match='+matchId)),
          right.goto(url('/live/?match='+matchId)),
        ]);
        const wanted=format==='4_2'?6:9;
        await Promise.all([
          left.locator('.live-encounter-row').first().waitFor({state:'attached',timeout:14000}),
          right.locator('.live-encounter-row').first().waitFor({state:'attached',timeout:14000}),
        ]);
        for(const page of [left,right]){
          assert.equal(await page.locator('.live-encounter-row').count(),wanted);
          assert.equal(await page.locator('.live-encounter-number').filter({hasText:/^E[1-6]$/}).count(),
            format==='4_2'?4:6);
          assert.equal(await page.locator('.live-encounter-number').filter({hasText:/^D[1-3]$/}).count(),
            format==='4_2'?2:3);
        }
      },left);
      await check('ticker '+format+' two-context polling convergence',async()=>{
        model.encounters[0]={...model.encounters[0],status:'finished',result_text:'6:3 6:4',winner:'tsv'};
        model.state={...model.state,home_score:1,updated_at:new Date().toISOString()};
        await Promise.all([left.clock.fastForward(30000),right.clock.fastForward(30000)]);
        await Promise.all([left.locator('#live-scoreboard-never-exists').count(),right.locator('#live-scoreboard-never-exists').count()]);
        await Promise.all([left.waitForFunction(()=>document.querySelectorAll('.live-encounter-row.is-finished').length===1,{timeout:9000}),
          right.waitForFunction(()=>document.querySelectorAll('.live-encounter-row.is-finished').length===1,{timeout:9000})]);
        for(const page of [left,right]){
          assert.match(await page.locator('#live-score').innerText(),/1/);
          assert.equal(await page.locator('.live-encounter-row.is-finished').count(),1);
        }
      },right);
    }finally{await a.close();await b.close();}
  }
}
