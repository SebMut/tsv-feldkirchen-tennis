import { supabase } from '../lib/supabase';
import { escapeHtml } from '../lib/ui';
import { fetchVerifiedEventRsvps } from './event-rsvp-admin';
import { downloadRsvpPdf } from './rsvp-report-pdf';

type EventRow = {
  id: string; title: string; slug: string; starts_at: string;
  status: string; rsvp_enabled: boolean;
  rsvp_details: Record<string, unknown> | null;
};
type CountRow = { id: string; event_id: string; attendance: string; adults_count: number; children_count: number };
type Totals = { responses: number; yes: number; maybe: number; no: number; adults: number; children: number };
const emptyTotals = ():Totals=>({responses:0,yes:0,maybe:0,no:0,adults:0,children:0});
const $ = <T extends HTMLElement>(id:string)=>document.getElementById(id) as T|null;
const fmt=(num:number)=>new Intl.NumberFormat('de-DE').format(num);
const niceDate=(iso:string)=>new Date(iso).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'});
let initialized=false;
let busy=false;
let loaded=false;
let events:EventRow[]=[];
let totals=new Map<string,Totals>();

const info=(text:string,error=false)=>{
  const target=$<HTMLElement>('rsvp-export-status');
  if(!target)return;
  target.textContent=text;
  target.classList.toggle('is-error',error);
};

function render(){
  const target=$<HTMLElement>('rsvp-export-cards');
  if(!target)return;
  const search=($<HTMLInputElement>('rsvp-export-search')?.value||'').trim().toLocaleLowerCase('de');
  const filter=$<HTMLSelectElement>('rsvp-export-filter')?.value||'all';
  const now=Date.now();
  const entries=events
    .filter(event=>event.rsvp_enabled || (totals.get(event.id)?.responses||0)>0)
    .filter(event=>event.title.toLocaleLowerCase('de').includes(search))
    .filter(event=>filter==='all'||(filter==='upcoming'?new Date(event.starts_at).getTime()>=now:new Date(event.starts_at).getTime()<now))
    .sort((a,b)=>{
      const af=new Date(a.starts_at).getTime()>=now,bf=new Date(b.starts_at).getTime()>=now;
      if(af!==bf)return af?-1:1;
      return af? a.starts_at.localeCompare(b.starts_at) : b.starts_at.localeCompare(a.starts_at);
    });
  const eligible=events.filter(event=>event.rsvp_enabled||(totals.get(event.id)?.responses||0)>0);
  const combined=eligible.reduce((sum,event)=>{
    const row=totals.get(event.id)||emptyTotals();
    sum.yes+=row.yes;
    sum.adults+=row.adults;
    sum.children+=row.children;
    return sum;
  },emptyTotals());
  const eventNumber=$<HTMLElement>('rsvp-export-events-count');
  const yesNumber=$<HTMLElement>('rsvp-export-yes-count');
  const peopleNumber=$<HTMLElement>('rsvp-export-persons-count');
  if(eventNumber)eventNumber.textContent=fmt(eligible.length);
  if(yesNumber)yesNumber.textContent=fmt(combined.yes);
  if(peopleNumber)peopleNumber.textContent=fmt(combined.adults+combined.children);

  target.innerHTML=entries.length ? entries.map(event=>{
    const count=totals.get(event.id)||emptyTotals();
    const status=event.status==='published'?'Veröffentlicht':event.status==='archived'?'Archiviert':'Entwurf';
    const inactive=event.rsvp_enabled?'':' · Anmeldung geschlossen';
    return '<article class="rsvp-export-card" data-export-event-card="'+escapeHtml(event.id)+'">'+
      '<div class="rsvp-export-card__head"><div><p class="eyebrow">Veranstaltung</p><h3>'+escapeHtml(event.title)+'</h3>'+
      '<p class="rsvp-export-card__date">'+escapeHtml(niceDate(event.starts_at))+'</p></div>'+
      '<span class="rsvp-export-card__status">'+escapeHtml(status+inactive)+'</span></div>'+
      '<div class="rsvp-export-card__stats" aria-label="Bestätigte Rückmeldungen">'+
        '<div><strong>'+fmt(count.yes)+'</strong><span>Zusagen</span></div>'+
        '<div><strong>'+fmt(count.adults+count.children)+'</strong><span>Personen</span></div>'+
        '<div><strong>'+fmt(count.adults)+'</strong><span>Erwachsene</span></div>'+
        '<div><strong>'+fmt(count.children)+'</strong><span>Kinder</span></div></div>'+
      '<p class="rsvp-export-card__foot">'+fmt(count.maybe)+' Vielleicht · '+fmt(count.no)+' Absagen'+
        (count.responses===0?' · Noch keine bestätigten Antworten':'')+'</p>'+
      '<button type="button" class="button rsvp-export-card__download" data-export-event="'+escapeHtml(event.id)+'">'+
        '<span aria-hidden="true">↓</span> PDF herunterladen</button>'+
      '</article>';
  }).join(''):'<div class="card rsvp-export-empty"><h3>Keine Veranstaltungen gefunden</h3><p class="muted">'+
      (search||filter!=='all'?'Versuche einen anderen Suchbegriff oder wähle „Alle Veranstaltungen“.':'Sobald eine Veranstaltung mit Anmeldung vorhanden ist, wird sie hier angezeigt.')+
      '</p></div>';
  if(loaded)info(fmt(entries.length)+' von '+fmt(eligible.length)+' Veranstaltungen angezeigt. PDFs enthalten nur bestätigte Anmeldungen.');
}

