import { supabase } from '../lib/supabase';
import { escapeHtml } from '../lib/ui';
import { fetchVerifiedEventRsvps } from './event-rsvp-admin';
import { sortRsvpBySurname, type RsvpPdfRow } from './rsvp-report-pdf';

type EventDetails={id:string;title:string;starts_at:string};
type RsvpEntry=RsvpPdfRow&{id:string;event_id:string;member_email:string;updated_at:string};
type Choice='yes'|'maybe'|'no';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T|null;
const categories=[
  ['u10-mixed','U10 gemischt'],['u12-m','U12 männlich'],['u15-m','U15 männlich'],
  ['u18-m','U18 männlich'],['u18-w','U18 weiblich'],
];
const attendanceLabel=(v:string)=>v==='yes'?'Dabei':v==='maybe'?'Vielleicht':'Absage';
let currentEvent:EventDetails|null=null;
let currentHost:HTMLElement|null=null;
let currentRows:RsvpEntry[]=[];
let activeEntry:RsvpEntry|null=null;
let onMutation:(eventId:string)=>Promise<void>=async()=>{};
let noticeToRetry='';
let loading=false;
let saving=false;

function setNotice(message:string,error=false,id=''){
  const target=$<HTMLElement>('rsvp-manage-feedback');
  if(!target)return;
  target.textContent=message;
  target.classList.toggle('is-error',error);
  noticeToRetry=id;
  const retry=$<HTMLButtonElement>('rsvp-manage-retry');
  if(retry)retry.hidden=!id;
}
async function invokeAdmin(payload:Record<string,unknown>):Promise<Record<string,unknown>>{
  const {data,error}=await supabase.functions.invoke('event-rsvp-email',{body:payload});
  if(error){
    let reason='';
    try {const response=error.context as Response|undefined;reason=String((await response?.json())?.error||'');}
    catch {/* keep original SDK error */}
    throw new Error(reason||error.message||'Die Anfrage konnte nicht verarbeitet werden.');
  }
  if(!data||data.error)throw new Error(String(data?.error||'Keine Bestätigung vom Server.'));
  return data as Record<string,unknown>;
}
const summarize=(row:RsvpEntry)=>{
  const contribution=[row.salad_contribution?'Salat: '+row.salad_contribution:'',row.dessert_contribution?'Nachspeise: '+row.dessert_contribution:''].filter(Boolean).join(' · ');
  const helpers=[row.help_setup?'Aufbau':'',row.help_cleanup?'Abbau':''].filter(Boolean).join(' / ');
  const youth=Array.isArray(row.youth_registrations)?row.youth_registrations.length:0;
  const women=Array.isArray(row.women_registrations)?row.women_registrations.length:0;
  const men=Array.isArray(row.men_registrations)?row.men_registrations.length:0;
  return {
    contribution:contribution||'–',helpers:helpers||'–',
    tournaments:(youth?youth+' Jugend ':'')+(women?women+' Damen ':'')+(men?men+' Herren':'')||'–',
  };
};
function renderRows(){
  const target=$<HTMLElement>('rsvp-manage-entries');
  if(!target||!currentEvent)return;
  const needle=($<HTMLInputElement>('rsvp-manage-person-search')?.value||'').trim().toLocaleLowerCase('de');
  const filter=$<HTMLSelectElement>('rsvp-manage-attendance')?.value||'all';
  const visible=currentRows.filter(row=>(!needle||(row.member_name+' '+row.member_email).toLocaleLowerCase('de').includes(needle))
    &&(filter==='all'||row.attendance===filter));
  const count=$<HTMLElement>('rsvp-manage-person-count');
  if(count)count.textContent=visible.length+' von '+currentRows.length+' bestätigten Rückmeldungen';
  target.innerHTML=visible.length?'<div class="rsvp-manage-table-wrap"><table class="rsvp-manage-table">'
    +'<thead><tr><th>Name & E-Mail</th><th>Teilnahme</th><th>Erw. / Kinder</th><th>Beiträge & Helfer</th><th>Meisterschaften</th><th>Aktionen</th></tr></thead><tbody>'
    +visible.map(row=>{
      const details=summarize(row);
      return '<tr><td data-label="Name & E-Mail"><strong>'+escapeHtml(row.member_name)+'</strong><small>'
        +escapeHtml(row.member_email||'E-Mail fehlt')+'</small></td>'
        +'<td data-label="Teilnahme"><span class="rsvp-manage-pill is-'+escapeHtml(row.attendance)+'">'
        +attendanceLabel(row.attendance)+'</span></td>'
        +'<td data-label="Erw. / Kinder">'+Number(row.adults_count||0)+' / '+Number(row.children_count||0)+'</td>'
        +'<td data-label="Beiträge & Helfer">'+escapeHtml(details.contribution)+'<small>'+escapeHtml(details.helpers)+'</small></td>'
        +'<td data-label="Meisterschaften">'+escapeHtml(details.tournaments)+'</td>'
        +'<td data-label="Aktionen"><button type="button" class="button secondary rsvp-manage-edit" data-rsvp-edit="'
        +escapeHtml(row.id)+'">Bearbeiten</button></td></tr>';
    }).join('')+'</tbody></table></div>'
    :'<p class="muted">Keine Rückmeldungen für diesen Filter gefunden.</p>';
}
async function loadRows(){
  if(!currentEvent||loading)return;
  loading=true;
  setNotice('Bestätigte Rückmeldungen werden geladen …');
  try{
    const {data,error}=await fetchVerifiedEventRsvps(currentEvent.id);
    if(error)throw error;
    currentRows=sortRsvpBySurname((data||[]) as RsvpEntry[]) as RsvpEntry[];
    renderRows();
    setNotice('Anmeldungen geladen. Änderungen lösen eine E-Mail an die bestehende bestätigte Adresse aus.');
  }catch(err){
    setNotice('Anmeldungen konnten nicht geladen werden: '+(err instanceof Error?err.message:'Unbekannter Fehler'),true);
  }finally{loading=false;}
}
function renderYouthRow(name='',category='u10-mixed'){
  const target=$<HTMLElement>('rsvp-manage-youth');
  if(!target||target.children.length>=12)return;
  const row=document.createElement('div');
  row.className='rsvp-manage-youth-row';
  row.innerHTML='<input data-youth-name type="text" maxlength="100" aria-label="Jugendlicher Name" placeholder="Vor- und Nachname" value="'
    +escapeHtml(name)+'">'
    +'<select data-youth-category aria-label="Jugend-Altersklasse">'
    +categories.map(([value,label])=>'<option value="'+value+'"'+(value===category?' selected':'')+'>'+label+'</option>').join('')
    +'</select><button type="button" class="button ghost" data-youth-remove aria-label="Jugendmeldung entfernen">Entfernen</button>';
  target.append(row);
}
function showDialog(row:RsvpEntry){
  activeEntry=row;
  const dialog=$<HTMLDialogElement>('rsvp-manage-dialog');
  const form=$<HTMLFormElement>('rsvp-manage-form');
  if(!dialog||!form)return;
  form.reset();
  ($<HTMLElement>('rsvp-manage-dialog-title')!).textContent='Anmeldung von '+row.member_name+' bearbeiten';
  ($<HTMLElement>('rsvp-manage-email')!).textContent=row.member_email||'Keine bestätigte E-Mail-Adresse';
  ($<HTMLInputElement>('rsvp-manage-name')!).value=row.member_name;
  ($<HTMLSelectElement>('rsvp-manage-choice')!).value=row.attendance;
  ($<HTMLInputElement>('rsvp-manage-adults')!).value=String(row.adults_count||0);
  ($<HTMLInputElement>('rsvp-manage-children')!).value=String(row.children_count||0);
  ($<HTMLInputElement>('rsvp-manage-dessert')!).value=row.dessert_contribution||'';
  ($<HTMLInputElement>('rsvp-manage-salad')!).value=row.salad_contribution||'';
  ($<HTMLInputElement>('rsvp-manage-setup')!).checked=!!row.help_setup;
  ($<HTMLInputElement>('rsvp-manage-cleanup')!).checked=!!row.help_cleanup;
  ($<HTMLTextAreaElement>('rsvp-manage-women')!).value=(row.women_registrations||[]).join('\n');
  ($<HTMLTextAreaElement>('rsvp-manage-men')!).value=(row.men_registrations||[]).join('\n');
  const youth=$<HTMLElement>('rsvp-manage-youth')!;
  youth.replaceChildren();
  for(const y of (row.youth_registrations||[]))renderYouthRow(y.name,y.category);
  ($<HTMLElement>('rsvp-manage-delete-confirm')!).hidden=true;
  ($<HTMLElement>('rsvp-manage-edit-fields')!).hidden=false;
  ($<HTMLElement>('rsvp-manage-edit-actions')!).hidden=false;
  ($<HTMLElement>('rsvp-manage-dialog-message')!).textContent='';
  updateChoice();
  dialog.showModal();
}
function updateChoice(){
  const active=($<HTMLSelectElement>('rsvp-manage-choice')?.value||'yes')==='yes';
  const target=$<HTMLElement>('rsvp-manage-yes-details');
  if(target)target.hidden=!active;
  if(active)return;
  // Values are only cleared on save. Switching the selector back to "Dabei"
  // restores the editable fields instead of silently discarding typed content.
}
function readNames(id:string):string[]|null {
  const raw=($<HTMLTextAreaElement>(id)?.value||'').trim();
  if(!raw)return [];
  const names=raw.split(/\r?\n/).map(x=>x.trim());
  return names.length<=12&&names.every(x=>x.length>=2&&x.length<=100)?names:null;
}
function values(){
  const member_name=($<HTMLInputElement>('rsvp-manage-name')?.value||'').trim();
  const attendance=($<HTMLSelectElement>('rsvp-manage-choice')?.value||'yes') as Choice;
  const yes=attendance==='yes';
  const adults_count=yes?Number($<HTMLInputElement>('rsvp-manage-adults')?.value):0;
  const children_count=yes?Number($<HTMLInputElement>('rsvp-manage-children')?.value):0;
  const dessert_contribution=yes?($<HTMLInputElement>('rsvp-manage-dessert')?.value||'').trim():'';
  const salad_contribution=yes?($<HTMLInputElement>('rsvp-manage-salad')?.value||'').trim():'';
  const help_setup=yes&&!!$<HTMLInputElement>('rsvp-manage-setup')?.checked;
  const help_cleanup=yes&&!!$<HTMLInputElement>('rsvp-manage-cleanup')?.checked;
  const women_registrations=yes?readNames('rsvp-manage-women'):[];
  const men_registrations=yes?readNames('rsvp-manage-men'):[];
  const youth_registrations:{name:string;category:string}[]=[];
  if(yes)for(const entry of document.querySelectorAll<HTMLElement>('#rsvp-manage-youth .rsvp-manage-youth-row')){
    youth_registrations.push({
      name:(entry.querySelector<HTMLInputElement>('[data-youth-name]')?.value||'').trim(),
      category:entry.querySelector<HTMLSelectElement>('[data-youth-category]')?.value||'',
    });
  }
  if(member_name.length<2||member_name.length>100
    ||!Number.isInteger(adults_count)||!Number.isInteger(children_count)
    ||adults_count<0||children_count<0||adults_count+children_count>20
    ||(yes&&adults_count+children_count<1)
    ||dessert_contribution.length>180||salad_contribution.length>180
    ||women_registrations===null||men_registrations===null
    ||youth_registrations.length>12
    ||youth_registrations.some(y=>y.name.length<2||y.name.length>100))return null;
  return {member_name,attendance,adults_count,children_count,dessert_contribution,salad_contribution,
    help_setup,help_cleanup,youth_registrations,women_registrations,men_registrations};
}
async function modify(action:'admin-rsvp-update'|'admin-rsvp-delete'){
  if(!activeEntry||!currentEvent||saving)return;
  const patch=action==='admin-rsvp-update'?values():{};
  if(patch===null){($<HTMLElement>('rsvp-manage-dialog-message')!).textContent=
    'Bitte Namen und Personenzahlen sowie alle Turniermeldungen prüfen (maximal 20 Personen).';return;}
  saving=true;
  const button=$<HTMLButtonElement>('rsvp-manage-save');
  if(button)button.disabled=true;
  ($<HTMLElement>('rsvp-manage-dialog-message')!).textContent='Änderung wird sicher gespeichert …';
  const eventId=currentEvent.id;
  try{
    const response=await invokeAdmin({action,rsvp_id:activeEntry.id,
      expected_updated_at:activeEntry.updated_at,values:patch});
    $<HTMLDialogElement>('rsvp-manage-dialog')?.close();
    const noticeId=response.notification_sent===false?String(response.notification_id||''):'';
    setNotice(String(response.message||'Änderung gespeichert.'),!!noticeId,noticeId);
    if(response.saved){
      const previousMessage=String(response.message||'');
      await onMutation(eventId);
      // The event cards have been rebuilt; afterMutation reopens this list.
      setNotice(previousMessage,!!noticeId,noticeId);
    }
  }catch(err){
    ($<HTMLElement>('rsvp-manage-dialog-message')!).textContent=
      err instanceof Error?err.message:'Änderung fehlgeschlagen.';
  }finally{saving=false;if(button)button.disabled=false;}
}
async function retryNotice(){
  if(!noticeToRetry||saving)return;
  const id=noticeToRetry;
  saving=true;
  const retry=$<HTMLButtonElement>('rsvp-manage-retry');
  if(retry)retry.disabled=true;
  try{
    const response=await invokeAdmin({action:'admin-rsvp-retry',notification_id:id});
    const success=response.notification_sent===true;
    setNotice(String(response.message||'Benachrichtigung geprüft.'),!success,success?'':id);
  }catch(err){setNotice('E-Mail konnte nicht erneut versendet werden: '+(err instanceof Error?err.message:''),true,id);}
  finally{saving=false;if(retry)retry.disabled=false;}
}
function createDialog(){
  if($('rsvp-manage-dialog'))return;
  const dialog=document.createElement('dialog');
  dialog.id='rsvp-manage-dialog';
  dialog.className='rsvp-manage-dialog';
  dialog.innerHTML='<form id="rsvp-manage-form">'
    +'<header class="rsvp-manage-dialog__head"><div><p class="eyebrow">TSV Feldkirchen · Anmeldung</p>'
    +'<h3 id="rsvp-manage-dialog-title">Anmeldung bearbeiten</h3><p class="muted">Bestätigte E-Mail: '
    +'<strong id="rsvp-manage-email"></strong> (nicht veränderbar)</p></div>'
    +'<button type="button" class="rsvp-manage-close" data-rsvp-close aria-label="Schließen">×</button></header>'
    +'<div id="rsvp-manage-edit-fields" class="rsvp-manage-edit-fields">'
    +'<label>Name<input id="rsvp-manage-name" required maxlength="100" autocomplete="off"></label>'
    +'<label>Teilnahme<select id="rsvp-manage-choice"><option value="yes">Dabei</option>'
    +'<option value="maybe">Vielleicht</option><option value="no">Absage</option></select></label>'
    +'<div id="rsvp-manage-yes-details" class="rsvp-manage-yes-details">'
    +'<div class="rsvp-manage-inline-fields"><label>Erwachsene<input id="rsvp-manage-adults" type="number" min="0" max="20"></label>'
    +'<label>Kinder/Jugendliche<input id="rsvp-manage-children" type="number" min="0" max="20"></label></div>'
    +'<div class="rsvp-manage-inline-fields"><label>Salat/Vorspeise<input id="rsvp-manage-salad" maxlength="180"></label>'
    +'<label>Kuchen/Nachspeise<input id="rsvp-manage-dessert" maxlength="180"></label></div>'
    +'<div class="rsvp-manage-checks"><label><input id="rsvp-manage-setup" type="checkbox"> Hilfe Aufbau</label>'
    +'<label><input id="rsvp-manage-cleanup" type="checkbox"> Hilfe Abbau</label></div>'
    +'<fieldset><legend>Jugendmeisterschaft</legend><div id="rsvp-manage-youth"></div>'
    +'<button type="button" class="button secondary" data-youth-add>Jugendmeldung hinzufügen</button></fieldset>'
    +'<div class="rsvp-manage-inline-fields"><label>Damenmeisterschaft (eine Person pro Zeile)'
    +'<textarea id="rsvp-manage-women" rows="3"></textarea></label><label>Herrenmeisterschaft (eine Person pro Zeile)'
    +'<textarea id="rsvp-manage-men" rows="3"></textarea></label></div></div></div>'
    +'<div id="rsvp-manage-delete-confirm" class="rsvp-manage-confirm" hidden>'
    +'<h4>Anmeldung wirklich löschen?</h4><p>Die Rückmeldung wird dauerhaft aus der Teilnehmerliste entfernt. '
    +'Die betroffene Person wird per E-Mail informiert.</p>'
    +'<div class="rsvp-manage-dialog__actions"><button type="button" class="button secondary" data-delete-cancel>Abbrechen</button>'
    +'<button type="button" class="button rsvp-manage-danger" data-delete-approve>Endgültig löschen</button></div></div>'
    +'<p id="rsvp-manage-dialog-message" role="status" aria-live="polite"></p>'
    +'<footer id="rsvp-manage-edit-actions" class="rsvp-manage-dialog__actions">'
    +'<button type="button" class="button secondary" data-rsvp-close>Abbrechen</button>'
    +'<button type="button" class="button rsvp-manage-danger" data-delete-start>Anmeldung löschen</button>'
    +'<button type="submit" class="button" id="rsvp-manage-save">Speichern & E-Mail senden</button></footer>'
    +'</form>';
  document.body.append(dialog);
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.querySelectorAll('[data-rsvp-close]').forEach(b=>b.addEventListener('click',()=>dialog.close()));
  dialog.querySelector('[data-youth-add]')?.addEventListener('click',()=>renderYouthRow());
  dialog.querySelector('#rsvp-manage-youth')?.addEventListener('click',e=>{
    if(e.target instanceof Element)e.target.closest('[data-youth-remove]')?.closest('.rsvp-manage-youth-row')?.remove();
  });
  $<HTMLSelectElement>('rsvp-manage-choice')?.addEventListener('change',updateChoice);
  dialog.querySelector('[data-delete-start]')?.addEventListener('click',()=>{
    ($<HTMLElement>('rsvp-manage-delete-confirm')!).hidden=false;
    ($<HTMLElement>('rsvp-manage-edit-fields')!).hidden=true;
    ($<HTMLElement>('rsvp-manage-edit-actions')!).hidden=true;
  });
  dialog.querySelector('[data-delete-cancel]')?.addEventListener('click',()=>{
    ($<HTMLElement>('rsvp-manage-delete-confirm')!).hidden=true;
    ($<HTMLElement>('rsvp-manage-edit-fields')!).hidden=false;
    ($<HTMLElement>('rsvp-manage-edit-actions')!).hidden=false;
  });
  dialog.querySelector('[data-delete-approve]')?.addEventListener('click',()=>void modify('admin-rsvp-delete'));
  dialog.querySelector('form')?.addEventListener('submit',e=>{e.preventDefault();void modify('admin-rsvp-update');});
}

