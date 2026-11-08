// Browser QA for the explicitly isolated, noindex staging demo.
// All data is synthetic; no Supabase writes, no user credentials required.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const base=(process.env.PREVIEW_BASE||'/').replace(/\/$/,'');
const origin='http://127.0.0.1:4321';
const url=origin+base+'/forderungspyramide/?demo=1';
let server,browser;
let logs='';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function checkDevice(name,viewport,isMobile){
  const context=await browser.newContext({viewport,isMobile,hasTouch:isMobile,locale:'de-DE',timezoneId:'Europe/Berlin'});
  const page=await context.newPage();
  const errors=[],writes=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{
    if(/supabase\.co/.test(request.url()) && !['GET','HEAD','OPTIONS'].includes(request.method()))
      writes.push(request.method()+' '+request.url());
  });
  try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(response?.status(),200,'Preview HTTP status');
    await page.locator('[data-demo-mode="true"]').waitFor();
    assert.equal(await page.locator('meta[name="robots"][content="noindex,nofollow"]').count(),1);
    assert.equal(await page.locator('#pyramid-app').isVisible(),true);
    assert.equal(await page.locator('#pyramid-login-form').isHidden(),true);
    assert.equal(await page.locator('.pyramid-entry:not(.is-empty)').count(),15);
    assert.equal(await page.locator('#pyramid-demo-role').inputValue(),'admin');
    // A challenge from place #15 to #13 must be a real clickable browser action.
    await page.locator('button[data-pyramid-challenge="demo-entry-13"]').click();
    assert.match(await page.locator('#pyramid-status').innerText(),/Forderung gegen Spieler 13 erstellt/);
    assert.equal(await page.locator('#pyramid-games .pyramid-game').count(),3);
    // The defender can accept an existing incoming challenge.
    await page.locator('#pyramid-demo-role').selectOption('demo-user-13');
    await page.locator('button[data-pyramid-accept="demo-game-2"]').click();
    assert.match(await page.locator('#pyramid-status').innerText(),/Forderung angenommen/);
    // Open and close a dialog with Escape and re-open for a real score submission.
    await page.locator('#pyramid-demo-role').selectOption('admin');
    await page.locator('button[data-pyramid-result="demo-game-2"]').click();
    assert.equal(await page.locator('#pyramid-dialog').isVisible(),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#pyramid-dialog').isHidden(),true);
    await page.locator('button[data-pyramid-result="demo-game-2"]').click();
    await page.locator('#pyramid-result-winner').selectOption('demo-entry-14');
    await page.locator('#pyramid-result-score').fill('6:4, 6:3');
    await page.locator('#pyramid-result-form button[type="submit"]').click();
    assert.equal(await page.locator('#pyramid-dialog').isHidden(),true);
    assert.match(await page.locator('#pyramid-status').innerText(),/Rangliste wurde neu sortiert/);
    const updatedRank=page.locator('#pyramid-board .pyramid-entry').filter({hasText:'Spieler 14'});
    assert.match(await updatedRank.innerText(),/#13/);
    // The SuperAdmin can sort the initial positions in this ephemeral mock.
    await page.locator('button[data-pyramid-move="demo-entry-2"][data-delta="-1"]').click();
    assert.match(await page.locator('#pyramid-board .pyramid-entry').filter({hasText:'Spieler 2'}).innerText(),/#1/);
    // Membership request and approval in two distinct demo roles.
    await page.locator('#pyramid-demo-role').selectOption('demo-guest');
    await page.locator('#pyramid-display-name').fill('Test-Mitglied');
    await page.locator('#pyramid-join-form button[type="submit"]').click();
    assert.match(await page.locator('#pyramid-join-state').innerText(),/wartet auf Freigabe/);
    await page.locator('#pyramid-demo-role').selectOption('admin');
    const row=page.locator('#pyramid-admin-requests .pyramid-admin-item').filter({hasText:'Test-Mitglied'});
    await row.locator('button[data-pyramid-approve]').click();
    assert.equal(await page.locator('.pyramid-entry:not(.is-empty)').count(),16);
    // Season switch and creating an additional test list must also respond.
    await page.locator('#pyramid-ladder-select').selectOption('demo-summer');
    assert.equal(await page.locator('.pyramid-entry:not(.is-empty)').count(),6);
    await page.locator('#pyramid-new-name').fill('Neue Testgruppe');
    await page.locator('#pyramid-new-season').fill('Winter 2027/2028');
    await page.locator('#pyramid-new-start').fill('2027-11-01');
    await page.locator('#pyramid-new-end').fill('2028-03-31');
    await page.locator('#pyramid-create-form button[type="submit"]').click();
    assert.match(await page.locator('#pyramid-ladder-heading').innerText(),/Neue Testgruppe/);
    assert.equal(await page.locator('.pyramid-entry:not(.is-empty)').count(),0);
    await page.locator('#pyramid-demo-reset').click();
    assert.equal(await page.locator('.pyramid-entry:not(.is-empty)').count(),15);
    assert.equal(await page.locator('#pyramid-demo-role').inputValue(),'admin');
    assert.deepEqual(errors,[],name+' page errors');
    assert.deepEqual(writes,[],name+' demo tried to write to Supabase');
    const overflow=await page.evaluate(()=>({
      document:document.documentElement.scrollWidth,
      width:innerWidth,
      body:document.body.scrollWidth
    }));
    assert.ok(overflow.document<=overflow.width+3&&overflow.body<=overflow.width+3,
      name+' horizontal overflow '+JSON.stringify(overflow));
    console.log('PASS '+name+': interactive buttons, challenge, acceptance, score, ranking, approvals, group creation, reset, privacy, responsive');
  }finally{await context.close();}
}
try{
  server=spawn('node_modules/.bin/astro',['preview','--host','127.0.0.1','--port','4321','--strictPort'],{
    env:{...process.env,PREVIEW_BASE:process.env.PREVIEW_BASE||'/'},
    stdio:['ignore','pipe','pipe']
  });
  server.stdout.on('data',data=>{logs=(logs+String(data)).slice(-4000);});
  server.stderr.on('data',data=>{logs=(logs+String(data)).slice(-4000);});
  let started=false;
  for(let i=0;i<65;i++){
    if(server.exitCode!==null)throw Error('Preview stopped: '+logs);
    try{const response=await fetch(origin+base+'/forderungspyramide/',{signal:AbortSignal.timeout(1000)});
      if(response.ok){started=true;break;}
    }catch{}
    await sleep(350);
  }
  if(!started)throw Error('Preview did not start '+logs);
  browser=await chromium.launch({headless:true});
  await checkDevice('desktop',{width:1440,height:900},false);
  await checkDevice('mobile',{width:390,height:844},true);
  await checkDevice('small-mobile',{width:320,height:640},true);
}catch(error){
  console.error(error?.stack||error);process.exitCode=1;
}finally{
  await browser?.close();
  if(server?.exitCode===null)server.kill('SIGTERM');
  server?.stdout?.destroy();server?.stderr?.destroy();server?.unref();
}
