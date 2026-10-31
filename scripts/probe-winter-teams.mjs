// Public BTV club embeds: read-only probe with no credentials or names stored.
import {spawnSync} from 'node:child_process';
const urls=[
 'https://btv-prod.burdadigitalsystems.de/btvteams/?clubnr=01012',
 'https://btv-prod.burdadigitalsystems.de/btvmeetings/?clubnr=01012',
 'https://btv-prod.burdadigitalsystems.de/btvevtlist/?club=yes&clubnr=01012'
];
const exe='google-chrome';
for(const url of urls){
 const r=spawnSync(exe,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--virtual-time-budget=14500','--dump-dom',url],{encoding:'utf8',timeout:45000,maxBuffer:5_000_000});
 const html=r.stdout||'';
 const body=html.replace(/<script[\\s\\S]*?<\\/script>/gi,' ').replace(/<style[\\s\\S]*?<\\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\\s+/g,' ').trim();
 console.log('PUBLIC_BTV_WIDGET',JSON.stringify({url,status:r.status,htmlLength:html.length,body:body.slice(0,11000)}));
}
