import { SUPABASE_URL } from '../lib/supabase';

type Venue={id:string;short:string;name:string;distance:string;bookingUrl:string};
type LiveSlot={venueId:string;date:string;start:string;end:string;court?:string;availableCourts?:number;price?:string;bookingUrl:string};
type LiveResponse={checkedAt:string;sources:Record<string,{status:string;message?:string}>;slots:LiveSlot[]};
const venues:Venue[]=[
 {id:'aschheim',short:'Aschheim',name:'TC Aschheim',distance:'2,2 km Luftlinie von TSV Feldkirchen aus',bookingUrl:'https://tcaschheim.ebusy.de/'},
 {id:'ismaning',short:'Ismaning',name:'TC Ismaning',distance:'11,2 km Luftlinie von TSV Feldkirchen aus',bookingUrl:'https://tc-ismaning.ebusy.de/court-module/921'},
 {id:'sporttraum',short:'Sporttraum',name:'SPORTTRAUM',distance:'3,0 km Luftlinie von TSV Feldkirchen aus',bookingUrl:'https://www.sporttraum.de/buchen/'},
 {id:'haar',short:'Haar',name:'Racket-Park TSV Haar',distance:'3,3 km Luftlinie von TSV Feldkirchen aus',bookingUrl:'https://www.eversports.de/sb/racket-park-tsv-haar'},
 {id:'rothof',short:'Rothof',name:'Rothof München',distance:'7,2 km Luftlinie von TSV Feldkirchen aus',bookingUrl:'https://rothof.de/online-buchen/'},
 {id:'kirchheim',short:'Kirchheim',name:'TC Kirchheim',distance:'4,6 km Luftlinie von TSV Feldkirchen aus',bookingUrl:'https://tckirchheim.tennisplatz.info/reservierung?c=2015'}
];
const pad=(v:number)=>String(v).padStart(2,'0');
const iso=(d:Date)=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseDate=(v:string)=>{const[y,m,d]=v.split('-').map(Number);return new Date(y,m-1,d,12)};
const day=(d:Date)=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}).format(d);
const long=(d:Date)=>new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long'}).format(d);
const time=(h:number)=>pad(h)+':00';
const esc=(value:string)=>value.replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[char]!));
function bookingUrl(v:Venue,d:Date){if(v.id!=='kirchheim')return v.bookingUrl;const seconds=Math.floor(new Date(d.getFullYear(),d.getMonth(),d.getDate(),12).getTime()/1000);return v.bookingUrl+'&d='+seconds}
function fill(select:HTMLSelectElement,min:number,max:number,selected:number){for(let h=min;h<=max;h++){const o=document.createElement('option');o.value=String(h);o.textContent=time(h);o.selected=h===selected;select.append(o)}}
function slotHour(value:string){return Number(value.slice(0,2))+Number(value.slice(3,5))/60}
function byTime(a:LiveSlot,b:LiveSlot){
 return slotHour(a.start)-slotHour(b.start)||slotHour(a.end)-slotHour(b.end)||(a.court||'').localeCompare(b.court||'','de');
}
function isUpcoming(slot:LiveSlot){
 const now=new Date(),today=iso(now),current=pad(now.getHours())+':'+pad(now.getMinutes());
 return slot.date>today||(slot.date===today&&slot.start>current);
}
function slotText(slot:LiveSlot){
 const detail=slot.venueId==='aschheim'||slot.venueId==='ismaning'
  ? (slot.availableCourts||1)+' '+(slot.availableCourts===1?'Platz':'Plätze')+' frei'
  : [slot.court,slot.price].filter(Boolean).join(' · ');
 return '<a class="hall-slot-live" data-hall-venue="'+esc(slot.venueId)+'" href="'+esc(slot.bookingUrl)+'" target="_blank" rel="noopener noreferrer"><strong>'+esc(slot.start)+'–'+esc(slot.end)+'</strong><span>'+esc(detail)+'</span></a>';
}
function venueName(v:Venue){return '<div class="hall-slot__venue"><span class="hall-slot__initial" aria-hidden="true">'+esc(v.short[0])+'</span><div><strong>'+esc(v.name)+'</strong><small>'+esc(v.distance)+'</small></div></div>'}
function loadingCard(d:Date,first:number,last:number){
 return '<article class="hall-day-card is-loading"><header><div><p>'+day(d)+'</p><span>'+time(first)+'–'+time(last)+' Uhr</span></div><span class="hall-day-card__count">Wird geladen …</span></header><div class="hall-day-card__venues">'+venues.map(v=>'<div class="hall-slot">'+venueName(v)+'<div class="hall-slot__availability"><span class="hall-slot-note">Freie Zeiten werden geprüft …</span></div></div>').join('')+'</div></article>';
}
function fallbackCard(d:Date,first:number,last:number){
 return '<article class="hall-day-card"><header><div><p>'+day(d)+'</p><span>'+time(first)+'–'+time(last)+' Uhr</span></div><span class="hall-day-card__count is-muted">Direkt prüfen</span></header><div class="hall-day-card__venues">'+venues.map(v=>'<div class="hall-slot">'+venueName(v)+'<div class="hall-slot__availability"><span class="hall-slot-note">Live beim Anbieter prüfen</span></div><a class="hall-slot__booking" data-hall-venue="'+esc(v.id)+'" href="'+bookingUrl(v,d)+'" target="_blank" rel="noopener noreferrer">Kalender <span aria-hidden="true">↗</span></a></div>').join('')+'</div></article>';
}
function liveCard(d:Date,first:number,last:number,live:LiveResponse){
 const date=iso(d);
 const cells=venues.map(v=>{
  const slots=live.slots.filter(slot=>isUpcoming(slot)&&slot.venueId===v.id&&slot.date===date&&slotHour(slot.start)>=first&&slotHour(slot.end)<=last).sort(byTime);
  const source=live.sources[v.id];
  const content=slots.length
   ? '<div class="hall-slot-times">'+slots.map(slotText).join('')+'</div>'
   : source?.status==='live'
    ? '<span class="hall-slot-empty">Nichts frei</span>'
    : '<span class="hall-slot-note">'+esc(source?.message||'Live beim Anbieter prüfen')+'</span>';
  const href=slots[0]?.bookingUrl||bookingUrl(v,d);
  return '<div class="hall-slot">'+venueName(v)+'<div class="hall-slot__availability">'+content+'</div><a class="hall-slot__booking" data-hall-venue="'+esc(v.id)+'" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(v.name+' am '+long(d)+' im Buchungskalender prüfen')+'">Kalender <span aria-hidden="true">↗</span></a></div>';
 }).join('');
 const freeTimes=new Set(live.slots.filter(slot=>isUpcoming(slot)&&slot.date===date&&slotHour(slot.start)>=first&&slotHour(slot.end)<=last).map(slot=>slot.venueId+'|'+slot.start+'|'+slot.end)).size;
 return '<article class="hall-day-card"><header><div><p>'+day(d)+'</p><span>'+time(first)+'–'+time(last)+' Uhr</span></div><span class="hall-day-card__count">'+freeTimes+' '+(freeTimes===1?'freie Zeit':'freie Zeiten')+'</span></header><div class="hall-day-card__venues">'+cells+'</div></article>';
}
export function initHallFinder(){
 const form=document.querySelector<HTMLFormElement>('#hall-search-form'),from=document.querySelector<HTMLInputElement>('#hall-date-from'),to=document.querySelector<HTMLInputElement>('#hall-date-to'),start=document.querySelector<HTMLSelectElement>('#hall-time-from'),end=document.querySelector<HTMLSelectElement>('#hall-time-to'),target=document.querySelector<HTMLElement>('#hall-results-grid'),summary=document.querySelector<HTMLElement>('#hall-results-summary'),status=document.querySelector<HTMLElement>('#hall-live-status'),strip=document.querySelector<HTMLElement>('#hall-venue-strip');
 if(!form||!from||!to||!start||!end||!target||!summary||!status||!strip)return;
 fill(start,7,22,7);fill(end,8,24,23);const q=new URLSearchParams(location.search),today=new Date();today.setHours(12,0,0,0);const plus=new Date(today);plus.setDate(plus.getDate()+3);from.value=q.get('von')||iso(today);to.value=q.get('bis')||iso(plus);start.value=q.get('start')||'7';end.value=q.get('ende')||'23';
 strip.innerHTML=venues.map(v=>'<article class="hall-venue-chip"><span>'+v.short[0]+'</span><div><strong>'+v.short+'</strong><small>'+v.distance+'</small></div></article>').join('');
 let requestId=0;
 const render=async()=>{
  const currentRequest=++requestId,firstDate=parseDate(from.value),lastDate=parseDate(to.value),first=Number(start.value),last=Number(end.value),count=Math.floor((lastDate.getTime()-firstDate.getTime())/86400000)+1;
  if(count<1||count>7||last<=first){summary.textContent=count>7?'Bitte höchstens sieben Tage auswählen.':'Bitte Zeitraum und Spielzeit prüfen.';status.textContent='';target.innerHTML='';return}
  const dates=Array.from({length:count},(_,i)=>{const d=new Date(firstDate);d.setDate(d.getDate()+i);return d});
  summary.textContent=long(firstDate)+' bis '+long(lastDate)+' · '+time(first)+'–'+time(last)+' Uhr';
  status.textContent='Aktuelle freie Plätze werden geladen …';status.className='hall-live-status is-loading';
  target.innerHTML=dates.map(d=>loadingCard(d,first,last)).join('');
  history.replaceState({},'',location.pathname+'?'+new URLSearchParams({von:from.value,bis:to.value,start:start.value,ende:end.value}));
  try{
   const nonce=Date.now();
   const liveDays=await Promise.all(dates.map(async(d,index)=>{const date=iso(d),api=new URL(SUPABASE_URL+'/functions/v1/hall-availability');api.searchParams.set('from',date);api.searchParams.set('to',date);api.searchParams.set('_',String(nonce+index));const response=await fetch(api,{cache:'no-store',headers:{Accept:'application/json'}});if(!response.ok)throw new Error('HTTP '+response.status);return response.json() as Promise<LiveResponse>}));if(currentRequest!==requestId)return;
   target.innerHTML=dates.map((d,index)=>liveCard(d,first,last,liveDays[index])).join('');
   const checkedAt=liveDays.reduce((latest,live)=>live.checkedAt>latest?live.checkedAt:latest,'');const checked=new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit'}).format(new Date(checkedAt));status.textContent='Live geprüft um '+checked+' Uhr · Preise nur bei eindeutiger Anbieterangabe';status.className='hall-live-status is-success';
  }catch{if(currentRequest!==requestId)return;status.textContent='Die Live-Abfrage ist gerade nicht erreichbar. Bitte direkt beim Anbieter prüfen.';status.className='hall-live-status is-error';target.innerHTML=dates.map(d=>fallbackCard(d,first,last)).join('')}
 };
 form.addEventListener('submit',e=>{e.preventDefault();void render();document.querySelector('#hall-results-title')?.scrollIntoView({behavior:'smooth',block:'start'})});document.querySelector<HTMLButtonElement>('#hall-copy-search')?.addEventListener('click',async e=>{const b=e.currentTarget as HTMLButtonElement;try{await navigator.clipboard.writeText(location.href);b.textContent='Link kopiert ✓';setTimeout(()=>b.textContent='Suche teilen',1800)}catch{b.textContent='Link oben kopieren'}});void render();
}
