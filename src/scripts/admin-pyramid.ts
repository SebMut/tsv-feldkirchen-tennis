import {supabase} from '../lib/supabase';
import {escapeHtml,setStatus} from '../lib/ui';
import {scoreWinner} from '../lib/pyramid-rules.mjs';

type Ladder={id:string;title:string;season_label:string;starts_on:string;ends_on:string;seeded_at:string|null};
type Entry={id:string;display_name:string;position:number};
type Join={id:string;display_name:string;status:string};
type Match={id:string;challenger_id:string;defender_id:string;status:string;score:string|null;created_at:string;winner_id:string|null};
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T|null;
let ladders:Ladder[]=[];
let ladderId='';
let entries:Entry[]=[];
let requests:Join[]=[];
let challenges:Match[]=[];
let initialized=false;
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
 display('pyramid-admin-order',entries.length?entries.map((e,i)=>
  '<div class="pyramid-admin-item"><span><strong>#'+e.position+'</strong> · '+escapeHtml(e.display_name)+'</span>'
  +'<div class="actions"><button type="button" data-pyramid-admin-move="'+e.id+'" data-delta="-1"'
  +(i===0?' disabled':'')+' aria-label="'+escapeHtml(e.display_name)+' nach oben">↑</button>'
  +'<button type="button" data-pyramid-admin-move="'+e.id+'" data-delta="1"'
  +(i===entries.length-1?' disabled':'')+' aria-label="'+escapeHtml(e.display_name)+' nach unten">↓</button></div></div>'
 ).join(''):'<p class="muted">Keine freigegebenen Spieler.</p>');
 const current=ladders.find(l=>l.id===ladderId);
 const finish=$<HTMLButtonElement>('pyramid-admin-finalize');
 if(finish){
  finish.disabled=!current||!!current.seeded_at||entries.length<2;
  finish.textContent=current?.seeded_at?'Startaufstellung festgelegt':'Startaufstellung abschließen';
 }
 const statuses:Record<string,string>={pending:'Annahme ausstehend',accepted:'Angenommen',
  completed:'Beendet',declined:'Abgelehnt',forfeit:'Wegen Fristüberschreitung gewertet',cancelled:'Abgebrochen'};
 display('pyramid-admin-challenges',challenges.length?challenges.map(ch=>
  '<div class="pyramid-admin-item"><span><strong>'+escapeHtml(label(ch.challenger_id))+' → '+escapeHtml(label(ch.defender_id))+'</strong>'
  +'<small style="display:block">'+escapeHtml(statuses[ch.status]||ch.status)
  +(ch.score?' · '+escapeHtml(ch.score):'')+'</small></span></div>'
 ).join(''):'<p class="muted">Noch keine Forderungen.</p>');
 const ongoing=challenges.filter(ch=>ch.status==='accepted');
 const matches=$<HTMLSelectElement>('pyramid-admin-match');
 if(matches){
  matches.innerHTML=ongoing.map(ch=>'<option value="'+ch.id+'">'
   +escapeHtml(label(ch.challenger_id)+' gegen '+label(ch.defender_id))+'</option>').join('');
  matches.disabled=ongoing.length===0;
 }
 renderWinner();
 const form=$<HTMLFormElement>('pyramid-admin-result');
 form?.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach(button=>button.disabled=ongoing.length===0);
}
function renderWinner(){
 const id=$<HTMLSelectElement>('pyramid-admin-match')?.value;
 const game=challenges.find(c=>c.id===id);
 const field=$<HTMLSelectElement>('pyramid-admin-winner');
 if(!field)return;
 field.innerHTML=game?[game.challenger_id,game.defender_id].map(id=>
  '<option value="'+id+'">'+escapeHtml(label(id))+'</option>').join(''):'';
}
async function callRpc(functionName:string,args:Record<string,unknown>){
 const {error}=await supabase.rpc(functionName,args);
 if(error)throw error;
}
async function load(){
 const {data,error}=await supabase.from('pyramid_ladders')
  .select('id,title,season_label,starts_on,ends_on,seeded_at')
  .order('starts_on',{ascending:false}).order('title');
 if(error)throw error;
 ladders=(data||[]) as Ladder[];
 if(!ladders.some(l=>l.id===ladderId))ladderId=ladders[0]?.id||'';
 await loadSelected();
}
async function loadSelected(){
 if(!ladderId){entries=[];requests=[];challenges=[];render();return;}
 const [players,joins,encounters]=await Promise.all([
  supabase.from('pyramid_entries').select('id,display_name,position')
   .eq('ladder_id',ladderId).order('position'),
  supabase.from('pyramid_requests').select('id,display_name,status')
   .eq('ladder_id',ladderId),
  supabase.from('pyramid_challenges')
   .select('id,challenger_id,defender_id,status,score,created_at,winner_id')
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
export function initPyramidAdmin(canManage:boolean){
 const panel=$('panel-pyramid');
 if(!panel||!canManage||initialized)return;
 initialized=true;
 panel.classList.remove('hidden');
 $('pyramid-admin-refresh')?.addEventListener('click',()=>void act(async()=>{},'Aktualisiert.',true));
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
 $('pyramid-admin-order')?.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLButtonElement>('[data-pyramid-admin-move]');
  if(!button||button.disabled)return;
  void act(()=>callRpc('pyramid_move_entry',{p_entry:button.dataset.pyramidAdminMove,p_delta:Number(button.dataset.delta)}),'Rangfolge aktualisiert.');
 });
 $('pyramid-admin-finalize')?.addEventListener('click',()=>{
  if(!ladderId||!confirm('Startaufstellung verbindlich abschließen?'))return;
  void act(()=>callRpc('pyramid_finalize_seed',{p_ladder:ladderId}),'Startaufstellung abgeschlossen.',true);
 });
 $<HTMLFormElement>('pyramid-admin-result')?.addEventListener('submit',event=>{
  event.preventDefault();
  const id=$<HTMLSelectElement>('pyramid-admin-match')?.value;
  const winner=$<HTMLSelectElement>('pyramid-admin-winner')?.value;
  const score=$<HTMLInputElement>('pyramid-admin-score')?.value.trim()||'';
  if(!id||!winner||scoreWinner(score)!==1){
   msg('Bitte ein angenommenes Spiel und zwei Gewinnsätze aus Sicht des Siegers eingeben.','error');return;
  }
  void act(async()=>{
   await callRpc('pyramid_report_result',{p_challenge:id,p_score:score,p_winner:winner});
   const input=$<HTMLInputElement>('pyramid-admin-score');
   if(input)input.value='';
  },'Ergebnis und Rangliste gespeichert.');
 });
 void load().catch(error=>msg('Ranglisten nicht erreichbar: '+error.message,'error'));
}
