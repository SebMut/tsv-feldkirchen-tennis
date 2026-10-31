// Read-only browser probe of public BTV widget season selection, no private BTV credentials.
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root='https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften';
const temp=mkdtempSync(join(tmpdir(),'btv-chrome-'));
const port=9239;
const chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--remote-debugging-port='+port,'--user-data-dir='+temp,root],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try {
 let tabs=[];
 for(let i=0;i<45;i++){try{let r=await fetch('http://127.0.0.1:'+port+'/json');if(r.ok){tabs=await r.json();if(tabs.some(t=>t.type==='page'&&t.webSocketDebuggerUrl))break}}catch{}await sleep(200)}
 const tab=tabs.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
 if(!tab)throw Error('Chrome CDP page was not available');
 const ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true})});
 let id=0;const pending=new Map();
 ws.addEventListener('message',m=>{const msg=JSON.parse(m.data);if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result)}});
 function call(method,params={},sessionId){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params,...(sessionId?{sessionId}:{})}))})}
 async function evaluate(expression){let r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result?.value}
 await call('Runtime.enable'); await call('Page.enable');
 await sleep(3200);
 console.log('COOKIE_CHOICE',JSON.stringify(await evaluate('Array.from(document.querySelectorAll("button")).filter(b=>/nur notwendige|ablehnen/i.test(b.innerText)).map(b=>({id:b.id,label:b.innerText.slice(0,80)}))')));
 await evaluate('Array.from(document.querySelectorAll("button")).find(b=>/nur notwendige|alle ablehnen/i.test(b.innerText))?.click()');
 await sleep(3200);
 console.log('TEAMS_TABS',JSON.stringify(await evaluate('Array.from(document.querySelectorAll("a,button")).filter(el=>el.textContent?.trim() === "Mannschaften").map(el=>({outer:el.outerHTML.slice(0,450)})).slice(0,12)')));
 await evaluate('Array.from(document.querySelectorAll("a,button")).find(el=>el.textContent?.trim() === "Mannschaften")?.click()');
 await sleep(6000);
 console.log('IFRAMES',JSON.stringify(await evaluate('Array.from(document.querySelectorAll("iframe")).map(el=>el.src).slice(0,12)')));
 const frames=await call('Page.getFrameTree');
 const flatten=(node)=>[node.frame,...(node.childFrames||[]).flatMap(flatten)];
 console.log('PUBLIC_FRAME_URLS',JSON.stringify(flatten(frames.frameTree).map(x=>x.url)));
 for(const frame of flatten(frames.frameTree).filter(x=>/btvteams/i.test(x.url))) {
   try{
     const world=await call('Page.createIsolatedWorld',{frameId:frame.id,worldName:'btv-read-only'});
     const response=await call('Runtime.evaluate',{expression:'document.body.innerText',contextId:world.executionContextId,returnByValue:true});
     console.log('BTV_TEAMS_AFTER_COOKIE',JSON.stringify(response.result?.value?.slice(0,12000)));
   }catch(e){console.log('FRAME_RESULT_UNAVAILABLE',String(e).slice(0,300));}
 }

 const targets=await call('Target.getTargets');
 console.log('BTV_PUBLIC_TARGETS',JSON.stringify((targets.targetInfos||[]).filter(x=>/btv-prod|btvteams|btvmeetings/.test(x.url)).map(x=>({id:x.targetId,type:x.type,url:x.url}))).slice(0,3500));
 for(const target of (targets.targetInfos||[]).filter(x=>x.type==='iframe'&&x.url.includes('btvteams'))) {
   try {
     const session=await call('Target.attachToTarget',{targetId:target.targetId,flatten:true});
     const read=await call('Runtime.evaluate',{expression:'document.body.innerText',returnByValue:true},session.sessionId);
     console.log('BTV_PUBLIC_TEAM_TEXT',JSON.stringify(read.result?.value?.slice(0,20000)));
     const click=await call('Runtime.evaluate',{expression:'document.querySelector("button.dropdown-toggle")?.click();true',returnByValue:true},session.sessionId);
     await sleep(1100);
     const menu=await call('Runtime.evaluate',{expression:'Array.from(document.querySelectorAll("li,.z-menuitem")).map(x=>x.innerText).filter(Boolean).slice(0,60)',returnByValue:true},session.sessionId);
     console.log('BTV_TEAM_MENU',JSON.stringify(menu.result?.value));
   } catch(e){console.log('BTV_TEAM_TARGET_ERROR',String(e).slice(0,400))}
 }
 ws.close();
}finally{chrome.kill('SIGKILL');try{rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:150})}catch{}}