async function loadConfirmedCounts():Promise<Map<string,Totals>>{
  const result=new Map<string,Totals>();
  const size=500;
  // Only attendance/count columns; personal details are loaded on a deliberate PDF click.
  for(let offset=0;;offset+=size){
    const {data,error}=await supabase.from('event_rsvps')
      .select('id,event_id,attendance,adults_count,children_count')
      .not('verified_at','is',null)
      .order('id',{ascending:true}).range(offset,offset+size-1);
    if(error)throw error;
    for(const r of (data||[]) as CountRow[]){
      const row=result.get(r.event_id)||emptyTotals();
      row.responses++;
      if(r.attendance==='yes'){
        row.yes++;
        row.adults+=Number(r.adults_count||0);
        row.children+=Number(r.children_count||0);
      }else if(r.attendance==='maybe')row.maybe++;
      else if(r.attendance==='no')row.no++;
      result.set(r.event_id,row);
    }
    if(!data||data.length<size)break;
  }
  return result;
}

async function refresh(){
  if(busy)return;
  busy=true;
  loaded=false;
  info('Veranstaltungen und Anmeldungen werden geladen …');
  const refreshButton=$<HTMLButtonElement>('rsvp-export-reload');
  if(refreshButton)refreshButton.disabled=true;
  try{
    const [eventResponse,countMap]=await Promise.all([
      supabase.from('events').select('id,title,slug,starts_at,status,rsvp_enabled,rsvp_details')
        .order('starts_at',{ascending:false}).limit(500),
      loadConfirmedCounts(),
    ]);
    if(eventResponse.error)throw eventResponse.error;
    events=(eventResponse.data||[]) as EventRow[];
    totals=countMap;
    loaded=true;
    render();
  }catch(err){
    const msg=err instanceof Error?err.message:'Unbekannter Datenbankfehler';
    info('Anmeldungen konnten nicht geladen werden: '+msg,true);
    if(!events.length){
      const container=$<HTMLElement>('rsvp-export-cards');
      if(container)container.innerHTML='<div class="card"><p class="muted">Bitte erneut versuchen. Die bestehenden Anmeldedaten bleiben unverändert.</p></div>';
    }
  }finally{
    busy=false;
    if(refreshButton)refreshButton.disabled=false;
  }
}

async function download(eventId:string,button:HTMLButtonElement){
  const event=events.find(row=>row.id===eventId);
  if(!event||button.disabled)return;
  const original=button.innerHTML;
  button.disabled=true;
  button.textContent='PDF wird erstellt …';
  info('Bestätigte Anmeldungen für „'+event.title+'“ werden aktuell abgerufen …');
  try{
    const {data,error}=await fetchVerifiedEventRsvps(event.id);
    if(error)throw error;
    // Even if an event has no answers, the PDF contains the event's empty
    // participant overview and the explicit zero totals.
    downloadRsvpPdf({
      title:event.title,slug:event.slug,starts_at:event.starts_at,
      rsvp_details:event.rsvp_details||{},
    },data||[]);
    info('PDF für „'+event.title+'“ wurde zum Download bereitgestellt.');
    // Count may have changed since this panel loaded.
    void refresh();
  }catch(err){
    info('PDF für „'+event.title+'“ konnte nicht erstellt werden: '+(err instanceof Error?err.message:'Unbekannter Fehler'),true);
  }finally{
    button.disabled=false;
    button.innerHTML=original;
  }
}

export function initRsvpExportAdmin(canEvents:boolean){
  if(!canEvents || initialized || !$<HTMLElement>('panel-rsvp-export'))return;
  initialized=true;
  $<HTMLInputElement>('rsvp-export-search')?.addEventListener('input',render);
  $<HTMLSelectElement>('rsvp-export-filter')?.addEventListener('change',render);
  $<HTMLButtonElement>('rsvp-export-reload')?.addEventListener('click',()=>void refresh());
  $<HTMLElement>('rsvp-export-cards')?.addEventListener('click',(event)=>{
    if(!(event.target instanceof Element))return;
    const btn=event.target.closest<HTMLButtonElement>('button[data-export-event]');
    const id=btn?.dataset.exportEvent;
    if(btn&&id)void download(id,btn);
  });
  document.addEventListener('tsv:rsvp-export-open',()=>void refresh());
  window.addEventListener('tsv:editorial-content-changed',()=>{
    if($<HTMLElement>('panel-rsvp-export')?.classList.contains('active'))void refresh();
    else loaded=false;
  });
}
