// Read-only discovery of public team-to-group BTV links, no player data.
const urls=[
 'https://btv-prod.burdadigitalsystems.de/btvteams/?clubnr=01012',
 'https://btv-prod.burdadigitalsystems.de/btvteams/?clubnr=01012&season=2026',
 'https://services.tennis.de/extern/tennisdeteamsearch.zul?verband=BTV&verein=01012&linkfarbe=20aebd',
 'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/clubTeams?club=23391',
 'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/clubTeams?club=23391&season=18105',
 'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/clubInfo?club=23391',
 'https://www.tennis-tsvfeldkirchen.de/jugendmannschaften/',
 'https://www.tennis-tsvfeldkirchen.de/herrenmannschaften/',
 'https://www.tennis-tsvfeldkirchen.de/damenmannschaften/'
];
for(const url of urls){
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),19000);
  try{
    const res=await fetch(url,{signal:ctrl.signal,headers:{Accept:'text/html',
      'User-Agent':'TSV-Feldkirchen-Tennis-PublicGroupLinkAudit/1.0'}});
    const text=(await res.text()).slice(0,700000);
    const ids=[...new Set([...text.matchAll(/(?:groupid=|group=|groupId["':\s]+)(\d{7,8})/g)].map(m=>m[1]))];
    const assets=[...new Set([...text.matchAll(/(?:src|href)=["']([^"']+\.js(?:\?[^"']*)?)/gi)].map(m=>m[1]))].slice(0,10);
    const iframes=[...new Set([...text.matchAll(/<iframe[^>]+src=["']([^"']+)/gi)].map(m=>m[1]))].slice(0,8);
    const matchLinks=[...text.matchAll(/<a\b[^>]*href=["']([^"']+(?:groupid|nuLiga)[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(m=>({url:m[1].replace(/&amp;/g,'&'),text:m[2].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,55)})).slice(0,30);
    console.log('CLUB_LINK_PROBE='+JSON.stringify({url,http:res.status,bytes:text.length,ids:ids.slice(0,60),assets,iframes,matchLinks,
      hints:[...new Set([...text.matchAll(/.{0,35}(?:Sommer\s*2026|Mannschaften|nuLiga|Bambini|btvteams|api\/).{0,65}/gi)]
        .map(m=>m[0].replace(/\s+/g,' ').slice(0,120)))].slice(0,7)}).slice(0,14000));
  }catch(e){console.log('CLUB_LINK_PROBE='+JSON.stringify({url,error:String(e.message||e)}));}
  finally{clearTimeout(timer)}
}
