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
  // In the synthetic second team an unfinished 6:6 tie-break is running.
  model.encounters[2]={...model.encounters[2],result_text:'6:6',tiebreak_points:{'1':[5,4]}};
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
  // Compare real DOM boundaries, not only CSS declarations: the first and
  // second player rows must be flush with the corresponding set-score cells.
  const assertAlignedScoreRows=async(label)=>{
    const boundaries=await page.evaluate(()=>{
      const game=document.querySelector('.tv-ticker__game.is-live');
      if(!game)return {missing:true};
      const playerRows=[...game.querySelectorAll('.tv-ticker__players>div')];
      const columns=[...game.querySelectorAll('.tv-ticker__set')];
      const rows=columns.map(col=>[...col.children].filter(el=>el.matches('span')));
      const r=el=>{const box=el.getBoundingClientRect();return {top:box.top,bottom:box.bottom}};
      return {players:playerRows.map(r),columns:rows.map(c=>c.map(r)),
        viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth};
    });
    assert.equal(boundaries.missing,undefined,label+' live game was not rendered');
    assert.equal(boundaries.players.length,2,label+' must have two name rows');
    assert.ok(boundaries.columns.length>=3,label+' must show all set columns');
    for(const [n,col] of boundaries.columns.entries()){
      assert.equal(col.length,2,label+' score column '+n+' has wrong number of rows');
      for(let i=0;i<2;i++){
        for(const edge of ['top','bottom']){
          const difference=Math.abs(boundaries.players[i][edge]-col[i][edge]);
          assert.ok(difference<=1.1,label+' misaligned '+edge+' for player '+i+', set column '+n+
            ' by '+difference.toFixed(1)+'px: '+JSON.stringify(boundaries));
        }
      }
    }
    assert.ok(boundaries.scrollWidth<=boundaries.viewport+3,label+' horizontal overflow');
  };
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
      await assertAlignedScoreRows('1920px TV');
    },page);
    await check('TV scoreboard: tie-break points are small beside each 6:6 game count',async()=>{
      const game=page.locator('[data-tv-match="'+ids[1]+'"] .tv-ticker__game.is-live');
      assert.equal(await game.locator('.tv-ticker__tb-point').count(),2,'live 6:6 should show points for both players');
      const points=await game.locator('.tv-ticker__tb-point').allTextContents();
      // This team is playing away, so the opponent comes first.
      assert.deepEqual(points,['4','5']);
      const sizes=await game.locator('.tv-ticker__set').first().evaluate(el=>({
        game:parseFloat(getComputedStyle(el.querySelector('.tv-ticker__set-value')).fontSize),
        small:parseFloat(getComputedStyle(el.querySelector('.tv-ticker__tb-point')).fontSize),
      }));
      assert.ok(sizes.small<sizes.game,'tiebreak superscripts must be visually smaller');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+3),true);
    },page);
    await check('TV scoreboard: compact laptop match header and rows',async()=>{
      await page.setViewportSize({width:1366,height:768});
      const match=page.locator('.tv-ticker__match').first();
      const metrics=await match.evaluate(el=>({
        heading:el.querySelector('.tv-ticker__match-head').getBoundingClientRect().height,
        score:el.querySelector('.tv-ticker__score').getBoundingClientRect().height,
        game:el.querySelector('.tv-ticker__game').getBoundingClientRect().height,
      }));
      assert.ok(metrics.heading<105,'laptop fixture heading too tall: '+JSON.stringify(metrics));
      assert.ok(metrics.score<105,'laptop scoreboard too tall: '+JSON.stringify(metrics));
      assert.ok(metrics.game<125,'laptop individual match too tall: '+JSON.stringify(metrics));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+3),true);
      await assertAlignedScoreRows('1366px laptop');
      await page.setViewportSize({width:1920,height:1080});
    },page);
    await check('TV scoreboard: two columns tablet, one smartphone',async()=>{
      await page.setViewportSize({width:1100,height:900});
      let grid=await page.locator('.tv-ticker__grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns);
      assert.equal(grid.trim().split(/\s+/).length,2);
      await page.setViewportSize({width:390,height:844});
      grid=await page.locator('.tv-ticker__grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns);
      assert.equal(grid.trim().split(/\s+/).length,1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+3),true,'mobile TV layout overflows');
      await assertAlignedScoreRows('390px phone');
      const compact=await page.evaluate(()=>{
        const r=selector=>document.querySelector(selector)?.getBoundingClientRect().height;
        return {header:r('.tv-ticker__header'),heading:r('.tv-ticker__match-head'),
          score:r('.tv-ticker__score'),game:r('.tv-ticker__game')};
      });
      assert.ok(compact.header<96,'phone title occupies too much space '+JSON.stringify(compact));
      assert.ok(compact.heading<110,'phone match title too tall '+JSON.stringify(compact));
      assert.ok(compact.score<98,'phone total scoreboard too tall '+JSON.stringify(compact));
      assert.ok(compact.game<128,'phone individual score too tall '+JSON.stringify(compact));
      assert.ok(await page.locator('.tv-ticker__player-logo').count()===3,'TSV logos must remain visible on phone');
      assert.equal(await page.locator('.tv-ticker__tb-point').count(),2,'tie-break digits must remain on phone');
      await page.setViewportSize({width:320,height:720});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+3),true,'320px ticker overflow');
      await assertAlignedScoreRows('320px phone');
      await page.setViewportSize({width:390,height:844});
    },page);
    await check('TV scoreboard: polls new scores every 30 seconds without navigation',async()=>{
      const first=page.locator('[data-tv-match="'+ids[0]+'"]');
      model.states[0]={...model.states[0],home_score:2,updated_at:new Date().toISOString()};
      model.encounters[0]={...model.encounters[0],status:'finished',winner:'tsv',finished_at:now,
        result_text:'6:2 7:6',tiebreak_points:{'2':[8,6]}};
      await new Promise(resolve=>setTimeout(resolve,350));
      await page.clock.fastForward(30000);
      await page.waitForFunction(id=>{
        const item=document.querySelector('[data-tv-match="'+id+'"]');
        return item?.querySelector('.tv-ticker__score-values strong')?.textContent?.trim()==='2' &&
          item.querySelectorAll('.tv-ticker__game.is-finished').length===1;
      },ids[0],{timeout:9000});
      assert.match(await first.locator('.tv-ticker__score').innerText(),/2/);
      // Even after the tiebreak is decided, both winner (8) and loser (6)
      // retain their small raised points next to the large 7:6 games.
      const raised=await first.locator('.tv-ticker__game.is-won .tv-ticker__tb-point').allTextContents();
      assert.deepEqual(raised,['8','6']);
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
    await check('Spieltag live modal: all name separators align with scores and tiebreaks',async()=>{
      await page.goto(url('/spieltag/'),{waitUntil:'domcontentloaded'});
      const modal=page.locator('#live-match-modal');
      await modal.waitFor({state:'attached',timeout:15000});
      await modal.evaluate(el=>{
        el.hidden=false;
        const body=el.querySelector('.live-match-modal__body');
        body.innerHTML=`<article class="ticker-running-encounter">
          <div class="ticker-running-encounter__line">
            <div class="ticker-running-encounter__player"><strong>TSV Feldkirchen Spieler</strong></div>
            <div class="ticker-running-encounter__result">
              <small>Zwischenstand</small>
              <strong data-split="true"><span>1</span><span>0</span></strong>
              <span class="ticker-running-encounter__sets" data-columns="true">
                <span class="ticker-running-encounter__set"><small>1</small>
                  <b>6<sup class="ticker-set-tiebreak">6</sup></b><b>6<sup class="ticker-set-tiebreak">8</sup></b>
                </span>
                <span class="ticker-running-encounter__set"><small>2</small><b>4</b><b>3</b></span>
                <span class="ticker-running-encounter__set"><small>3</small><b>–</b><b>–</b></span>
              </span>
            </div>
            <div class="ticker-running-encounter__player ticker-running-encounter__player--guest"><strong>Gegner 1</strong></div>
          </div></article>`;
      });
      for(const width of [1366,390,320]){
        await page.setViewportSize({width,height:900});
        const measurements=await page.evaluate(()=>{
          const root=document.querySelector('.live-match-modal__body .ticker-running-encounter__line');
          const names=[...root.querySelectorAll(':scope > .ticker-running-encounter__player')];
          const totals=[...root.querySelectorAll('.ticker-running-encounter__result>strong>span')];
          const sets=[...root.querySelectorAll('.ticker-running-encounter__set')].map(col=>[...col.querySelectorAll('b')]);
          const rect=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom}};
          const modal=document.querySelector('#live-match-modal');
          const sheet=modal.querySelector('.live-match-modal__sheet').getBoundingClientRect();
          const body=modal.querySelector('.live-match-modal__body');
          const scrollWidth=document.documentElement.scrollWidth;
          modal.hidden=true;
          const backgroundScrollWidth=document.documentElement.scrollWidth;
          modal.hidden=false;
          return {name:names.map(rect),total:totals.map(rect),sets:sets.map(col=>col.map(rect)),
            scrollWidth,backgroundScrollWidth,viewport:innerWidth,
            sheetLeft:sheet.left,sheetRight:sheet.right,bodyScroll:body.scrollWidth,bodyWidth:body.clientWidth};
        });
        assert.equal(measurements.name.length,2);
        assert.equal(measurements.total.length,2);
        for(const [name,rows] of [['total',measurements.total],...measurements.sets.map((x,i)=>['set '+(i+1),x])]){
          for(let i=0;i<2;i++)for(const edge of ['top','bottom']){
            const delta=Math.abs(measurements.name[i][edge]-rows[i][edge]);
            assert.ok(delta<=1.1,width+'px modal '+name+' '+edge+' is off by '+delta.toFixed(1)+'px: '+JSON.stringify(measurements));
          }
        }
        assert.ok(measurements.sheetLeft>=-1 && measurements.sheetRight<=measurements.viewport+1,
          width+'px modal exceeds viewport: '+JSON.stringify(measurements));
        assert.ok(measurements.bodyScroll<=measurements.bodyWidth+2,
          width+'px modal body overflows horizontally: '+JSON.stringify(measurements));
        assert.ok(measurements.scrollWidth<=Math.max(measurements.viewport+3,measurements.backgroundScrollWidth+2),
          width+'px modal introduces horizontal page overflow: '+JSON.stringify(measurements));
      }
    },page);

    await check('Admin ticker: compact three-set and TieBreak controls on laptop and phones',async()=>{
      await page.goto(url('/admin/'),{waitUntil:'domcontentloaded'});
      await page.evaluate(()=>{
        const mock=document.createElement('section');
        mock.id='compact-ticker-qa';
        mock.style.cssText='position:fixed;left:0;top:0;width:100vw;box-sizing:border-box;padding:8px;background:#fff;z-index:100000;overflow:hidden';
        mock.innerHTML=`<div id="panel-matches"><article class="match-admin-card">
          <div class="encounter-editor"><details class="encounter-card" open>
            <summary class="encounter-card__head"><span class="encounter-card__heading"><strong>Einzel 1</strong><small>TSV Spieler</small></span>
              <span class="encounter-card__score"><small>Sätze</small><strong>0:0</strong></span></summary>
            <div class="encounter-card__body">
              <div class="encounter-result-row"><div class="encounter-set-editor">
                <div class="encounter-set-editor__heading"><strong>Ergebnis</strong><span>TSV : Gegner</span></div>
                <div class="encounter-set-grid">${[1,2,3].map(i=>`
                  <div class="encounter-set-cell"><button class="encounter-set-button" type="button"><span>${i}. Satz</span><strong>6:6</strong></button>
                    <div class="encounter-set-steppers">${[0,1].map(j=>`
                      <div class="encounter-set-stepper"><button class="encounter-set-stepper__control">+</button>
                        <strong>${j===0?6:4}</strong><button class="encounter-set-stepper__control">−</button></div>`).join('')}</div>
                  </div>`).join('')}</div>
                <div class="encounter-tiebreaks"><section class="encounter-regular-tiebreak">
                  <strong class="encounter-regular-tiebreak__title">TieBreak</strong>
                  <div class="encounter-regular-tiebreak__counters">${['TSV','Gegner'].map((name,i)=>`
                    <div class="encounter-tiebreak-counter"><span class="encounter-tiebreak-counter__label">${name}</span>
                      <button class="encounter-set-stepper__control" data-enc-tb-delta="-1">−</button>
                      <strong>${i?4:5}</strong><button class="encounter-set-stepper__control">+</button></div>`).join('')}</div>
                </section></div>
                <p class="encounter-set-status"><strong>Sätze 0:0</strong></p>
              </div><div class="encounter-actions"><button class="button">Live anzeigen</button><button class="button ghost">Zurücksetzen</button></div></div>
              <details class="encounter-lineup"><summary>Aufstellung &amp; Gegner bearbeiten</summary></details>
            </div>
          </details></div></article></div>`;
        document.body.append(mock);
      });
      for(const width of [1366,390,320]){
        await page.setViewportSize({width,height:900});
        const m=await page.locator('#compact-ticker-qa').evaluate(root=>{
          const rect=e=>e.getBoundingClientRect();
          const cells=[...root.querySelectorAll('.encounter-set-cell')];
          const buttons=[...root.querySelectorAll('.encounter-set-stepper__control')];
          const tb=root.querySelector('.encounter-regular-tiebreak');
          const editor=root.querySelector('.encounter-set-editor');
          return {width:root.clientWidth,scroll:root.scrollWidth,
            cellHeights:cells.map(x=>rect(x).height),headerHeights:cells.map(x=>rect(x.querySelector('.encounter-set-button')).height),
            buttons:buttons.map(x=>({height:rect(x).height,left:rect(x).left,right:rect(x).right})),
            tbHeight:rect(tb).height,editorHeight:rect(editor).height,
            tbLabel:tb.querySelector('.encounter-regular-tiebreak__title').textContent,
            rowColumns:getComputedStyle(root.querySelector('.encounter-set-grid')).gridTemplateColumns.trim().split(/\s+/).length};
        });
        assert.equal(m.rowColumns,3,width+'px must retain all three sets');
        assert.equal(m.tbLabel,'TieBreak',width+'px verbose title');
        assert.ok(m.headerHeights.every(x=>x<=48),width+'px set headers still too tall '+JSON.stringify(m));
        assert.ok(m.cellHeights.every(x=>x<165),width+'px set cards still too tall '+JSON.stringify(m));
        assert.ok(m.buttons.every(x=>x.height>=32 && x.left>=-1 && x.right<=width+1),width+'px tap controls clipped '+JSON.stringify(m));
        assert.ok(m.tbHeight<110,width+'px TieBreak too tall '+JSON.stringify(m));
        assert.ok(m.editorHeight<315,width+'px editor still too tall '+JSON.stringify(m));
        assert.ok(m.scroll<=m.width+2,width+'px editor horizontal overflow '+JSON.stringify(m));
      }
    },page);
  }finally{await context.close();}
}
