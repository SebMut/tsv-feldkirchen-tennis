import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { runTickerBrowserRehearsal } from './ticker-browser-qa.mjs';
import { runTvTickerBrowserQA } from './tv-ticker-browser-qa.mjs';

// Read-only browser QA. Screenshots and outcomes are saved, not published.
const out=path.resolve('artifacts/browser-qa');
const base=(process.env.PREVIEW_BASE||'/').replace(/^\/|\/$/g,'');
const host='http://127.0.0.1:4321';
const url=route=>host+(base?'/'+base:'')+route;
const report={started:new Date().toISOString(),base:base||'/',checks:[],passed:0,failed:0,skipped:0};
const routes=['/','/aktuelles/','/mannschaften/','/mannschaften/herren/','/spieltag/','/spieltag/live-ticker/','/spiel/','/termine/','/live/','/veranstaltung/','/veranstaltung/bestaetigen/','/training/','/mitglied-werden/','/ueber-uns/','/funktionaere/','/sponsoren/','/kontakt/','/impressum/','/datenschutz/','/admin/'];
let server,browser;
let previewLogs='';
function outcome(name,status,reason=''){
  report.checks.push({name,status,reason:String(reason).slice(0,1800)});
  report[status]++;
  console.log('[browser-qa] '+status.toUpperCase()+' '+name+(reason?' '+String(reason).slice(0,260):''));
}
async function check(name,fn,page=null,privatePage=false){
  try{await fn();outcome(name,'passed');}
  catch(error){
    outcome(name,'failed',error?.stack||String(error));
    if(page&&!privatePage)try{await page.screenshot({path:path.join(out,name.replace(/[^a-z0-9-]/gi,'-')+'-FAIL.png'),fullPage:true,timeout:6000});}catch{}
  }
}
async function waitForServer(){
  for(let n=0;n<75;n++){
    if(server.exitCode!==null)throw Error('Preview server ended unexpectedly: '+previewLogs.slice(-1500));
    try{const r=await fetch(url('/'),{signal:AbortSignal.timeout(1000)});if(r.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  throw Error('Preview server did not start');
}
async function noOverflow(page,route){
  const size=await page.evaluate(()=>({
    document:document.documentElement.scrollWidth,
    window:window.innerWidth,
    body:document.body.scrollWidth
  }));
  assert.ok(size.document<=size.window+3&&size.body<=size.window+3,
    route+' overflows the viewport: '+JSON.stringify(size));
}
async function healthyImages(page,route){
  const images=page.locator('main img');
  for(let i=0;i<await images.count();i++){
    const image=images.nth(i);
    if(!await image.isVisible())continue;
    await image.scrollIntoViewIfNeeded({timeout:2500}).catch(()=>{});
    await image.evaluate(el=>{el.loading='eager';});
    await image.evaluate(el=>Promise.race([el.decode().catch(()=>{}),new Promise(r=>setTimeout(r,4500))]));
    const result=await image.evaluate(el=>({src:el.currentSrc||el.src,width:el.naturalWidth}));
    if(result.src.startsWith('data:'))continue;
    assert.ok(result.width>0,route+' broken image '+result.src);
  }
}
async function deviceQA(device){
  const context=await browser.newContext({viewport:device.viewport,isMobile:device.mobile,hasTouch:device.mobile,locale:'de-DE',timezoneId:'Europe/Berlin',reducedMotion:'reduce'});
  const page=await context.newPage();
  for(const route of routes){
    const key=device.name+':'+route;
    const errors=[];
    const listener=e=>errors.push(e.message);
    page.on('pageerror',listener);
    await check(key+' layout',async()=>{
      const response=await page.goto(url(route),{waitUntil:'domcontentloaded',timeout:20000});
      assert.equal(response?.status(),200,'page returned HTTP '+response?.status());
      await page.waitForTimeout(550);
      assert.ok(await page.locator('main').count(),'missing main landmark');
      assert.match(await page.title(),/TSV Feldkirchen Tennis/);
      await noOverflow(page,route);
      assert.deepEqual(errors,[],'browser JavaScript exceptions');
      await page.screenshot({path:path.join(out,device.name+'-'+(route.replaceAll('/','-')||'home')+'.png'),fullPage:true,timeout:9000});
    },page);
    if(['/', '/aktuelles/','/mannschaften/','/spieltag/','/live/'].includes(route))
      await check(key+' images',()=>healthyImages(page,route),page);
    page.off('pageerror',listener);
  }
  if(device.mobile) await check(device.name+' compact calendar filters',async()=>{
    await page.goto(url('/termine/'));
    const filters=page.locator('#calendar-extra-filters');
    assert.equal(await filters.evaluate(el=>el.open),false,'advanced mobile filters should start collapsed');
    await filters.locator('summary').click();
    assert.equal(await filters.evaluate(el=>el.open),true,'advanced filters did not open');
    assert.ok(await page.locator('#calendar-team').isVisible(),'team filter remained hidden');
    await filters.locator('summary').click();
    assert.equal(await filters.evaluate(el=>el.open),false,'advanced filters did not close');
  },page);
  await check(device.name+' navigation',async()=>{
    await page.goto(url('/'));
    const link=page.locator('a[href*="/aktuelles/"]').first();
    assert.ok(await link.count(),'missing Aktuelles link');
    const href=await link.getAttribute('href');
    assert.match(new URL(href,page.url()).pathname,/\/aktuelles\/$/);
  },page);
  await check(device.name+' full event details',async()=>{
    await page.goto(url('/aktuelles/'));
    const card=page.locator('#event-news-list .content-card--event').first();
    try{await card.waitFor({state:'attached',timeout:13000});}
    catch{
      outcome(device.name+' event fixture availability','skipped','No published upcoming event accessible; detail flow not exercised');
      return;
    }
    await card.locator('[data-open-detail]').last().click();
    const opened=await card.locator('details[data-expanded-details]').evaluate(el=>el.open);
    assert.equal(opened,true,'Details did not open');
    assert.match(new URL(page.url()).pathname,/\/aktuelles\/$/,'Incorrect redirection to calendar');
    assert.ok((await card.locator('.content-card__full-text').innerText()).trim().length>5);
  },page);
  await check(device.name+' event details open, collapse and deep link',async()=>{
    await page.goto(url('/aktuelles/'));
    const card=page.locator('#event-news-list .content-card--event').first();
    try{await card.waitFor({state:'visible',timeout:13000});}
    catch{ outcome(device.name+' event toggle fixture','skipped','No upcoming published event');return; }
    const details=card.locator('details[data-expanded-details]');
    const link=card.locator('a[data-detail-toggle-label]');
    const id=await card.getAttribute('id');
    assert.ok(id?.startsWith('event-'));
    assert.equal(await details.evaluate(el=>el.open),false);
    await link.click();
    assert.equal(await details.evaluate(el=>el.open),true,'first click must open');
    assert.match(await link.innerText(),/Details schließen/,'link did not offer to close');
    assert.equal(await link.getAttribute('aria-expanded'),'true');
    assert.equal(new URL(page.url()).searchParams.get('event'),id.slice(6));
    await link.click();
    assert.equal(await details.evaluate(el=>el.open),false,'second click must collapse');
    assert.match(await link.innerText(),/Details lesen/);
    assert.equal(await link.getAttribute('aria-expanded'),'false');
    assert.equal(new URL(page.url()).searchParams.has('event'),false,'closed event still selected in URL');
    assert.equal(new URL(page.url()).hash,'','closing must remove deep-link hash');

    const summary=details.locator('summary');
    await summary.click();
    assert.equal(await details.evaluate(el=>el.open),true,'native summary must open');
    await summary.click();
    assert.equal(await details.evaluate(el=>el.open),false,'native summary must close');

    await page.goto(url('/aktuelles/?event='+id.slice(6)+'#'+id));
    await card.waitFor({state:'visible',timeout:13000});
    assert.equal(await details.evaluate(el=>el.open),true,'direct event URL must open details');
    await link.click();
    assert.equal(await details.evaluate(el=>el.open),false,'direct-linked details must collapse');
    assert.equal(new URL(page.url()).hash,'');
  },page);
  await check(device.name+' news details open and collapse',async()=>{
    await page.goto(url('/aktuelles/'));
    const card=page.locator('#news-list .content-card--news').first();
    try{await card.waitFor({state:'visible',timeout:13000});}
    catch{ outcome(device.name+' news toggle fixture','skipped','No published news card');return; }
    const details=card.locator('details[data-expanded-details]');
    const titleLink=card.locator('h2 a[data-open-detail]');
    await titleLink.click();
    assert.equal(await details.evaluate(el=>el.open),true,'news title click must open');
    await titleLink.click();
    assert.equal(await details.evaluate(el=>el.open),false,'news title second click must close');
    assert.equal(new URL(page.url()).searchParams.has('news'),false);
    const summary=details.locator('summary');
    await summary.click();
    assert.equal(await details.evaluate(el=>el.open),true);
    await summary.click();
    assert.equal(await details.evaluate(el=>el.open),false);
  },page);
  await check(device.name+' event short text in public card',async()=>{
    await page.goto(url('/aktuelles/'));
    const platzabbau = page.locator('#event-news-list .content-card--event').filter({hasText:'Platzabbau'}).first();
    if(new Date() >= new Date('2026-11-09T00:00:00+01:00')){
      outcome(device.name+' Platzabbau fixture availability','skipped','The November 2026 event has finished');
      return;
    }
    await platzabbau.waitFor({state:'visible',timeout:14000});
    const shortText = await platzabbau.locator('.content-card__description').innerText();
    assert.match(shortText,/10:30 Uhr/,'Stored event excerpt is missing in the public card');
    assert.match(shortText,/machen wir unsere Tennisplätze gemeinsam winterfest/);
    assert.doesNotMatch(shortText,/Und danach wird.s gemütlich/,'Long description incorrectly replaced the short text');
    const fullText = (await platzabbau.locator('.content-card__full-text').textContent()) || '';
    assert.match(fullText,/Brotzeit/,'Long description was lost');
  },page);
  await check(device.name+' calendar modal Escape',async()=>{
    await page.goto(url('/termine/'));
    const day=page.locator('#calendar-month-grid button[data-calendar-day]').first();
    await day.waitFor({state:'visible',timeout:17000});
    await day.click();
    const modal=page.locator('#calendar-day-modal');
    await modal.waitFor({state:'visible',timeout:4000});
    await page.keyboard.press('Escape');
    assert.equal(await modal.evaluate(el=>el.open),false,'Escape did not close modal');
  },page);
  await check(device.name+' forms and anonymous access',async()=>{
    await page.goto(url('/veranstaltung/'));
    await page.locator('#rsvp-member-email').fill('invalid-email');
    assert.equal(await page.locator('#rsvp-member-email').evaluate(el=>el.validity.typeMismatch),true);
    await page.goto(url('/admin/'));
    await page.locator('#login-email').fill('invalid-email');
    assert.equal(await page.locator('#login-email').evaluate(el=>el.validity.typeMismatch),true);
    assert.equal(await page.locator('#admin-app').isVisible(),false,'anonymous user saw admin application');
  },page);
  await context.close();
}
async function roleQA(role){
  const email=process.env['QA_ROLE_'+role.code+'_EMAIL'];
  const password=process.env['QA_ROLE_'+role.code+'_PASSWORD'];
  if(!email||!password){outcome('role '+role.name,'skipped','Test account secrets not configured; protected role CRUD remains untested');return;}
  const context=await browser.newContext();
  const page=await context.newPage();
  await check('role '+role.name,async()=>{
    await page.goto(url('/admin/'));
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);
    await page.locator('#login-form button[type="submit"]').click();
    await page.locator('#admin-app').waitFor({state:'visible',timeout:23000});
    for(const [section,visible] of Object.entries(role.visible)){
      assert.equal(await page.locator('[data-panel="'+section+'"]').isVisible(),visible,role.name+' unexpected '+section+' permission');
    }
    if(role.code==='NEWS'||role.code==='EVENTS'){
      await page.locator('.admin-nav button[data-panel="news"]').click();
      if(role.code==='EVENTS'){
        const existing=page.locator('#editorial-compose-list .admin-edit-item').filter({hasText:'Platzabbau'}).first();
        if(await existing.count()){
          await existing.locator('[data-compose-edit]').click();
          assert.match(await page.locator('#editorial-compose-excerpt').inputValue(),/10:30 Uhr/,'Event excerpt was not reloaded from Supabase');
          await page.locator('#editorial-compose-reset').click();
        }
      }
      const withEvent=page.locator('#editorial-compose-event');
      assert.equal(await withEvent.isDisabled(),true,'single-role user may not toggle unauthorized content type');
      assert.equal(await withEvent.isChecked(),role.code==='EVENTS','incorrect editorial mode for role');
      await page.locator('#editorial-compose-title').fill('Vorschau Testbeitrag');
      await page.locator('#editorial-compose-body').fill('Dieser Text ist ausschließlich eine Vorschau und wird nicht gespeichert.');
      if(role.code==='EVENTS')await page.locator('#editorial-compose-start').fill('2027-09-10T13:00');
      await page.locator('#editorial-compose-preview-button').click();
      assert.equal(await page.locator('#editorial-compose-desktop .content-card').isVisible(),true,'desktop card missing');
      assert.equal(await page.locator('#editorial-compose-mobile .content-card').isVisible(),true,'mobile card missing');
      assert.equal(await page.locator('#editorial-compose-publish').isEnabled(),true,'preview did not unlock publish');
      await page.setViewportSize({width:390,height:844});
      const bounds=await page.locator('#editorial-compose-mobile .content-card').boundingBox();
      assert.ok(bounds && bounds.width<=390,'mobile preview overflows 390 px viewport');
      await page.locator('#editorial-compose-title').fill('Vorschau nach Änderung');
      assert.equal(await page.locator('#editorial-compose-publish').isDisabled(),true,'editing did not invalidate preview');
    }
  },null,true);
  await context.close();
}
try{
  await fs.mkdir(out,{recursive:true});
  server=spawn(path.resolve('node_modules/.bin/astro'),['preview','--host','127.0.0.1','--port','4321','--strictPort'],{env:{...process.env,PREVIEW_BASE:process.env.PREVIEW_BASE||'/'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>{previewLogs=(previewLogs+chunk.toString()).slice(-6000);});
  server.stderr.on('data',chunk=>{previewLogs=(previewLogs+chunk.toString()).slice(-6000);});
  await waitForServer();
  browser=await chromium.launch({headless:true});
  await deviceQA({name:'desktop',viewport:{width:1440,height:900},mobile:false});
  await deviceQA({name:'mobile',viewport:{width:390,height:844},mobile:true});
  await deviceQA({name:'small-mobile',viewport:{width:320,height:640},mobile:true});
  await check('keyboard focus and escape navigation',async()=>{
    const context=await browser.newContext({viewport:{width:360,height:740},reducedMotion:'reduce'});
    const page=await context.newPage();
    try{
      await page.goto(url('/termine/'),{waitUntil:'domcontentloaded'});
      await page.keyboard.press('Tab');
      const focused=await page.evaluate(()=>document.activeElement && document.activeElement!==document.body);
      assert.ok(focused,'keyboard Tab should move focus to a control');
      const focus=await page.evaluate(()=>({
        tag:document.activeElement?.tagName,
        outline:getComputedStyle(document.activeElement).outlineStyle,
      }));
      assert.notEqual(focus.outline,'none','focused control must have a visible focus outline');
      await page.keyboard.press('Escape'); // must never throw or trap keyboard without a dialog.
      await noOverflow(page,'/termine/ keyboard');
    }finally{await context.close();}
  });
  await runTickerBrowserRehearsal({browser,url,check});
  await runTvTickerBrowserQA({browser,url,check});
  await roleQA({code:'TICKER',name:'ticker only',visible:{matches:true,teams:false,players:false,news:false,galleries:false,users:false}});
  await roleQA({code:'NEWS',name:'news only',visible:{news:true,matches:false,teams:false,players:false,users:false}});
  await roleQA({code:'EVENTS',name:'events only',visible:{news:true,matches:false,teams:false,players:false,users:false}});
}catch(error){outcome('harness','failed',error?.stack||String(error));}
finally{
  try{await browser?.close();}catch{}
  if(server&&server.exitCode===null)server.kill('SIGTERM');
  server?.stdout?.destroy();
  server?.stderr?.destroy();
  server?.unref();
  report.finished=new Date().toISOString();
  await fs.mkdir(out,{recursive:true});
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('[browser-qa] totals: '+JSON.stringify({passed:report.passed,failed:report.failed,skipped:report.skipped}));
}
if(report.failed)process.exitCode=1;
