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
    // TSV: a pending request blocks BOTH players. Player 13 is already
    // in game #2; player 15 can instead challenge an unengaged player #12.
    assert.equal(await page.locator('button[data-pyramid-challenge="demo-entry-13"]').count(),0);
    await page.locator('button[data-pyramid-challenge="demo-entry-12"]').click();
    assert.match(await page.locator('#pyramid-status').innerText(),/Forderung gegen Spieler 12 erstellt/);
    assert.equal(await page.locator('#pyramid-games .pyramid-game').count(),3);
    assert.match(await page.locator('#pyramid-demo-mails').innerText(),/Spieler 12/);
    assert.equal(await page.locator('button[data-pyramid-challenge="demo-entry-11"]').count(),0,
      'Player with a pending match cannot issue another challenge.');
    // The defender accepts, then the winner reports the score; no ranks change before confirmation.
    await page.locator('#pyramid-demo-role').selectOption('demo-user-12');
    await page.locator('button[data-pyramid-accept="demo-challenge-31"]').click();
    assert.match(await page.locator('#pyramid-status').innerText(),/Forderung angenommen/);
    await page.locator('#pyramid-demo-role').selectOption('admin');
    await page.locator('button[data-pyramid-result="demo-challenge-31"]').click();
    assert.equal(await page.locator('#pyramid-dialog').isVisible(),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#pyramid-dialog').isHidden(),true);
    await page.locator('button[data-pyramid-result="demo-challenge-31"]').click();
    await page.locator('#pyramid-result-winner').selectOption('demo-entry-15');
    await page.locator('#pyramid-result-score').fill('6:4, 6:3');
    await page.locator('#pyramid-result-form button[type="submit"]').click();
    assert.equal(await page.locator('#pyramid-dialog').isHidden(),true);
    assert.match(await page.locator('#pyramid-status').innerText(),/wartet auf Bestätigung/);
    const ownTile=page.locator('#pyramid-board .pyramid-entry').filter({hasText:'Musterperson'});
    assert.match(await ownTile.innerText(),/#15/,'Master: rank must NOT change on result submission');
    await page.locator('#pyramid-demo-role').selectOption('demo-user-12');
    assert.equal(await page.locator('button[data-pyramid-confirm="demo-challenge-31"]').count(),1);
    await page.locator('button[data-pyramid-confirm="demo-challenge-31"]').click();
    assert.match(await page.locator('#pyramid-status').innerText(),/Rangliste wurde neu sortiert/);
    assert.match(await ownTile.innerText(),/#12/,'Master: ranks change only after opponent confirms');
    // Holiday and injury badges appear BOTTOM-RIGHT, including on small phones;
    // clearing it re-enables the normal club challenge rules.
    await page.locator('#pyramid-demo-role').selectOption('demo-user-15');
    assert.equal(await page.locator('#pyramid-avatar-panel').isVisible(),true);
    assert.equal(await page.locator('#pyramid-avatar-file').count(),1);
    assert.equal(await page.locator('button[data-pyramid-challenge="demo-entry-11"]').count(),1);
    await page.locator('#pyramid-neutral-reason').selectOption('vacation');
    await page.locator('#pyramid-availability-form button[type="submit"]').click();
    assert.equal(await ownTile.locator('.pyramid-entry-away').innerText(),'Urlaub');
    const geometry=await ownTile.evaluate(tile=>{
      const pill=tile.querySelector('.pyramid-entry-away');
      const badge=pill.getBoundingClientRect(),card=tile.getBoundingClientRect();
      return {left:badge.left-card.left,right:card.right-badge.right,
        top:badge.top-card.top,bottom:card.bottom-badge.bottom};
    });
    assert.ok(geometry.right<=8 && geometry.bottom<=8 && geometry.right>=-2,
      'Vacation badge must be pinned at bottom-right: '+JSON.stringify(geometry));
    assert.equal(await page.locator('button[data-pyramid-challenge="demo-entry-11"]').count(),0);
    await page.locator('#pyramid-neutral-reason').selectOption('injury');
    await page.locator('#pyramid-availability-form button[type="submit"]').click();
    assert.equal(await ownTile.locator('.pyramid-entry-away').innerText(),'Verletzung');
    const injuryGeom=await ownTile.locator('.pyramid-entry-away').boundingBox();
    const cardGeom=await ownTile.boundingBox();
    assert.ok(injuryGeom&&cardGeom&&cardGeom.x+cardGeom.width-injuryGeom.x-injuryGeom.width<=8,
      'Injury badge must be pinned at bottom-right');
    await page.locator('#pyramid-neutral-reason').selectOption('');
    await page.locator('#pyramid-availability-form button[type="submit"]').click();
    assert.equal(await ownTile.locator('.pyramid-entry-away').count(),0);
    assert.equal(await page.locator('button[data-pyramid-challenge="demo-entry-11"]').count(),1);
    // Master §3: new members are ranked at the bottom upon admin approval.
    await page.locator('#pyramid-demo-role').selectOption('demo-guest');
    await page.locator('#pyramid-display-name').fill('Test-Mitglied');
    await page.locator('#pyramid-join-form button[type="submit"]').click();
    assert.match(await page.locator('#pyramid-join-state').innerText(),/wartet auf Freigabe/);
    await page.locator('#pyramid-demo-role').selectOption('admin');
    const row=page.locator('#pyramid-admin-requests .pyramid-admin-item').filter({hasText:'Test-Mitglied'});
    await row.locator('button[data-pyramid-approve]').click();
    assert.equal(await page.locator('.pyramid-entry:not(.is-empty)').count(),16);
    assert.match(await page.locator('#pyramid-admin-entries').innerText(),/#16 · Test-Mitglied/);
    // Season switching, new list creation and reset work in the mock.
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

    // The signed-out route must show a minimal public ladder, ahead of login.
    // Intercept the read-only Supabase RPC to keep this test deterministic and
    // ensure no real member names or internal IDs enter the test runner.
    const publicPage=await context.newPage();
    publicPage.on('pageerror',error=>errors.push(error.message));
    await publicPage.route('**/rest/v1/rpc/pyramid_public_standings',route=>
      route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify([
          {ladder_id:'demo-public-a',ladder_title:'Herren',season_label:'Sommer 2027',
            starts_on:'2027-05-01',ends_on:'2027-09-30',seeded:true,
            position:1,display_name:'Mustermitglied Eins'},
          {ladder_id:'demo-public-a',ladder_title:'Herren',season_label:'Sommer 2027',
            starts_on:'2027-05-01',ends_on:'2027-09-30',seeded:true,
            position:2,display_name:'Mustermitglied Zwei'}
        ])}));
    await publicPage.goto(origin+base+'/forderungspyramide/',{waitUntil:'domcontentloaded'});
    await publicPage.locator('.pyramid-entry-public').first().waitFor({timeout:15000});
    assert.equal(await publicPage.locator('#pyramid-login-form').isVisible(),true);
    assert.equal(await publicPage.locator('#pyramid-public-panel').isVisible(),true);
    assert.equal(await publicPage.locator('.pyramid-entry-public').count(),2);
    assert.match(await publicPage.locator('#pyramid-public-board').innerText(),/Mustermitglied Eins/);
    assert.equal(await publicPage.locator('#pyramid-public-board img').count(),0,
      'Guests must never see player photos');
    assert.equal(await publicPage.locator('#pyramid-public-board .pyramid-entry-away').count(),0,
      'Guests must never see holiday/injury status');
    assert.equal(await publicPage.locator('#pyramid-public-board button').count(),0,
      'Guests must not challenge players');
    assert.equal(await publicPage.locator('#pyramid-avatar-panel').isVisible(),false);
    const order=await publicPage.evaluate(()=>{
      const rules=document.querySelector('.pyramid-rules');
      const board=document.querySelector('#pyramid-public-panel');
      return !!rules&&!!board&&!!(rules.compareDocumentPosition(board)&Node.DOCUMENT_POSITION_FOLLOWING);
    });
    assert.ok(order,'Rule bullet points must appear before public ladder and login');
    assert.ok((await publicPage.locator('.pyramid-rules-list li').count())>=9);
    const guestWidth=await publicPage.evaluate(()=>({
      scroll:document.documentElement.scrollWidth,viewport:innerWidth
    }));
    assert.ok(guestWidth.scroll<=guestWidth.viewport+3,
      name+' signed-out public ladder overflows viewport '+JSON.stringify(guestWidth));
    await publicPage.close();

    // The new Admin result form must be a properly sized native modal on all tested devices.
    await page.goto(origin+base+'/admin/',{waitUntil:'domcontentloaded'});
    const adminDialog=page.locator('#pyramid-admin-result-dialog');
    assert.equal(await adminDialog.count(),1,'Admin result modal missing');
    await adminDialog.evaluate(el=>el.showModal());
    assert.equal(await adminDialog.isVisible(),true);
    const bounds=await adminDialog.boundingBox();
    assert.ok(bounds&&bounds.x>=-2&&bounds.width<=viewport.width+3,
      name+' admin modal is horizontally clipped: '+JSON.stringify(bounds));
    await page.keyboard.press('Escape');
    assert.equal(await adminDialog.isHidden(),true,'Escape did not close admin result dialog');
    console.log('PASS '+name+': master result confirmation, ranking, bottom-right neutral badges, membership, privacy and responsive');
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
