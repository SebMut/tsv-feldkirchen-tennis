// Sommer 2026: read-only public meeting link discovery (identifiers only).
// No public CI log may contain player names or individual scores.
const pages=[
  'https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2216736',
  'https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2165579',
  'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/groupPage?group=2216736',
  'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/leaguePage?group=2216736',
  'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/clubInfo?club=23391',
  'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/meetingReport?meeting=12696831',
  'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?dokument=MeetingReportFOP&meeting=12696831'
];
for(const url of pages){
 const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),14000);
 try{
  const res=await fetch(url,{signal:ctrl.signal,redirect:'follow',headers:{'User-Agent':'TSV-Feldkirchen-2026-MeetingLinksAudit/1.0'}});
  if(res.status===403||res.status===429){console.log('BTV_LINK_SOURCE='+JSON.stringify({path:new URL(url).pathname,status:res.status,blocked:true}));break}
  const type=res.headers.get('content-type')||'';
  const buf=Buffer.from(await res.arrayBuffer());
  const html=buf.length<1500000&&(/text|html/i.test(type)||buf.toString('ascii',0,15).includes('<!DOCTYPE'))?buf.toString('utf8'):'';
  const meetings=[...new Set([...html.matchAll(/(?:meeting=|meeting(?:Id)?["'=:\s]+)(\d{7,9})/gi)].map(m=>m[1]))].slice(0,140);
  const iframes=[...html.matchAll(/<iframe[^>]+src=["']([^"']{1,250})/gi)].map(m=>m[1]).filter(x=>/btv|tennis|liga/i.test(x)).slice(0,6);
  const groups=[...new Set([...html.matchAll(/(?:groupid|group)=([0-9]{7,8})/gi)].map(m=>m[1]))].slice(0,30);
  console.log('BTV_LINK_SOURCE='+JSON.stringify({path:new URL(url).pathname,keys:new URL(url).searchParams.keys().toArray(),status:res.status,type,bytes:buf.length,
    finalHost:new URL(res.url).host,meetings,iframes,groups,
    title:html.match(/<title[^>]*>([^<]{0,140})/i)?.[1]?.trim()||null}));
 }catch(e){console.log('BTV_LINK_SOURCE='+JSON.stringify({path:new URL(url).pathname,error:String(e.message||e).slice(0,110)}))}
 finally{clearTimeout(tm)}
 await new Promise(r=>setTimeout(r,450));
}