export async function openRsvpManager(event:EventDetails,host:HTMLElement,afterMutation:(eventId:string)=>Promise<void>){
  if(currentHost&&currentHost!==host){
    currentHost.hidden=true;
    currentHost.closest('.rsvp-export-card')?.classList.remove('is-open');
  }
  currentEvent=event;currentHost=host;currentRows=[];onMutation=afterMutation;noticeToRetry='';
  host.hidden=false;
  host.closest('.rsvp-export-card')?.classList.add('is-open');
  host.innerHTML='<div class="rsvp-manage-head"><div><h4>Bestätigte Anmeldungen</h4>'
    +'<p id="rsvp-manage-person-count" class="muted"></p></div>'
    +'<button type="button" class="button secondary" data-rsvp-hide>Schließen</button></div>'
    +'<div class="rsvp-manage-controls"><label>Person suchen<input id="rsvp-manage-person-search" type="search" placeholder="Name oder E-Mail"></label>'
    +'<label>Teilnahme<select id="rsvp-manage-attendance"><option value="all">Alle Antworten</option>'
    +'<option value="yes">Zusagen</option><option value="maybe">Vielleicht</option><option value="no">Absagen</option></select></label></div>'
    +'<p id="rsvp-manage-feedback" class="muted" role="status" aria-live="polite"></p>'
    +'<button id="rsvp-manage-retry" type="button" class="button secondary" hidden>E-Mail erneut senden</button>'
    +'<div id="rsvp-manage-entries"></div>';
  host.querySelector('[data-rsvp-hide]')?.addEventListener('click',()=>{
    host.hidden=true;host.closest('.rsvp-export-card')?.classList.remove('is-open');
    currentHost=null;currentEvent=null;activeEntry=null;
  });
  host.querySelector('#rsvp-manage-person-search')?.addEventListener('input',renderRows);
  host.querySelector('#rsvp-manage-attendance')?.addEventListener('change',renderRows);
  host.querySelector('#rsvp-manage-retry')?.addEventListener('click',()=>void retryNotice());
  host.querySelector('#rsvp-manage-entries')?.addEventListener('click',evt=>{
    if(!(evt.target instanceof Element))return;
    const id=evt.target.closest<HTMLElement>('[data-rsvp-edit]')?.dataset.rsvpEdit;
    const item=currentRows.find(row=>row.id===id);
    if(item){createDialog();showDialog(item);}
  });
  await loadRows();
}
