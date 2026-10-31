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
 await page.waitForTimeout(11000);
 const snapshot=await page.evaluate(()=>({
  title:document.title,
  text:(document.body?.innerText||'').slice(0,16500),
  html:(document.body?.outerHTML||'').slice(0,8500),
  inputs:[...document.querySelectorAll('input')].map(x=>({type:x.type,id:x.id,name:x.name,
    placeholder:x.placeholder,value:x.value,outer:x.outerHTML.slice(0,340)})).slice(0,30),
  select:[...document.querySelectorAll('select')].map(x=>({id:x.id,options:[...x.options].map(o=>o.textContent.trim()).slice(0,60)})),
  buttons:[...document.querySelectorAll('button,[role=button]')].map(x=>({text:x.textContent.trim().slice(0,70),outer:x.outerHTML.slice(0,230)})).slice(0,65),
  anchors:[...document.querySelectorAll('a[href]')].map(x=>({text:x.textContent.trim().slice(0,55),href:x.href.slice(0,180)})).slice(0,50)
 }));
 console.log('ARCHIVE_UI='+JSON.stringify(snapshot).slice(0,33000));
 console.log('ARCHIVE_REQUESTS='+JSON.stringify(requests).slice(0,6000));
 await page.close();
}finally{await browser.close()}
