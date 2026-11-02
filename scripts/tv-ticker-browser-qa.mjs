/* Read-only TV ticker QA. Every public REST response used by this page is mocked.
   Synthetic fixtures cannot alter Supabase or any real live game. */
import assert from 'node:assert/strict';

export async function runTvTickerBrowserQA({browser, url, check}) {
  const ids=Array.from({length:3},(_,i)=>'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
  const seasonIds=Array.from({length:3},(_,i)=>'20000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
  const teamIds=Array.from({length:3},(_,i)=>'30000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
  const now=new Date().toISOString();
  const model={
    states:ids.map((id,i)=>({match_id:id,status:'live',home_score:i===1?1:0,away_score:0,started_at:now,updated_at:now})),
    matches:ids.map((id,i)=>({id,team_season_id:seasonIds[i],opponent:['TV Dürnbach II','TC Ismaning','TS Jahn München'][i],is_home:i!==1,starts_at:now,venue_name:'Tennisanlage',is_published:true})),
    encounters:ids.flatMap((id,i)=>[
      {match_id:id,discipline:'singles',position:1,status:'live',tsv_player_1_name:'TSV Spieler '+i,tsv_player_2_name:null,opponent_slot_1:1,opponent_slot_2:null,result_text:'6:2 3:2',updated_at:now},
      {match_id:id,discipline:'doubles',position:1,status:'scheduled',tsv_player_1_name:'Spieler A',tsv_player_2_name:'Spieler B',opponent_slot_1:1,opponent_slot_2:2,result_text:null,updated_at:now},
    ]),
    seasons:seasonIds.map((id,i)=>({id,team_id:teamIds[i],is_published:true})),
    teams:teamIds.map((id,i)=>({id,name:['Herren','Damen','Junioren'][i],active:true})),
  };
  const context=await browser.newContext({viewport:{width:1920,height:1080},locale:'de-DE',reducedMotion:'reduce'});
  await context.route(/\/rest\/v1\/site_settings\?/,async route => {
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify([{value:{poll_seconds:30,recap_every_seconds:300,recap_duration_seconds:30,highlight_seconds:300}}])});
  });
  await context.route(/\/rest\/v1\/(match_live_state|matches|match_encounters|team_seasons|teams)\?/,async route=>{
    const pathname=new URL(route.request().url()).pathname;
    const value=pathname.endsWith('/match_live_state')?model.states
      :pathname.endsWith('/matches')?model.matches
      :pathname.endsWith('/match_encounters')?model.encounters
      :pathname.endsWith('/team_seasons')?model.seasons:model.teams;
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(value)});
  });
  const page=await context.newPage();
  try{
    await page.clock.install();
    await page.goto(url('/spieltag/live-ticker/'),{waitUntil:'domcontentloaded'});
    await check('TV scoreboard: three independent fixtures and home-away ordering',async()=>{
      await page.locator('.tv-ticker__match').first().waitFor({state:'visible',timeout:15000});
      assert.equal(await page.locator('.tv-ticker__match').count(),3);
      assert.equal(await page.locator('.tv-ticker__game').count(),3);
      assert.equal(await page.locator('.tv-ticker__match.is-live').count(),0);
      assert.match(await page.locator('#tv-ticker-count').innerText(),/3 Begegnungen live/);
      assert.match(await page.locator('.tv-ticker__match').first().innerText(),/Herren gegen TV Dürnbach II/);
      assert.match(await page.locator('.tv-ticker__match').nth(1).locator('.tv-ticker__score-names').innerText(),/TC Ismaning[\s\S]*TSV Feldkirchen Damen/);
      assert.equal(await page.locator('.tv-ticker__game.is-live').count(),3);
      assert.equal(await page.locator('.tv-ticker__game.is-finished').count(),0);
      const css=await page.locator('.tv-ticker__grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns);
      assert.equal(css.trim().split(/\s+/).length,3,'TV width should show three fixture columns');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+3),true,'TV horizontal overflow');
    },page);
    await check('TV scoreboard: two columns tablet, one smartphone',async()=>{
      await page.setViewportSize({width:1100,height:900});
      let grid=await page.locator('.tv-ticker__grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns);
      assert.equal(grid.trim().split(/\s+/).length,2);
      await page.setViewportSize({width:390,height:844});
      grid=await page.locator('.tv-ticker__grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns);
      assert.equal(grid.trim().split(/\s+/).length,1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+3),true,'mobile TV layout overflows');
    },page);
    await check('TV scoreboard: polls new scores every 30 seconds without navigation',async()=>{
      const first=page.locator('[data-tv-match="'+ids[0]+'"]');
      model.states[0]={...model.states[0],home_score:2,updated_at:new Date().toISOString()};
      model.encounters[0]={...model.encounters[0],status:'finished',winner:'tsv',finished_at:now,result_text:'6:2 6:3'};
      await new Promise(resolve=>setTimeout(resolve,350));
      await page.clock.fastForward(30000);
      await page.waitForFunction(id=>{
        const item=document.querySelector('[data-tv-match="'+id+'"]');
        return item?.querySelector('.tv-ticker__score-values strong')?.textContent?.trim()==='2' &&
          item.querySelectorAll('.tv-ticker__game.is-finished').length===1;
      },ids[0],{timeout:9000});
      assert.match(await first.locator('.tv-ticker__score').innerText(),/2/);
      assert.equal(await first.locator('.tv-ticker__game.is-won.is-celebrating').count(),1);
      assert.equal(await first.locator('.tv-ticker__game .tv-ticker__player-logo').count(),1);
      assert.match(await first.locator('.tv-ticker__game.is-won').innerText(),/🏆/);
      assert.match(await page.locator('#tv-ticker-countdown').innerText(),/\d+ s/);
      assert.equal(await page.locator('.tv-ticker__match').count(),3);
    },page);
    await check('TV scoreboard: defeat uses red indication, completed scores recap after five minutes',async()=>{
      model.encounters[2]={...model.encounters[2],status:'finished',winner:'opponent',finished_at:now,result_text:'1:6 2:6'};
      await page.clock.fastForward(30000);
      await page.waitForFunction(()=>document.querySelectorAll('.tv-ticker__game.is-lost').length===1,null,{timeout:9000});
      assert.match(await page.locator('.tv-ticker__game.is-lost').innerText(),/😢/);
      // After five minutes, previous results appear during the 30-second recap window.
      await page.clock.fastForward(240000);
      await page.waitForFunction(()=>document.querySelectorAll('.tv-ticker__game.is-finished').length>=2,null,{timeout:9000});
      assert.match(await page.locator('#tv-ticker-recap').innerText(),/Rückblick/);
      await page.clock.fastForward(31000);
      await page.waitForFunction(()=>document.querySelectorAll('.tv-ticker__game.is-finished').length===0,null,{timeout:9000});
    },page);
    await check('TV scoreboard: one live fixture spans the full TV width',async()=>{
      await page.setViewportSize({width:1920,height:1080});
      model.states=model.states.slice(0,1);
      // A previous polling request can still be settling after a fake-clock jump.
      // The real TV retries every cycle, so advance up to three intervals.
      for(let attempt=0;attempt<3 && await page.locator('.tv-ticker__match').count()!==1;attempt++){
        await new Promise(resolve=>setTimeout(resolve,350));
        await page.clock.fastForward(30000);
        for(let n=0;n<12 && await page.locator('.tv-ticker__match').count()!==1;n++)
          await new Promise(resolve=>setTimeout(resolve,125));
      }
      assert.equal(await page.locator('.tv-ticker__match').count(),1,'only the still-running team should be present');
      assert.equal(await page.locator('.tv-ticker__grid--single').count(),1);
      const grid=await page.locator('.tv-ticker__grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns);
      assert.equal(grid.trim().split(/\s+/).length,1,'one live team must use full horizontal room');
    },page);
  }finally{await context.close();}
}
