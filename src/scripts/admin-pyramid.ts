import {supabase} from '../lib/supabase';
import {escapeHtml,setStatus} from '../lib/ui';
import {scoreWinner,canChallenge,canQualifyAgainst,defaultMasterSeason} from '../lib/pyramid-rules.mjs';

type Ladder={id:string;title:string;season_label:string;starts_on:string;ends_on:string;seeded_at:string|null;active:boolean};
type Entry={id:string;display_name:string;position:number;qualified:boolean;lk_rating:number|null;neutralized_at?:string|null;neutralized_reason?:string|null};
type Join={id:string;display_name:string;status:string};
type Match={id:string;challenger_id:string;defender_id:string;status:string;score:string|null;created_at:string;winner_id:string|null;decline_reason?:string|null;source?:string;play_deadline?:string|null;scheduled_for?:string|null;refusal_reason?:string|null;proposed_winner_id?:string|null;proposed_score?:string|null;confirmation_deadline?:string|null;dispute_reason?:string|null;weather_extended_at?:string|null;overdue_extended_at?:string|null;no_show_requested_at?:string|null;no_show_reporter_id?:string|null};
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T|null;
let ladders:Ladder[]=[];
let ladderId='';
let entries:Entry[]=[];
let requests:Join[]=[];
let challenges:Match[]=[];
let initialized=false;
let isSuperAdmin=false;
const msg=(value:string,tone:'info'|'success'|'error'='info')=>{
 const target=$('pyramid-admin-notice');
 if(!target)return;
 target.classList.remove('hidden');setStatus(target,value,tone);
};
const display=(id:string,markup:string)=>{
 const target=$(id);
 if(target)target.innerHTML=markup;
};
const label=(id:string)=>entries.find(e=>e.id===id)?.display_name||'Teilnehmer';
function render(){
 const select=$<HTMLSelectElement>('pyramid-admin-ladder');
 if(select){
  select.innerHTML=ladders.map(l=>'<option value="'+l.id+'">'+escapeHtml(l.title+' · '+l.season_label)+'</option>').join('');
  select.value=ladderId;
 }
 const pending=requests.filter(r=>r.status==='pending');
 display('pyramid-admin-pending',!ladders.length
  ?'<p class="muted">Lege zuerst eine Rangliste an.</p>'
  :pending.length?pending.map(r=>
   '<div class="pyramid-admin-item"><strong>'+escapeHtml(r.display_name)+'</strong>'
   +'<button class="button secondary" type="button" data-pyramid-admin-approve="'+r.id+'">Teilnahme freigeben</button></div>'
  ).join(''):'<p class="muted">Keine offenen Anfragen.</p>');
 const current=ladders.find(l=>l.id===ladderId);
 const ranked=entries.filter(e=>e.qualified);
 const pendingQualifiers=entries.filter(e=>!e.qualified);
 const manualSeed=!current?.seeded_at;
 display('pyramid-admin-order',ranked.length?ranked.map((e,i)=>
   '<div class="pyramid-admin-item"><span><strong>#'+e.position+'</strong> · '+escapeHtml(e.display_name)
   +(e.lk_rating!=null?' · LK '+e.lk_rating.toFixed(1):' · ohne LK')
   +(e.neutralized_at?' · Neutralisiert ('+escapeHtml(e.neutralized_reason||'')+')':'')+'</span>'
   +'<div class="pyramid-admin-lk">'
   +'<select aria-label="Verfügbarkeit '+escapeHtml(e.display_name)+'" data-pyramid-admin-neutral="'+e.id+'">'
   +[['','Spielbereit'],['injury','Verletzung'],['illness','Krankheit'],['vacation','Urlaub'],['other','Abwesend']]
     .map(([value,label])=>'<option value="'+value+'"'+((e.neutralized_reason||'')===value?' selected':'')+'>'+label+'</option>').join('')
   +'</select>'
   +(isSuperAdmin?'<label>LK <input type="number" min="1" max="25" step="0.1" aria-label="LK von '
      +escapeHtml(e.display_name)+'" data-pyramid-admin-lk="'+e.id+'" value="'
      +(e.lk_rating==null?'':e.lk_rating)+'" placeholder="z. B. 12.5" /></label>':'')
   +'<button type="button" data-pyramid-admin-move="'+e.id+'" data-delta="-1"'
   +(i===0?' disabled':'')+' aria-label="'+escapeHtml(e.display_name)+' nach oben">↑</button>'
   +'<button type="button" data-pyramid-admin-move="'+e.id+'" data-delta="1"'
   +(i===ranked.length-1?' disabled':'')+' aria-label="'+escapeHtml(e.display_name)+' nach unten">↓</button></div>'
   +(isSuperAdmin?'<button class="button danger pyramid-admin-delete" type="button" data-pyramid-admin-delete="'
     +e.id+'" data-player-name="'+escapeHtml(e.display_name)+'">Spieler löschen</button>':'')+'</div>'
 ).join(''):'<p class="muted">Keine eingeordneten Spieler.</p>');
 display('pyramid-admin-qualifiers',pendingQualifiers.length
  ?'<h4>Ältere, noch nicht eingeordnete Einträge</h4><p class="muted">Im Master-Regelwerk werden neue Mitglieder unmittelbar auf den letzten Rang gesetzt. Bitte alte Einträge prüfen.</p>'
    +pendingQualifiers.map(e=>'<div class="pyramid-admin-qualifier">'+escapeHtml(e.display_name)+'</div>').join('')
  :'');
 const archive=$<HTMLButtonElement>('pyramid-admin-archive');
 const reactivate=$<HTMLButtonElement>('pyramid-admin-reactivate');
 if(archive)archive.disabled=!current||!current.active;
 if(reactivate)reactivate.disabled=!current||current.active;
 const sort=$<HTMLButtonElement>('pyramid-admin-sort-lk');
 if(sort)sort.disabled=!manualSeed||ranked.length<2;
 renderPrivateForm();
 const finish=$<HTMLButtonElement>('pyramid-admin-finalize');
 if(finish){
  finish.disabled=!current||!!current.seeded_at||entries.length<2;
  finish.textContent=current?.seeded_at?'Startaufstellung festgelegt':'Startaufstellung abschließen';
 }
 const statuses:Record<string,string>={pending:'Offene Forderung',
   accepted:'Angenommen',result_pending:'Ergebnis wartet auf Bestätigung',
   result_disputed:'Ergebnis strittig',completed:'Bestätigt und beendet',
   declined:'Abgelehnt',forfeit:'Kampflos gewertet',cancelled:'Ohne Wertung beendet'};
 display('pyramid-admin-challenges',challenges.length?challenges.map(ch=>{
   const open=['pending','accepted'].includes(ch.status);
   const deadline=ch.play_deadline||new Date(new Date(ch.created_at).getTime()+14*86400000).toISOString();
   const overdue=open&&new Date(deadline).getTime()<Date.now();
   const awaitingResult=['result_pending','result_disputed'].includes(ch.status);
   return '<div class="pyramid-admin-item"><span><strong>'
     +escapeHtml(label(ch.challenger_id))+' → '+escapeHtml(label(ch.defender_id))+'</strong>'
     +'<small style="display:block">'+escapeHtml(statuses[ch.status]||ch.status)
     +(ch.source==='private'?' · Persönlich vereinbart':'')
     +(ch.scheduled_for?' · Spieltermin: '+new Intl.DateTimeFormat('de-DE',{dateStyle:'short',
       timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(ch.scheduled_for)):'')
     +(overdue?' · 14-Tage-Frist überschritten':'')
     +(ch.refusal_reason?' · Absageprüfung: '+escapeHtml(ch.refusal_reason):'')
     +(ch.no_show_requested_at?' · Nichtantreten gemeldet: '+escapeHtml(label(ch.no_show_reporter_id||'')):'')
     +(ch.proposed_score?' · Vorgeschlagen: '+escapeHtml(label(ch.proposed_winner_id||''))
       +' '+escapeHtml(ch.proposed_score):'')
     +(ch.dispute_reason?' · Widerspruch: '+escapeHtml(ch.dispute_reason):'')
     +(ch.confirmation_deadline&&ch.status==='result_pending'
       ?' · Bestätigung bis: '+new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',
         timeZone:'Europe/Berlin'}).format(new Date(ch.confirmation_deadline)):'')
     +(ch.score?' · Endstand: '+escapeHtml(ch.score):'')+'</small></span>'
     +'<div class="actions">'
     +(ch.refusal_reason&&open
       ?'<button class="button secondary" type="button" data-pyramid-admin-valid-refusal="'+ch.id+'">Absage anerkennen</button>'
        +'<button class="button secondary" type="button" data-pyramid-admin-invalid-refusal="'+ch.id+'">Kampflos werten</button>':'')
     +(ch.status==='accepted'&&!ch.refusal_reason&&!overdue
       ?'<button class="button secondary" type="button" data-pyramid-admin-report="'+ch.id+'">Ergebnis melden</button>':'')
     +(awaitingResult
       ?'<button class="button secondary" type="button" data-pyramid-admin-approve-result="'+ch.id+'">Ergebnis bestätigen</button>'
        +'<button class="button secondary" type="button" data-pyramid-admin-edit-result="'+ch.id+'">Ergebnis korrigieren</button>'
        +'<button class="button secondary" type="button" data-pyramid-admin-reject-result="'+ch.id+'">Meldung zurückweisen</button>':'')
     +(isSuperAdmin&&ch.status==='completed'
       ?'<button class="button secondary" type="button" data-pyramid-admin-edit-result="'+ch.id+'">Ergebnis ändern</button>':'')
     +(ch.no_show_requested_at&&ch.status==='accepted'
       ?'<button class="button secondary" type="button" data-pyramid-admin-approve-noshow="'+ch.id+'">Nichtantreten werten</button>'
        +'<button class="button secondary" type="button" data-pyramid-admin-reject-noshow="'+ch.id+'">Nichtantreten ablehnen</button>':'')
     +(open&&!ch.weather_extended_at
       ?'<button class="button secondary" type="button" data-pyramid-admin-weather="'+ch.id+'">Wetterverlängerung</button>':'')
     +(overdue
       ?'<button class="button secondary" type="button" data-pyramid-admin-extend="'+ch.id+'"'
          +(ch.overdue_extended_at?' disabled':'')+'>Frist verlängern</button>'
        +'<button class="button secondary" type="button" data-pyramid-admin-cancel="'+ch.id+'">Ohne Wertung schließen</button>'
        +'<button class="button secondary" type="button" data-pyramid-admin-forfeit="'+ch.id
          +'" data-winner="'+ch.challenger_id+'">Kampflos: '+escapeHtml(label(ch.challenger_id))+'</button>'
        +'<button class="button secondary" type="button" data-pyramid-admin-forfeit="'+ch.id
          +'" data-winner="'+ch.defender_id+'">Kampflos: '+escapeHtml(label(ch.defender_id))+'</button>':'')
     +'</div></div>';
 }).join(''):'<p class="muted">Noch keine Forderungen.</p>');
 const ongoing=challenges.filter(ch=>['accepted','result_pending','result_disputed'].includes(ch.status)
   ||(isSuperAdmin&&ch.status==='completed'));
 const scheduleMatches=$<HTMLSelectElement>('pyramid-admin-schedule-match');
 if(scheduleMatches){
   scheduleMatches.innerHTML=ongoing.filter(ch=>ch.status==='accepted').map(ch=>'<option value="'+ch.id+'">'
      +escapeHtml(label(ch.challenger_id)+' gegen '+label(ch.defender_id))+'</option>').join('');
   scheduleMatches.disabled=!ongoing.some(ch=>ch.status==='accepted');
 }
 const scheduleButton=$<HTMLButtonElement>('pyramid-admin-schedule-form')?.querySelector<HTMLButtonElement>('button[type="submit"]');
 if(scheduleButton)scheduleButton.disabled=!ongoing.some(ch=>ch.status==='accepted');
 const matches=$<HTMLSelectElement>('pyramid-admin-match');
 if(matches){
  matches.innerHTML=ongoing.map(ch=>'<option value="'+ch.id+'">'
   +escapeHtml(label(ch.challenger_id)+' gegen '+label(ch.defender_id))+'</option>').join('');
  matches.disabled=ongoing.length===0;
 }
 renderWinner();
 const trigger=$<HTMLButtonElement>('pyramid-admin-result-open');
 if(trigger)trigger.disabled=ongoing.length===0;
 const form=$<HTMLFormElement>('pyramid-admin-result');
 form?.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach(button=>button.disabled=ongoing.length===0);
}
function renderPrivateForm(){
 const challenger=$<HTMLSelectElement>('pyramid-admin-private-challenger');
 const defender=$<HTMLSelectElement>('pyramid-admin-private-defender');
 if(!challenger||!defender)return;
 const old=challenger.value;
 challenger.innerHTML=entries.map(e=>'<option value="'+e.id+'">'
   +escapeHtml(e.display_name)+(e.qualified?' · #'+e.position:' · Qualifikation')+'</option>').join('');
 if(entries.some(e=>e.id===old))challenger.value=old;
 const current=entries.find(e=>e.id===challenger.value);
 const previous=defender.value;
 const busy=new Set(challenges.filter(c=>['pending','accepted','result_pending','result_disputed'].includes(c.status))
   .flatMap(c=>[c.challenger_id,c.defender_id]));
 const eligible=entries.filter(target=>target.qualified&&(!target.neutralized_at||Date.now()-new Date(target.neutralized_at).getTime()>=28*86400000)
   &&current?.id!==target.id&&!busy.has(target.id)&&(!current||!busy.has(current.id))
   &&(!current?.neutralized_at||Date.now()-new Date(current.neutralized_at).getTime()>=28*86400000)
   &&(current?.qualified
     ?canChallenge(current.position,target.position)
     :canQualifyAgainst(target.position,entries)));
 defender.innerHTML=eligible.map(target=>'<option value="'+target.id+'">'
   +escapeHtml(target.display_name+' · #'+target.position)+'</option>').join('');
 if(eligible.some(target=>target.id===previous))defender.value=previous;
 const form=$<HTMLFormElement>('pyramid-admin-private-challenge');
 form?.querySelectorAll<HTMLButtonElement>('button[type="submit"]')
   .forEach(button=>button.disabled=eligible.length===0);
}
function renderWinner(){
 const id=$<HTMLSelectElement>('pyramid-admin-match')?.value;
 const game=challenges.find(c=>c.id===id);
 const field=$<HTMLSelectElement>('pyramid-admin-winner');
 if(!field)return;
 field.innerHTML=game?[game.challenger_id,game.defender_id].map(id=>
  '<option value="'+id+'">'+escapeHtml(label(id))+'</option>').join(''):'';
 if(game?.proposed_winner_id)field.value=game.proposed_winner_id;
 const score=$<HTMLInputElement>('pyramid-admin-score');
 if(score)score.value=game?.proposed_score||'';
}
async function callRpc(functionName:string,args:Record<string,unknown>){
 const {error}=await supabase.rpc(functionName,args);
 if(error)throw error;
}
async function load(){
 const {data,error}=await supabase.from('pyramid_ladders')
  .select('id,title,season_label,starts_on,ends_on,seeded_at,active')
  .order('starts_on',{ascending:false}).order('title');
 if(error)throw error;
 ladders=(data||[]) as Ladder[];
 if(!ladders.some(l=>l.id===ladderId))ladderId=ladders[0]?.id||'';
 await loadSelected();
}
async function loadSelected(){
 if(!ladderId){entries=[];requests=[];challenges=[];render();return;}
 const [players,joins,encounters]=await Promise.all([
  supabase.from('pyramid_entries').select('id,display_name,position,qualified,lk_rating,neutralized_at,neutralized_reason')
   .eq('ladder_id',ladderId).order('position'),
  supabase.from('pyramid_requests').select('id,display_name,status')
   .eq('ladder_id',ladderId),
  supabase.from('pyramid_challenges')
   .select('id,challenger_id,defender_id,status,score,created_at,winner_id,decline_reason,source,play_deadline,scheduled_for,refusal_reason,proposed_winner_id,proposed_score,confirmation_deadline,dispute_reason,weather_extended_at,overdue_extended_at,no_show_requested_at,no_show_reporter_id')
   .eq('ladder_id',ladderId).order('created_at',{ascending:false}).limit(100)
 ]);
 for(const result of [players,joins,encounters])if(result.error)throw result.error;
 entries=(players.data||[]) as Entry[];
 requests=(joins.data||[]) as Join[];
 challenges=(encounters.data||[]) as Match[];
 render();
}
const act=async(run:()=>Promise<unknown>,success:string,reloadAll=false)=>{
 try{await run();msg(success,'success');if(reloadAll)await load();else await loadSelected();}
 catch(e){msg('Änderung nicht gespeichert: '+String((e as Error).message||e),'error');}
};
export function initPyramidAdmin(canManage:boolean,superAdmin=false){
 const panel=$('panel-pyramid');
 if(!panel||!canManage||initialized)return;
 isSuperAdmin=superAdmin;
 initialized=true;
 panel.classList.remove('hidden');
 const summer=defaultMasterSeason();
 for(const [id,value] of [
   ['pyramid-admin-season',summer.label],
   ['pyramid-admin-from',summer.startsOn],
   ['pyramid-admin-until',summer.endsOn]
 ]){
   const input=$<HTMLInputElement>(id);
   if(input&&!input.value)input.value=value;
 }
 const dialog=$<HTMLDialogElement>('pyramid-admin-result-dialog');
 const resultForm=$<HTMLFormElement>('pyramid-admin-result');
 const modalError=$('pyramid-admin-result-error');
 const closeModal=()=>dialog?.close();
 function openModal(matchId?:string){
   if(!dialog)return;
   const selector=$<HTMLSelectElement>('pyramid-admin-match');
   if(matchId&&selector)selector.value=matchId;
   renderWinner();
   if(modalError){modalError.textContent='';modalError.classList.add('hidden');}
   dialog.showModal();
   $<HTMLInputElement>('pyramid-admin-score')?.focus();
 }
 const reportError=(message:string)=>{
   if(!modalError)return;
   modalError.textContent=message;modalError.classList.remove('hidden');
 };
 $('pyramid-admin-result-open')?.addEventListener('click',()=>openModal());
 $('pyramid-admin-result-close')?.addEventListener('click',closeModal);
 $('pyramid-admin-result-cancel')?.addEventListener('click',closeModal);
 dialog?.addEventListener('click',event=>{
   if(event.target===dialog)closeModal();
 });
 $('pyramid-admin-challenges')?.addEventListener('click',event=>{
   const target=(event.target as Element).closest<HTMLButtonElement>('button');
   if(!target)return;
   if(target.dataset.pyramidAdminReport){openModal(target.dataset.pyramidAdminReport);return;}
   if(target.dataset.pyramidAdminEditResult){openModal(target.dataset.pyramidAdminEditResult);return;}
   if(target.dataset.pyramidAdminApproveResult||target.dataset.pyramidAdminRejectResult){
     const approve=!!target.dataset.pyramidAdminApproveResult;
     const id=target.dataset.pyramidAdminApproveResult||target.dataset.pyramidAdminRejectResult;
     if(confirm(approve?'Ergebnis bestätigen und Rangliste aktualisieren?'
       :'Ergebnismeldung zurückweisen und zur erneuten Meldung öffnen?'))
       void act(()=>callRpc('pyramid_decide_result',{p_challenge:id,p_approve:approve}),
         approve?'Ergebnis bestätigt, Rangliste aktualisiert.':'Ergebnis zurückgewiesen.');
     return;
   }
   if(target.dataset.pyramidAdminApproveNoshow||target.dataset.pyramidAdminRejectNoshow){
     const approve=!!target.dataset.pyramidAdminApproveNoshow;
     const id=target.dataset.pyramidAdminApproveNoshow||target.dataset.pyramidAdminRejectNoshow;
     if(confirm(approve?'Nichtantreten nach 15 Minuten bestätigen und kampflos werten?'
       :'Nichtantreten-Meldung zurückweisen?'))
       void act(()=>callRpc('pyramid_decide_no_show',{p_challenge:id,p_approve:approve}),
         approve?'Nichtantreten gewertet.':'Nichtantreten abgelehnt.');
     return;
   }
   if(target.dataset.pyramidAdminWeather){
     const raw=prompt('Wetterverlängerung einmalig um wie viele Tage (1 bis 7)?','7');
     if(raw===null)return;
     const days=Number(raw);
     if(!Number.isInteger(days)||days<1||days>7){msg('Bitte eine Zahl von 1 bis 7 angeben.','error');return;}
     if(confirm('Wetterverlängerung um '+days+' Tag(e) verbindlich eintragen?'))
       void act(()=>callRpc('pyramid_extend_weather',{
         p_challenge:target.dataset.pyramidAdminWeather,p_days:days
       }),'Wetterverlängerung eingetragen.');
     return;
   }
   const overdueId=target.dataset.pyramidAdminExtend||target.dataset.pyramidAdminCancel||
     target.dataset.pyramidAdminForfeit;
   if(overdueId){
     const action=target.dataset.pyramidAdminExtend?'extend':
       target.dataset.pyramidAdminCancel?'cancel':'forfeit';
     const winner=target.dataset.winner||null;
     if(confirm(action==='extend'?'Spielfrist um 7 Tage verlängern?':
       action==='cancel'?'Forderung ohne Wertung schließen?':
       'Überfällige Forderung kampflos für '+label(winner||'')+' werten?'))
       void act(()=>callRpc('pyramid_resolve_overdue',{
         p_challenge:overdueId,p_action:action,p_winner:winner
       }),'Fristentscheidung gespeichert.');
     return;
   }
   if(target.dataset.pyramidAdminValidRefusal){
     if(confirm('Triftigen Absagegrund anerkennen und Forderung ohne Wertung streichen?'))
       void act(()=>callRpc('pyramid_resolve_refusal',{p_challenge:target.dataset.pyramidAdminValidRefusal,p_valid:true}),
         'Absage anerkannt. Forderung ohne Wertung geschlossen.');
     return;
   }
   if(target.dataset.pyramidAdminInvalidRefusal){
     if(confirm('Absage ohne triftigen Grund: Forderung als Sieg des Herausforderers werten?'))
       void act(()=>callRpc('pyramid_resolve_refusal',{p_challenge:target.dataset.pyramidAdminInvalidRefusal,p_valid:false}),
         'Nicht begründete Absage als Niederlage gewertet.');
     return;
   }

 });
 $<HTMLFormElement>('pyramid-admin-schedule-form')?.addEventListener('submit',event=>{
   event.preventDefault();
   const id=$<HTMLSelectElement>('pyramid-admin-schedule-match')?.value;
   const input=$<HTMLInputElement>('pyramid-admin-schedule-date')?.value;
   const date=input?new Date(input):null;
   if(!id||!date||Number.isNaN(date.getTime())){msg('Bitte Spiel und gültigen Termin auswählen.','error');return;}
   void act(()=>callRpc('pyramid_schedule_match',{
     p_challenge:id,p_date:date.toISOString()
   }),'Verbindlicher Spieltermin eingetragen.');
 });
 $('pyramid-admin-refresh')?.addEventListener('click',()=>void act(async()=>{},'Aktualisiert.',true));
 $('pyramid-admin-archive')?.addEventListener('click',()=>{
   if(!ladderId||!confirm('Diese Saison archivieren? Die Rangfolge bleibt erhalten, neue Forderungen sind gesperrt.'))return;
   void act(async()=>{
     const {error}=await supabase.from('pyramid_ladders').update({active:false}).eq('id',ladderId);
     if(error)throw error;
   },'Saison archiviert.',true);
 });
 $('pyramid-admin-reactivate')?.addEventListener('click',()=>{
   if(!ladderId||!confirm('Saison wieder aktivieren? Forderungen sind nur innerhalb des Saisonzeitraums möglich.'))return;
   void act(async()=>{
     const {error}=await supabase.from('pyramid_ladders').update({active:true}).eq('id',ladderId);
     if(error)throw error;
   },'Saison aktiviert.',true);
 });
 $<HTMLSelectElement>('pyramid-admin-ladder')?.addEventListener('change',event=>{
  ladderId=(event.target as HTMLSelectElement).value;
  void act(async()=>{},'Rangliste gewechselt.');
 });
 $<HTMLSelectElement>('pyramid-admin-match')?.addEventListener('change',renderWinner);
 $<HTMLFormElement>('pyramid-admin-create')?.addEventListener('submit',event=>{
  event.preventDefault();
  const name=$<HTMLInputElement>('pyramid-admin-title')?.value.trim()||'';
  const season=$<HTMLInputElement>('pyramid-admin-season')?.value.trim()||'';
  const from=$<HTMLInputElement>('pyramid-admin-from')?.value||'';
  const to=$<HTMLInputElement>('pyramid-admin-until')?.value||'';
  if(name.length<3||season.length<3||!from||!to||to<from){msg('Bitte gültige Rangliste und Zeitraum angeben.','error');return;}
  void act(async()=>{
   const {data,error}=await supabase.from('pyramid_ladders')
    .insert({title:name,season_label:season,starts_on:from,ends_on:to})
    .select('id').single();
   if(error||!data)throw error||new Error('Rangliste konnte nicht angelegt werden.');
   ladderId=data.id;
   $<HTMLFormElement>('pyramid-admin-create')?.reset();
  },'Neue Rangliste angelegt.',true);
 });
 $('pyramid-admin-pending')?.addEventListener('click',event=>{
  const id=(event.target as Element).closest<HTMLButtonElement>('[data-pyramid-admin-approve]')?.dataset.pyramidAdminApprove;
  if(id)void act(()=>callRpc('pyramid_approve_join',{p_request:id}),'Teilnahme freigegeben.');
 });
 $('pyramid-admin-order')?.addEventListener('change',event=>{
  const neutral=(event.target as Element).closest<HTMLSelectElement>('[data-pyramid-admin-neutral]');
  if(neutral){
    void act(()=>callRpc('pyramid_set_neutralized',{
      p_entry:neutral.dataset.pyramidAdminNeutral,p_reason:neutral.value||null
    }),neutral.value?'Spieler neutralisiert.':'Spieler wieder spielbereit.');
    return;
  }
  const input=(event.target as Element).closest<HTMLInputElement>('[data-pyramid-admin-lk]');
  if(!input)return;
  const raw=input.value.trim().replace(',','.');
  const number=raw?Number(raw):null;
  if(number!==null&&(!Number.isFinite(number)||number<1||number>25)){
    msg('LK muss zwischen 1.0 und 25.0 liegen. Leeres Feld = ohne LK.','error');return;
  }
  void act(()=>callRpc('pyramid_set_lk',{p_entry:input.dataset.pyramidAdminLk,p_lk:number}),
    'LK-Wert gespeichert.');
 });
 $('pyramid-admin-sort-lk')?.addEventListener('click',()=>{
  if(!ladderId||!confirm('Startaufstellung nach LK sortieren (unbekannte LK ans Ende)?'))return;
  void act(()=>callRpc('pyramid_sort_seed_by_lk',{p_ladder:ladderId}),
    'Startaufstellung nach LK sortiert.');
 });
 $<HTMLSelectElement>('pyramid-admin-private-challenger')?.addEventListener('change',renderPrivateForm);
 $<HTMLFormElement>('pyramid-admin-private-challenge')?.addEventListener('submit',event=>{
  event.preventDefault();
  const challenger=$<HTMLSelectElement>('pyramid-admin-private-challenger')?.value;
  const defender=$<HTMLSelectElement>('pyramid-admin-private-defender')?.value;
  const accepted=$<HTMLInputElement>('pyramid-admin-private-accepted')?.checked||false;
  if(!challenger||!defender){msg('Bitte ein zulässiges Forderungspaar auswählen.','error');return;}
  if(!confirm(accepted
   ?'Bestätigst du, dass die geforderte Person das privat vereinbarte Spiel bereits angenommen hat?'
   :'Soll die privat ausgesprochene Forderung verbindlich eingetragen werden?'))return;
  void act(async()=>{
    await callRpc('pyramid_register_private_challenge',{
      p_challenger:challenger,p_defender:defender,p_already_accepted:accepted
    });
    const checkbox=$<HTMLInputElement>('pyramid-admin-private-accepted');
    if(checkbox)checkbox.checked=false;
  },accepted?'Private Forderung und Annahme gespeichert.':'Private Forderung angelegt; die geforderte Person wird per E-Mail benachrichtigt.');
 });
 $('pyramid-admin-order')?.addEventListener('click',event=>{
  const remove=(event.target as Element).closest<HTMLButtonElement>('[data-pyramid-admin-delete]');
  if(remove){
   if(!isSuperAdmin)return;
   const player=remove.dataset.playerName||'Diesen Spieler';
   if(confirm(player+' wirklich aus dieser Forderungspyramide löschen? Zugehörige Forderungen und Ergebnisse werden ebenfalls gelöscht. Das Benutzerkonto bleibt bestehen.'))
    void act(()=>callRpc('pyramid_delete_entry',{p_entry:remove.dataset.pyramidAdminDelete}),
      player+' wurde aus der Forderungspyramide gelöscht.');
   return;
  }
  const button=(event.target as Element).closest<HTMLButtonElement>('[data-pyramid-admin-move]');
  if(!button||button.disabled)return;
  void act(()=>callRpc('pyramid_move_entry',{p_entry:button.dataset.pyramidAdminMove,p_delta:Number(button.dataset.delta)}),'Rangfolge aktualisiert.');
 });
 $('pyramid-admin-finalize')?.addEventListener('click',()=>{
  if(!ladderId||!confirm('Sind die LK-Werte und die Reihenfolge geprüft? Startaufstellung verbindlich abschließen?'))return;
  void act(()=>callRpc('pyramid_finalize_seed',{p_ladder:ladderId}),'Startaufstellung abgeschlossen.',true);
 });
 resultForm?.addEventListener('submit',event=>{
   event.preventDefault();
   const id=$<HTMLSelectElement>('pyramid-admin-match')?.value;
   const winner=$<HTMLSelectElement>('pyramid-admin-winner')?.value;
   const score=$<HTMLInputElement>('pyramid-admin-score')?.value.trim()||'';
   if(!id||!winner||scoreWinner(score)!==1){
     reportError('Bitte zwei gültige Gewinnsätze aus Sicht des Siegers eintragen, zum Beispiel 6:4, 4:6, 10:8.');
     return;
   }
   const button=$<HTMLButtonElement>('pyramid-admin-result-save');
   if(button?.disabled)return;
   if(button)button.disabled=true;
   void (async()=>{
     try{
       const match=challenges.find(ch=>ch.id===id);
       if(!match)throw new Error('Forderung nicht gefunden');
       if(match.status==='completed'){
         if(!isSuperAdmin)throw new Error('Nur Superadmins dürfen abgeschlossene Ergebnisse ändern.');
         await callRpc('pyramid_correct_completed_result',{
           p_challenge:id,p_winner:winner,p_score:score
         });
       }else if(['result_pending','result_disputed'].includes(match.status)){
         await callRpc('pyramid_decide_result',{
           p_challenge:id,p_approve:true,p_winner:winner,p_score:score
         });
       }else{
         await callRpc('pyramid_report_result',{p_challenge:id,p_score:score,p_winner:winner});
       }
       dialog?.close();
       const input=$<HTMLInputElement>('pyramid-admin-score');
       if(input)input.value='';
       await loadSelected();
       msg('Ergebnis gemeldet beziehungsweise Streitfall verbindlich entschieden. Ohne Bestätigung bleibt die Rangfolge unverändert.','success');
     }catch(error){
       reportError('Ergebnis konnte nicht gespeichert werden: '+String((error as Error)?.message||error));
     }finally{if(button)button.disabled=false;}
   })();
 });
 void load().catch(error=>msg('Ranglisten nicht erreichbar: '+error.message,'error'));
}
