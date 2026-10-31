// Public BTV group widget discovery: only source URLs/meeting IDs in logs.
// Extract only exact BTV meeting report references, NEVER player names or scores.
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/tsv-widget/package.json');
const {chromium}=require('playwright-core');
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
if(!chrome){console.log('BTV_WIDGET_BROWSER_UNAVAILABLE');process.exit(1)}
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
try{
 for(const groupid of ['2216736','2165579','2165602','2216734']){
  const page=await browser.newPage({locale:'de-DE',viewport:{width:1360,height:1100}});
  const safeResponses=[];
  page.on('response',res=>{
    try{const u=new URL(res.url());
      if(['widget.btv.de','btv-prod.burdadigitalsystems.de','btv.liga.nu','www.btv.de'].includes(u.host) && safeResponses.length<35)
        safeResponses.push({host:u.host,path:u.pathname,params:[...u.searchParams.keys()],status:res.status(),type:res.headers()['content-type']?.slice(0,50)});
    }catch{}
  });
  const url='https://widget.btv.de/btvgroup/?groupid='+groupid;
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
   const necessary=page.getByRole('button',{name:/Nur notwendige Cookies/i}).first();
   if(await necessary.count() && await necessary.isVisible()){
     await necessary.click({timeout:7000});
   }
   await page.waitForTimeout(8000);
   const data=await page.evaluate(()=>{
    const a=[...document.querySelectorAll('a[href]')];
    const links=a.filter(x=>/meeting(?:Report)?|Spielbericht|anzeigen|Begegnung/i.test(x.href+' '+x.textContent))
       .map(x=>({href:x.href.slice(0,380),title:x.title.slice(0,55)})).slice(0,80);
    const meetingIds=[...new Set([...document.documentElement.outerHTML.matchAll(/(?:meeting(?:Id)?=|meeting(?:Id)?["':\s]+)(\d{7,9})/gi)]
       .map(m=>m[1]))].slice(0,160);
    return {title:document.title,links,meetingIds,
      textLength:document.body?.innerText?.length||0,
      linkCount:a.length,
      groupIds:[...new Set([...document.documentElement.outerHTML.matchAll(/groupid=([0-9]{7,8})/gi)].map(m=>m[1]))].slice(0,12),
      buttons:[...document.querySelectorAll('button')].map(x=>x.textContent.trim().slice(0,38)).filter(Boolean).slice(0,15),
      hasConsentDialog:!!document.querySelector('#CybotCookiebotDialog'),
      textPreview:(document.body?.innerText||'').slice(0,450).replace(/\S+[\w.-]+@\S+/g,'[EMAIL]').replace(/\b[A-ZÄÖÜ][a-zäöüß]+,\s*[A-ZÄÖÜ][a-zäöüß]+\b/g,'[PERSON]')
    };
   });
   console.log('BTV_WIDGET='+JSON.stringify({groupid,finalHost:new URL(page.url()).host,data,safeResponses}).slice(0,14500));
  }catch(e){console.log('BTV_WIDGET='+JSON.stringify({groupid,error:String(e.message||e).slice(0,180),safeResponses}));}
  finally{await page.close();}
 }
}finally{await browser.close()}
