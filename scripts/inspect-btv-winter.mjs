// One-off, public/read-only verification of the official BTV winter club-widget links.
// No login, private user data, session cookie output, or Supabase operations.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const root = 'https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften';
const dir = mkdtempSync(join(tmpdir(), 'btv-inspect-'));
const port = 9238;
const chrome = spawn('google-chrome', [
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-debugging-port='+port,'--user-data-dir='+dir,root,
], {stdio:'ignore'});

try {
 let tabs=[];
 for(let i=0;i<70;i++){
   try {
     const r=await fetch('http://127.0.0.1:'+port+'/json');
     if(r.ok){tabs=await r.json();if(tabs.some(t=>t.type==='page'&&t.webSocketDebuggerUrl))break;}
   }catch{}
   await sleep(200);
 }
 const tab=tabs.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
 if(!tab)throw Error('CDP page not available');
 const ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
   ws.addEventListener('open',resolve,{once:true});
   ws.addEventListener('error',reject,{once:true});
 });
 let id=0;const pending=new Map();
 ws.addEventListener('message',msg=>{
   const packet=JSON.parse(msg.data);
   if(packet.id&&pending.has(packet.id)){
     const p=pending.get(packet.id);pending.delete(packet.id);
     packet.error?p.reject(Error(packet.error.message)):p.resolve(packet.result);
   }
 });
 const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
   const request=++id;pending.set(request,{resolve,reject});
   ws.send(JSON.stringify({id:request,method,params,...(sessionId?{sessionId}:{})}));
 });
 const evalJS=async (expression,sessionId)=>{
   const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
   if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,800));
   return r.result?.value;
 };
 await call('Runtime.enable');
 await sleep(2500);
 await evalJS('Array.from(document.querySelectorAll("button")).find(b=>b.innerText.includes("Nur notwendige Cookies"))?.click()');
 await sleep(2000);
 await evalJS('Array.from(document.querySelectorAll("a")).find(x=>x.textContent.trim() === "Mannschaften")?.click()');
 await sleep(7000);
 const targets=await call('Target.getTargets');
 const iframe=targets.targetInfos.find(t=>t.type==='iframe'&&t.url.includes('/btvteams/'));
 if(!iframe)throw Error('BTV team iframe missing');
 const connection=await call('Target.attachToTarget',{targetId:iframe.targetId,flatten:true});
 const session=connection.sessionId;
 const text=await evalJS('document.body.innerText',session);
 console.log('BTV_PUBLIC_SUMMARY',JSON.stringify(text.slice(0,7000)));
 const structure=await evalJS('Array.from(document.querySelectorAll("a,button")).map((x,i)=>({i,tag:x.tagName,text:(x.innerText||"").trim().slice(0,80),href:x.getAttribute("href"),id:x.id,cl:x.className,outer:x.outerHTML.slice(0,300)})).filter(x=>x.text.includes("Spielplan")||x.text.includes("Mannschaft")||x.text.includes("PDF")||x.text.includes("Winter")).slice(0,65)',session);
 console.log('BTV_PUBLIC_LINKS',JSON.stringify(structure).slice(0,22500));
 const groups=await evalJS('Array.from(document.querySelectorAll("div,section,article")).filter(x=>x.textContent&&x.textContent.includes("H00 - S2 - Gr. 018")&&x.textContent.length<1200).slice(0,3).map(x=>x.outerHTML.slice(0,2200))',session);
 console.log('BTV_GROUP_MARKUP',JSON.stringify(groups).slice(0,11000));
 // Capture one public table link navigation if ordinary hrefs are unavailable.
 const trigger=await evalJS('Array.from(document.querySelectorAll("a,button")).find(x=>x.innerText&&x.innerText.trim()==="Tabelle/Spielplan")?.outerHTML',session);
 console.log('BTV_PLAN_CLICKABLE',JSON.stringify(trigger).slice(0,1000));

 const labels = ['Tabelle/Spielplan [PDF]'];
 for (const label of labels) {
   const clickExpr='Array.from(document.querySelectorAll("a.z-toolbarbutton")).find(x=>x.textContent.trim()==='+JSON.stringify(label)+')?.click(); true';
   try{
     await evalJS(clickExpr,session);
     await sleep(2700);
     const nextTargets=await call('Target.getTargets');
     const opened=nextTargets.targetInfos.filter(t=>t.type==='page' && !t.url.includes('/btvteams/') && !t.url.includes('about:blank')).map(t=>({type:t.type,url:t.url}));
     console.log('BTV_LINK_RESULT',JSON.stringify({label,opened}).slice(0,7000));
     const iframeText=(await evalJS('document.body.innerText',session)).slice(0,8500);
     console.log('BTV_WIDGET_AFTER_CLICK',JSON.stringify({label,text:iframeText}).slice(0,10500));
   }catch(e){ console.log('BTV_LINK_ERROR',JSON.stringify({label,error:String(e).slice(0,500)})) }
 }

 ws.close();
} finally {
 chrome.kill('SIGKILL');
 try{rmSync(dir,{recursive:true,force:true,maxRetries:7,retryDelay:200})}catch{}
}
