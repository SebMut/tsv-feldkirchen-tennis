// Reproducible Lighthouse audit of the built Astro preview (mobile profile).
// Writes full HTML/JSON reports and a compact summary for CI artifacts.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const host='http://127.0.0.1:4321';
const base=(process.env.PREVIEW_BASE || '/').replace(/^\/+|\/+$/g,'');
const output=resolve('artifacts/lighthouse');
const routes=[['startseite','/'],['aktuelles','/aktuelles/'],['spieltag','/spieltag/']];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const preview=spawn(resolve('node_modules/.bin/astro'),['preview','--host','127.0.0.1','--port','4321','--strictPort'],
  {env:process.env,stdio:'ignore'});
try{
  await mkdir(output,{recursive:true});
  let ready=false;
  for(let n=0;n<70;n++){try{const r=await fetch(host+(base?'/'+base:'')+'/');if(r.ok){ready=true;break;}}catch{}
    if(preview.exitCode!==null)break;
    await sleep(350);
  }
  if(!ready)throw Error('Astro preview unavailable');
  const report=[];
  for(const [name,route] of routes){
    const target=host+(base?'/'+base:'')+route;
    const args=['node_modules/lighthouse/cli/index.js',target,'--quiet','--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
      '--only-categories=performance,accessibility,best-practices','--output=json','--output=html',
      '--output-path='+resolve(output,name)];
    const exit=await new Promise((res,rej)=>{
      const child=spawn(process.execPath,args,{env:process.env,stdio:'inherit'});
      child.once('error',rej);child.once('exit',code=>res(code));
    });
    if(exit!==0)throw Error('Lighthouse exited with '+exit+' for '+name);
    const data=JSON.parse(await readFile(resolve(output,name+'.report.json'),'utf8'));
    report.push({page:name,url:target,
      performance:data.categories?.performance?.score,
      accessibility:data.categories?.accessibility?.score,
      best_practices:data.categories?.['best-practices']?.score,
      lcp_ms:data.audits?.['largest-contentful-paint']?.numericValue ?? null,
      cls:data.audits?.['cumulative-layout-shift']?.numericValue ?? null});
  }
  await writeFile(resolve(output,'summary.json'),JSON.stringify({generated_at:new Date().toISOString(),reports:report},null,2)+'\n');
  console.log('[lighthouse] '+JSON.stringify(report));
}catch(error){console.error(error);process.exitCode=1;}
finally{if(preview.exitCode===null)preview.kill('SIGTERM');}
