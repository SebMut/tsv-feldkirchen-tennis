// Diagnostic of public Südbayern BTV competition archive (team/group data only).
// No individual players or personal reports; read-only against official BTV iframe.
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire('/tmp/tsv-browser/package.json');
const {chromium}=require('playwright-core');
const executable=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable',
 '/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
if(!executable){console.log('ARCHIVE_BROWSER=unavailable');process.exit(1)}
const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({locale:'de-DE',viewport:{width:1500,height:1050}});
 const requests=[];
 page.on('request',r=>{
  const u=r.url();if(/widget.btv.de|btvgrpsearch/.test(u)&&requests.length<25)
    requests.push({method:r.method(),url:u.slice(0,220),body:(r.postData()||'').slice(0,230)});
 });
 page.on('pageerror',e=>console.log('ARCHIVE_JS_ERROR='+String(e.message).slice(0,180)));
 await page.goto('https://widget.btv.de/btvgrpsearch/?region=S%C3%BCdbayern',
  {timeout:35000,waitUntil:'domcontentloaded'});
 await page.waitForTimeout(3000);
 const consent=page.locator('#CybotCookiebotDialogBodyButtonDecline');
 if(await consent.count() && await consent.isVisible()) {
   await consent.click({timeout:6000});
 }
 await page.waitForTimeout(6500);
 const snapshot=await page.evaluate(()=>({
  title:document.title,
  text:(document.body?.innerText||'').slice(0,16500),
  html:[...document.querySelectorAll('.z-button,.z-combobox,.z-listbox,.z-popup,.z-menu')].slice(0,30).map(x=>x.outerHTML.slice(0,620)),
  inputs:[...document.querySelectorAll('input')].map(x=>({type:x.type,id:x.id,name:x.name,
    placeholder:x.placeholder,value:x.value,outer:x.outerHTML.slice(0,340)})).slice(0,30),
  select:[...document.querySelectorAll('select')].map(x=>({id:x.id,options:[...x.options].map(o=>o.textContent.trim()).slice(0,60)})),
  buttons:[...document.querySelectorAll('button,[role=button]')].map(x=>({text:x.textContent.trim().slice(0,70),outer:x.outerHTML.slice(0,230)})).slice(0,65),
  anchors:[...document.querySelectorAll('a[href]')].map(x=>({text:x.textContent.trim().slice(0,55),href:x.href.slice(0,180)})).slice(0,50)
 }));
 console.log('ARCHIVE_UI='+JSON.stringify(snapshot).slice(0,33000));
 console.log('ARCHIVE_REQUESTS='+JSON.stringify(requests).slice(0,6000));
 const visible=await page.evaluate(()=>({
  content:document.body.textContent?.slice(-2500),
  state:[...document.querySelectorAll('button.z-button')].map(b=>({
    text:b.textContent.trim(),visible:!!(b.offsetWidth||b.offsetHeight||b.getClientRects().length),
    parent:b.parentElement?.outerHTML.slice(0,450),
    style:getComputedStyle(b).display,
    top:b.getBoundingClientRect().top
  })),
  cookie:document.querySelector('#CybotCookiebotDialog')?.getAttribute('style'),
  overlay:document.querySelector('#CybotCookiebotDialog')?.className
 }));
 console.log('ARCHIVE_STATE='+JSON.stringify(visible).slice(0,10500));
 const buttons=page.locator('button.z-button');
 if(await buttons.count()>=3){
  try{
   await buttons.nth(2).evaluate(button=>button.click());
   await page.waitForTimeout(1700);
   const items=await page.evaluate(()=>({
    text:document.body?.innerText?.slice(-6500),
    visible:[...document.querySelectorAll('a,li,.z-listitem,.z-menuitem,.dropdown-menu')]
     .filter(e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length))
     .map(e=>({tag:e.tagName,text:e.textContent.trim().slice(0,110),html:e.outerHTML.slice(0,260)}))
     .filter(e=>/20\d\d|Sommer|Winter|Archiv|Saison/i.test(e.text)).slice(0,80)
   }));
   console.log('ARCHIVE_FORCED_MENU='+JSON.stringify(items).slice(0,11000));
  }catch(err){console.log('ARCHIVE_FORCED_ERROR='+String(err.message).slice(0,500))}
 }
 await page.close();
}finally{await browser.close()}
