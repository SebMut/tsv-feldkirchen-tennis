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
 function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}))})}
 async function evaluate(expression){let r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result?.value}
 await call('Runtime.enable'); await call('Page.enable');
 await sleep(6000);
 console.log('INITIAL_PAGE',JSON.stringify((await evaluate('document.body.innerText')).slice(0,10000)));
 console.log('INITIAL_BUTTONS',JSON.stringify(await evaluate('Array.from(document.querySelectorAll("button")).map(x=>({id:x.id,text:x.innerText}))')));
 const frames=await call('Page.getFrameTree'); console.log('FRAME_TREE',JSON.stringify(frames).slice(0,6500));
 const child=frames.frameTree?.childFrames?.find(x=>x.frame?.url?.includes('btvteams'));
 if (child){try{const w=await call('Page.createIsolatedWorld',{frameId:child.frame.id,worldName:'btv-probe'});const k=await call('Runtime.evaluate',{expression:'document.body.innerText',contextId:w.executionContextId,returnByValue:true});console.log('CHILD_FRAME',JSON.stringify(k?.result?.value?.slice(0,14000)))}catch(e){console.log('CHILD_FAILED',String(e))}}
 await evaluate('document.querySelector("button.dropdown-toggle")?.click()');
 await sleep(1800);
 console.log('CLICKED_PAGE',JSON.stringify((await evaluate('document.body.innerText')).slice(0,14000)));
 console.log('SELECT_MENU',JSON.stringify(await evaluate('Array.from(document.querySelectorAll("[role=menuitem],.z-menuitem,.z-menupopup,li")).map(x=>({tag:x.tagName,text:x.innerText,id:x.id})).filter(x=>x.text).slice(0,65)')));
 ws.close();
}finally{chrome.kill('SIGKILL');try{rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:150})}catch{}}
