import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire('/tmp/tsv-browser/package.json');
const {chromium}=require('playwright-core');
const executable=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable',
 '/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
if(!executable){console.log('BTV_BROWSER_UNAVAILABLE=no installed Chrome');process.exit(0)}
const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox']});
try{
 const urls=[
 'https://btv-prod.burdadigitalsystems.de/btvteams/?clubnr=01012',
 'https://services.tennis.de/extern/tennisdeteamsearch.zul?verband=BTV&verein=01012&linkfarbe=20aebd'
 ];
 for(const url of urls){
  const page=await browser.newPage({locale:'de-DE'});
  try{
   await page.goto(url,{timeout:28000,waitUntil:'domcontentloaded'});
   await page.waitForTimeout(6500);
   const snapshot=await page.evaluate(()=>({
    title:document.title,
    text:(document.body?.innerText||'').slice(0,11000),
    links:[...document.querySelectorAll('a[href]')].map(a=>({text:a.textContent.trim().slice(0,60),href:a.href}))
      .filter(x=>/groupid=|btv|tennis|Spielplan|Tabelle|anzeigen|Mannschaften/i.test(x.href+' '+x.text)).slice(0,100),
    selects:[...document.querySelectorAll('select')].map(x=>({name:x.name,options:[...x.options].map(o=>({value:o.value,label:o.textContent.trim()})).slice(0,30)})),
    buttons:[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,50)
   }));
   console.log('BTV_LIVE_WIDGET='+JSON.stringify({url,snapshot}).slice(0,16000));
  }catch(e){console.log('BTV_LIVE_WIDGET='+JSON.stringify({url,error:String(e.message||e).slice(0,180)}))}
  finally{await page.close()}
 }
}finally{await browser.close()}
