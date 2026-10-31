// Read-only investigation of public club season links. No database access.
const urls=[
 'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/clubInfoDisplay?club=23391',
 'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/clubInfoDisplay?club=23391&season=18105'
];
for (const url of urls) {
 const controller = new AbortController();
 const timeout=setTimeout(()=>controller.abort(),11000);
 try {
  const r=await fetch(url,{headers:{Accept:'text/html','User-Agent':'TSV-Feldkirchen-Tennis-Season-AvailabilityCheck/1.0'},redirect:'follow',signal:controller.signal});
  const body=(await r.text()).slice(0,140000);
  console.log('PAGE:',r.status,r.headers.get('content-type'),r.url,'length',body.length);
  const links=[...body.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for(const [_,href,label] of links.slice(0,300)) {
   if (/season|winter|sommer|meisterschaft|saison|spielplan|202[67]|18105/i.test(href+' '+label))
    console.log('SEASON LINK',href.slice(0,200),'LABEL',label.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,110));
  }
  console.log('HTML HEADER',body.slice(0,260).replace(/\s+/g,' '));
 }catch(e){console.log('REQUEST STOPPED',String(e).slice(0,260));}
 finally {clearTimeout(timeout);}
}
