import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const username=process.env.BTV_LOGIN_USERNAME;
const password=process.env.BTV_LOGIN_PASSWORD;
if(!username||!password)throw new Error('BTV_LOGIN_USERNAME and BTV_LOGIN_PASSWORD are required');

const work=mkdtempSync(join(tmpdir(),'btv-cockpit-'));
const jar=join(work,'cookies.txt');
const login=join(work,'login.html');
const result=join(work,'result.html');
const entry='https://www.btv.de/de/mein-verein/vereins-cockpit.html';
const curl=(args)=>execFileSync('curl',['--fail','--silent','--show-error',...args],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
const decode=(value)=>value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');

try{
  const loginUrl=curl(['--location','--cookie-jar',jar,'--output',login,'--write-out','%{url_effective}',entry]).trim();
  const html=readFileSync(login,'utf8');
  const form=html.match(/<form[^>]+id="loginForm"[\s\S]*?<\/form>/i)?.[0];
  if(!form)throw new Error('Official BTV login form not found');
  const action=decode(form.match(/action="([^"]+)"/i)?.[1]||'');
  const formdata=decode(form.match(/name="t:formdata"[^>]*value="([^"]+)"|value="([^"]+)"[^>]*name="t:formdata"/i)?.slice(1).find(Boolean)||'');
  const accessContext=decode(form.match(/name="t:ac"[^>]*value="([^"]+)"|value="([^"]+)"[^>]*name="t:ac"/i)?.slice(1).find(Boolean)||'tende/btv');
  if(!action||!formdata)throw new Error('Official BTV login form is incomplete');
  const postUrl=new URL(action,loginUrl).href;
  const finalUrl=curl([
    '--location','--cookie',jar,'--cookie-jar',jar,'--output',result,'--write-out','%{url_effective}',
    '--data-urlencode',`t:ac=${accessContext}`,'--data-urlencode',`t:formdata=${formdata}`,
    '--data-urlencode',`username=${username}`,'--data-urlencode',`password=${password}`,
    '--data-urlencode','submit_0=Anmelden',postUrl
  ]).trim();
  const page=readFileSync(result,'utf8');
  if(/id="loginForm"|placeholder="Passwort"/i.test(page))throw new Error('BTV login was not accepted');
  const links=[...page.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match)=>({href:decode(match[1]),text:match[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}))
    .filter((link)=>/(download|meldung|mannschaft|dokument|portal|cockpit|verein)/i.test(`${link.text} ${link.href}`))
    .map((link)=>({text:link.text.slice(0,120),url:new URL(link.href,finalUrl).href.replace(/([?&](?:code|state|token|session)=[^&]+)/gi,'')}));
  const frames=[...page.matchAll(/<iframe\b[^>]*src="([^"]+)"/gi)].map((match)=>new URL(decode(match[1]),finalUrl).href);
  const forms=[...page.matchAll(/<form\b[^>]*action="([^"]+)"/gi)].map((match)=>new URL(decode(match[1]),finalUrl).href);
  const portalTargets=[...new Set([...page.matchAll(/https?:\\?\/\\?\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+/gi)]
    .map((match)=>decode(match[0].replace(/\\\//g,'/')))
    .filter((url)=>/(liga\.nu|nuLiga|portal)/i.test(url))
    .map((url)=>url.replace(/([?&](?:code|state|token|session)=[^&]+)/gi,'')))];
  const scripts=[...new Set([...page.matchAll(/<script\b[^>]*src="([^"]+)"/gi)].map((match)=>new URL(decode(match[1]),finalUrl).href))];
  console.log(JSON.stringify({authenticated:true,host:new URL(finalUrl).host,path:new URL(finalUrl).pathname,frames,forms,portalTargets,scripts,links:links.slice(0,40)},null,2));
}finally{
  rmSync(work,{recursive:true,force:true});
}
