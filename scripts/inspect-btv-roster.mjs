// Read-only public BTV team portraits: metadata only, never print player names.
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const ids={herren:3728614,'herren-ii':3727556,'herren-50':3727895};
const slug=process.env.BTV_TEAM_SLUG;
if(!(slug in ids))throw Error('Unverified team');
const root='https://widget.btv.de/btvteamportrait/?teamid='+ids[slug];
const dir=mkdtempSync(join(tmpdir(),'btv-roster-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=9237;
const chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--remote-debugging-port='+port,'--user-data-dir='+dir,root],{stdio:'ignore'});
try {
 let tabs=[];
 for(let n=0;n<65;n++){try{const r=await fetch('http://127.0.0.1:'+port+'/json');if(r.ok){tabs=await r.json();if(tabs.some(x=>x.type==='page'&&x.webSocketDebuggerUrl))break}}catch{}await sleep(200)}
 const tab=tabs.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
 if(!tab)throw Error('No browser page');
 const ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 let seq=0;const pending=new Map();
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}});
 const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))});
 const evaluate=async (expression,sessionId)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true},sessionId);if(r.exceptionDetails)throw Error('Browser script failed: '+r.exceptionDetails.text);return r.result?.value};
 await call('Runtime.enable');await sleep(2900);
 await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.innerText.includes("Nur notwendige Cookies"))?.click()');
 await sleep(2200);
 const links=await evaluate('Array.from(document.querySelectorAll("a,button")).map(x=>({text:(x.innerText||"").trim(),href:x.getAttribute("href")})).filter(x=>/^(Mannschaft|Spieler|Kader|Aufstellung|Meldung|Portrait|Gruppe|Tabelle)/i.test(x.text)).slice(0,35)');
 const iframes=await evaluate('Array.from(document.querySelectorAll("iframe")).map(x=>x.src).filter(x=>x.includes("btv"))');
 console.log('BTV_PORTRAIT_STRUCTURE',JSON.stringify({slug,iframes,links}).slice(0,4000));
 await sleep(5500);
 const topMeta=await evaluate('(() => {const s=document.body?.innerText||"";return {length:s.length,containsRoster:/Mannschaftsmeldung|Spielerliste|Spielerinnen|Meldeliste|Kader/i.test(s),tables:document.querySelectorAll("table").length,rows:document.querySelectorAll("tr").length,buttons:Array.from(document.querySelectorAll("a,button")).map(x=>(x.innerText||"").trim()).filter(x=>/^(Spieler|Kader|Aufstellung|Meldung|LK|Mannschaft|Winter)/i.test(x)).slice(0,20)}})()');
 console.log('BTV_DIRECT_ROSTER_META',JSON.stringify({slug,...topMeta}).slice(0,4200));
 const targets=(await call('Target.getTargets')).targetInfos||[];
 const relevant=targets.filter(t=>t.type==='iframe'&&/btv-prod|widget.btv.de/.test(t.url));
 console.log('BTV_PORTRAIT_WIDGETS',JSON.stringify({slug,urls:relevant.map(t=>t.url)}).slice(0,3000));
 for(const target of relevant){
  try{
    const session=(await call('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
    const expression='(() => {const s=document.body?.innerText||"";const h=Array.from(document.querySelectorAll("h1,h2,h3,h4,th,button,a")).map(x=>(x.innerText||"").trim()).filter(x=>/^(Spieler|Spielerliste|Kader|Mannschaft|Meldung|Aufstellung|LK|Pos|Rang|Winter|Einzel|Doppel)/i.test(x)).slice(0,30);return {length:s.length,containsRoster:/Mannschaftsmeldung|Spielerliste|Spieler\\/innen|Meldeliste|Kader/i.test(s),tables:document.querySelectorAll("table").length,rows:document.querySelectorAll("tr").length,headings:h,buttons:document.querySelectorAll("button").length}})()';
    const meta=await evaluate(expression,session);
    console.log('BTV_PORTRAIT_PUBLIC_META',JSON.stringify({slug,...meta}).slice(0,4200));
  }catch(e){console.log('BTV_PORTRAIT_INSPECTION_ERROR',String(e).slice(0,400))}
 }
 ws.close();
} finally { chrome.kill('SIGKILL');try{rmSync(dir,{recursive:true,force:true,maxRetries:6,retryDelay:200})}catch{} }
