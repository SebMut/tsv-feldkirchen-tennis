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
 for(const name of ['Archiv','Bitte wählen...']){
   const b=page.getByRole('button',{name,exact:true}).first();
   if(await b.count()){
     try{ await b.click({timeout:5000});await page.waitForTimeout(1100);
       const menu=await page.evaluate(()=>({
         text:(document.body?.innerText||'').slice(-11000),
         options:[...document.querySelectorAll('[role=option],.z-popup,.z-listitem,.z-menuitem,.dropdown-menu')]
           .filter(el=>el.getBoundingClientRect().width>0).slice(0,85)
           .map(el=>({tag:el.tagName,text:el.textContent.trim().slice(0,160),html:el.outerHTML.slice(0,350)}))
       }));
       console.log('ARCHIVE_DROPDOWN='+JSON.stringify({name,menu}).slice(0,19000));
     }catch(err){console.log('ARCHIVE_DROPDOWN_ERROR='+JSON.stringify({name,error:String(err.message).slice(0,130)}));}
   }
 }
 await page.close();
}finally{await browser.close()}
