// Read-only official BTV club team list probe; prints team names only, no personal data.
import {spawnSync} from 'node:child_process';
const url='https://btv-prod.burdadigitalsystems.de/btvteams/?clubnr=01012';
for (const exe of ['google-chrome','chromium','chromium-browser']) {
 const check=spawnSync('which',[exe],{encoding:'utf8'});
 if(check.status!==0) continue;
 console.log('CHROME_BINARY',exe);
 const r=spawnSync(exe,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--virtual-time-budget=16000','--dump-dom',url],{encoding:'utf8',timeout:90000,maxBuffer:7_000_000});
 console.log('RENDER_STATUS',r.status,'error',r.error?.message,'len',r.stdout?.length,'stderr_tail',r.stderr?.slice(-200));
 const html=r.stdout||'';
 let text=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
 console.log('BTV_RENDERED_TEXT',text.slice(0,13500));
 console.log('BTV_RENDERED_HTML',html.slice(0,9000));
 break;
}
