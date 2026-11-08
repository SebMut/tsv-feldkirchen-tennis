import { supabase } from '../lib/supabase';
import { escapeHtml, setStatus } from '../lib/ui';
import { canChallenge, pyramidRows, dateWithinPeriod, scoreWinner } from '../lib/pyramid-rules.mjs';

type Ladder = { id:string;title:string;season_label:string;starts_on:string;ends_on:string;active:boolean };
type Entry = { id:string;ladder_id:string;user_id:string;display_name:string;position:number;provisional:boolean;last_loss_at:string|null };
type Request = { id:string;ladder_id:string;user_id:string;display_name:string;status:string };
type Challenge = {id:string;ladder_id:string;challenger_id:string;defender_id:string;status:string;
  created_at:string;accept_deadline:string;play_deadline:string|null;winner_id:string|null;score:string|null};
const state: {
  user:any;profile:any;superAdmin:boolean;ladders:Ladder[];ladderId:string;
  entries:Entry[];requests:Request[];challenges:Challenge[];resultChallenge:string;
}={user:null,profile:null,superAdmin:false,ladders:[],ladderId:'',entries:[],requests:[],challenges:[],resultChallenge:''};

const el = <T extends HTMLElement>(id:string) => document.getElementById(id) as T | null;
const html = (id:string, value:string) => { const target=el(id); if(target)target.innerHTML=value; };
const text = (id:string, value:string) => {const target=el(id);if(target)target.textContent=value;};
const hidden = (id:string, isHidden:boolean) => el(id)?.classList.toggle('hidden',isHidden);
const notice = (message:string,tone:'success'|'error'|'info'='info') => {
  const target=el('pyramid-status');if(!target)return;
  target.classList.remove('hidden');setStatus(target,message,tone);
};
const safeError = (e:unknown) => {
  const raw=String((e as any)?.message || 'Unbekannter Fehler');
  if (/relation.*does not exist|schema cache|could not find.*function/i.test(raw))
    return 'Die Forderungspyramide ist in dieser Umgebung noch nicht freigeschaltet (Datenbank-Migration fehlt).';
  return raw;
};
const formatDate = (value:string|null|undefined) => value
  ? new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeZone:'Europe/Berlin'}).format(new Date(value)) : '–';
const formatTime = (value:string|null|undefined) => value
  ? new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(value)) : '–';
const myEntry = () => state.entries.find((item)=>item.user_id===state.user?.id);
const currentLadder = () => state.ladders.find((item)=>item.id===state.ladderId);
const entryName = (id:string) => state.entries.find((item)=>item.id===id)?.display_name || 'Teilnehmer';
const isInvolved = (c:Challenge) => !!myEntry() && (c.challenger_id===myEntry()?.id || c.defender_id===myEntry()?.id);

async function runAction(action:()=>Promise<unknown>,success:string){
  try{await action();notice(success,'success');await loadLadder();}
  catch(error){notice(safeError(error),'error');}
}
async function rpc(name:string,args:Record<string,unknown>){
  const {error}=await supabase.rpc(name,args);
  if(error)throw error;
}
async function signIn(email:string,password:string) {
  const {error}=await supabase.auth.signInWithPassword({email,password});
  if(error)throw error;
}
function renderBoard() {
  const ladder=currentLadder();
  const me=myEntry();
  text('pyramid-ladder-heading',ladder ? ladder.title+' · '+ladder.season_label : 'Noch keine Rangliste');
  text('pyramid-ladder-dates',ladder ? formatDate(ladder.starts_on)+' bis '+formatDate(ladder.ends_on) : 'Die erste Rangliste kann vom Super-Admin angelegt werden.');
  text('pyramid-own-rank',me ? 'Mein Platz #'+me.position : '');
  hidden('pyramid-own-rank',!me);
  if(!ladder){html('pyramid-board','<p class="muted">Noch keine Ranglisten vorhanden.</p>');return;}
  if(!state.entries.length) {
    html('pyramid-board', '<p class="muted">Noch keine freigegebenen Teilnehmer. Die Rangliste wird nach der ersten Freigabe sichtbar.</p>');
    return;
  }
  const canPlay=ladder.active && dateWithinPeriod(ladder.starts_on,ladder.ends_on);
  const board=pyramidRows(state.entries).map((row,index)=>
    '<div class="pyramid-board-row" role="list" aria-label="Pyramidenreihe '+(index+1)+'">'+row.map((item)=>{
      if(!item)return '<div class="pyramid-entry is-empty" aria-hidden="true"></div>';
      const mine=me?.id===item.id;
      const canTarget=!!me && canPlay && canChallenge(me.position,item.position,me.provisional)
        && !(me.last_loss_at && new Date(me.last_loss_at).getTime()>Date.now()-14*86400000);
      return '<div role="listitem" class="pyramid-entry'+(mine?' is-self':'')+(canTarget?' is-target':'')+'">'
        +'<span class="pyramid-entry-rank">#'+item.position+'</span>'
        +'<span class="pyramid-entry-name">'+escapeHtml(item.display_name)+'</span>'
        +(item.provisional?'<span class="pyramid-entry-hint">Neueinstieg</span>':'')
        +(mine?'<span class="pyramid-entry-hint">Du</span>':'')
        +(canTarget?'<button type="button" data-pyramid-challenge="'+item.id+'">Fordern</button>':'')
        +'</div>';
    }).join('')+'</div>').join('');
  html('pyramid-board',board);
}
function renderGames() {
  const visible=state.challenges.filter((item)=>state.superAdmin||isInvolved(item)).sort(
    (a,b)=>b.created_at.localeCompare(a.created_at)
  ).slice(0,40);
  if(!myEntry()&&!state.superAdmin){hidden('pyramid-games-panel',true);return;}
  hidden('pyramid-games-panel',false);
  if(!visible.length){html('pyramid-games','<p class="muted">Noch keine Forderungsspiele eingetragen.</p>');return;}
  const labels:Record<string,string>={pending:'Annahme ausstehend',accepted:'Spiel vereinbaren',completed:'Beendet',
    forfeit:'Annahmefrist verpasst',declined:'Abgelehnt',cancelled:'Abgebrochen'};
  html('pyramid-games',visible.map((c)=>{
    const myDefender=myEntry()?.id===c.defender_id;
    const canReport=c.status==='accepted'&&(state.superAdmin||isInvolved(c));
    const actions= (c.status==='pending'&&myDefender
      ? '<button type="button" data-pyramid-accept="'+c.id+'">Annehmen</button><button type="button" data-pyramid-decline="'+c.id+'">Ablehnen</button>' : '')
      +(canReport?'<button type="button" data-pyramid-result="'+c.id+'">Ergebnis melden</button>':'');
    return '<article class="pyramid-game"><div><strong>'+escapeHtml(entryName(c.challenger_id))
      +' fordert '+escapeHtml(entryName(c.defender_id))+'</strong>'
      +'<small>'+escapeHtml(labels[c.status]||c.status)+' · '+formatTime(c.created_at)+'</small>'
      +(c.status==='pending'?'<small>Annahmefrist: '+formatTime(c.accept_deadline)+'</small>':'')
      +(c.status==='accepted'?'<small>Wunschtermin bis: '+formatTime(c.play_deadline)+'</small>':'')
      +(c.winner_id?'<small>Sieger: '+escapeHtml(entryName(c.winner_id))
        +(c.score?' · '+escapeHtml(c.score):'')+'</small>':'')
      +'</div><div class="pyramid-game-actions">'+actions+'</div></article>';
  }).join(''));
}
function renderJoin() {
  const ladder=currentLadder();
  const me=myEntry();
  const request=state.requests.find((r)=>r.user_id===state.user?.id && r.ladder_id===state.ladderId);
  hidden('pyramid-join-panel',!ladder||!!me);
  hidden('pyramid-join-form',request?.status==='pending'||request?.status==='approved');
  const message=request?.status==='pending'?'Deine Teilnahme wurde angefragt und wartet auf Freigabe.'
    :request?.status==='rejected'?'Die letzte Anfrage wurde abgelehnt. Du kannst eine neue Anfrage stellen.'
    :request?.status==='approved'?'Deine Teilnahme ist freigegeben. Bitte lade die Ansicht neu.':'';
  text('pyramid-join-state',message);
  if(!el<HTMLInputElement>('pyramid-display-name')?.value){
    const input=el<HTMLInputElement>('pyramid-display-name');
    if(input)input.value=state.profile?.display_name||'';
  }
}
function renderAdmin() {
  hidden('pyramid-admin-panel',!state.superAdmin);
  if(!state.superAdmin)return;
  const pending=state.requests.filter((r)=>r.status==='pending');
  html('pyramid-admin-requests',pending.length ? pending.map((r)=>
    '<div class="pyramid-admin-item"><span>'+escapeHtml(r.display_name)+'</span>'
    +'<button type="button" class="button secondary" data-pyramid-approve="'+r.id+'">Freigeben</button></div>'
  ).join(''):'<p class="muted">Keine offenen Anfragen in dieser Gruppe.</p>');
  html('pyramid-admin-entries',state.entries.length?state.entries.map((item,i)=>
    '<div class="pyramid-admin-item"><span>#'+item.position+' · '+escapeHtml(item.display_name)
    +(item.provisional?' (vorläufig)':'')+'</span><div>'
    +'<button type="button" title="Einen Platz höher" aria-label="'+escapeHtml(item.display_name)+' höher" data-pyramid-move="'+item.id+'" data-delta="-1"'+(i===0?' disabled':'')+'>↑</button>'
    +'<button type="button" title="Einen Platz tiefer" aria-label="'+escapeHtml(item.display_name)+' tiefer" data-pyramid-move="'+item.id+'" data-delta="1"'+(i===state.entries.length-1?' disabled':'')+'>↓</button>'
    +'</div></div>').join(''):'<p class="muted">Noch keine Teilnehmer.</p>');
}
function renderAll(){
  const selector=el<HTMLSelectElement>('pyramid-ladder-select');
  if(selector){
    selector.innerHTML=state.ladders.map((l)=>'<option value="'+l.id+'">'
      +escapeHtml(l.title+' · '+l.season_label)+(l.active?'':' (archiviert)')+'</option>').join('');
    selector.value=state.ladderId;
  }
  renderBoard();renderGames();renderJoin();renderAdmin();
}
async function loadLadder(){
  const ladder=currentLadder();
  if(!ladder){state.entries=[];state.requests=[];state.challenges=[];renderAll();return;}
  const [entries,requests,challenges]=await Promise.all([
    supabase.from('pyramid_entries').select('id,ladder_id,user_id,display_name,position,provisional,last_loss_at')
      .eq('ladder_id',ladder.id).order('position'),
    supabase.from('pyramid_requests').select('id,ladder_id,user_id,display_name,status')
      .eq('ladder_id',ladder.id),
    supabase.from('pyramid_challenges').select('id,ladder_id,challenger_id,defender_id,status,created_at,accept_deadline,play_deadline,winner_id,score')
      .eq('ladder_id',ladder.id).order('created_at',{ascending:false}).limit(150)
  ]);
  for(const answer of [entries,requests,challenges])if(answer.error)throw answer.error;
  state.entries=(entries.data||[]) as Entry[];
  state.requests=(requests.data||[]) as Request[];
  state.challenges=(challenges.data||[]) as Challenge[];
  renderAll();
}
async function load() {
  try {
    const response=await supabase.auth.getUser();
    if(response.error&&response.error.message!=='Auth session missing!')throw response.error;
    state.user=response.data.user;
    hidden('pyramid-auth',!!state.user);
    hidden('pyramid-app',!state.user);
    if(!state.user)return;
    const profile=await supabase.from('profiles').select('id,display_name,global_role').eq('id',state.user.id).maybeSingle();
    if(profile.error)throw profile.error;
    state.profile=profile.data;
    state.superAdmin=profile.data?.global_role==='super_admin';
    text('pyramid-user-name',profile.data?.display_name||state.user.email||'Mein TSV');
    const {data,error}=await supabase.from('pyramid_ladders')
      .select('id,title,season_label,starts_on,ends_on,active').order('starts_on',{ascending:false}).order('title');
    if(error)throw error;
    state.ladders=(data||[]) as Ladder[];
    if(!state.ladders.some((item)=>item.id===state.ladderId))state.ladderId=state.ladders[0]?.id||'';
    await loadLadder();
  }catch(error){notice(safeError(error),'error');}
}
function openResult(id:string) {
  const item=state.challenges.find((c)=>c.id===id);
  const dialog=el<HTMLDialogElement>('pyramid-dialog');
  if(!item||!dialog)return;
  state.resultChallenge=id;
  text('pyramid-dialog-opponents',entryName(item.challenger_id)+' gegen '+entryName(item.defender_id));
  const winner=el<HTMLSelectElement>('pyramid-result-winner');
  if(winner)winner.innerHTML=[item.challenger_id,item.defender_id].map((id)=>
    '<option value="'+id+'">'+escapeHtml(entryName(id))+'</option>').join('');
  hidden('pyramid-winner-field',!state.superAdmin);
  if(!state.superAdmin && !isInvolved(item)){notice('Nur Spielbeteiligte dürfen Ergebnisse melden.','error');return;}
  el<HTMLInputElement>('pyramid-result-score')!.value='';
  dialog.showModal();
}
function wireEvents(){
  el<HTMLFormElement>('pyramid-login-form')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const email=el<HTMLInputElement>('pyramid-email')?.value.trim()||'';
    const password=el<HTMLInputElement>('pyramid-password')?.value||'';
    try{await signIn(email,password);await load();notice('Du bist angemeldet.','success');}
    catch(e){notice(safeError(e),'error');}
  });
  el('pyramid-magic-link')?.addEventListener('click',async()=>{
    const email=el<HTMLInputElement>('pyramid-email')?.value.trim()||'';
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){notice('Bitte zuerst deine E-Mail-Adresse eingeben.','error');return;}
    try{
      const {error}=await supabase.auth.signInWithOtp({
        email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}
      });
      if(error)throw error;
      notice('Falls die Adresse einen Zugang erhalten darf, wurde ein Anmeldelink angefordert.','success');
    }catch(e){notice(safeError(e),'error');}
  });
  el('pyramid-sign-out')?.addEventListener('click',async()=>{
    const {error}=await supabase.auth.signOut();
    if(error){notice(safeError(error),'error');return;}
    state.user=null;state.profile=null;state.superAdmin=false;state.ladders=[];state.entries=[];
    hidden('pyramid-auth',false);hidden('pyramid-app',true);notice('Du bist abgemeldet.','success');
  });
  el<HTMLSelectElement>('pyramid-ladder-select')?.addEventListener('change',async(event)=>{
    state.ladderId=(event.target as HTMLSelectElement).value;
    try{await loadLadder();}catch(e){notice(safeError(e),'error');}
  });
  el<HTMLFormElement>('pyramid-join-form')?.addEventListener('submit',(event)=>{
    event.preventDefault();
    const name=el<HTMLInputElement>('pyramid-display-name')?.value.trim()||'';
    void runAction(()=>rpc('pyramid_request_join',{p_ladder:state.ladderId,p_name:name}),'Anfrage gespeichert.');
  });
  el<HTMLFormElement>('pyramid-create-form')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    if(!state.superAdmin)return;
    const title=el<HTMLInputElement>('pyramid-new-name')?.value.trim();
    const season_label=el<HTMLInputElement>('pyramid-new-season')?.value.trim();
    const starts_on=el<HTMLInputElement>('pyramid-new-start')?.value;
    const ends_on=el<HTMLInputElement>('pyramid-new-end')?.value;
    if(!starts_on||!ends_on||ends_on<starts_on){notice('Bitte gültige Saisontermine angeben.','error');return;}
    try{
      const {error}=await supabase.from('pyramid_ladders').insert({title,season_label,starts_on,ends_on});
      if(error)throw error;
      notice('Rangliste angelegt.','success');await load();
    }catch(e){notice(safeError(e),'error');}
  });
  el('pyramid-app')?.addEventListener('click',(event)=>{
    const target=(event.target as HTMLElement).closest<HTMLElement>('[data-pyramid-challenge],[data-pyramid-accept],[data-pyramid-decline],[data-pyramid-result],[data-pyramid-approve],[data-pyramid-move]');
    if(!target)return;
    const challenge=target.dataset.pyramidChallenge;
    if(challenge){if(confirm('Diese Person verbindlich herausfordern?'))void runAction(
      ()=>rpc('pyramid_challenge',{p_defender:challenge}),'Forderung eingetragen.');return;}
    const accept=target.dataset.pyramidAccept;
    if(accept){void runAction(()=>rpc('pyramid_respond',{p_challenge:accept,p_accept:true}),'Forderung angenommen.');return;}
    const decline=target.dataset.pyramidDecline;
    if(decline){if(confirm('Forderung nach den Ausnahmeregeln ablehnen?'))void runAction(
      ()=>rpc('pyramid_respond',{p_challenge:decline,p_accept:false}),'Forderung abgelehnt.');return;}
    const result=target.dataset.pyramidResult;
    if(result){openResult(result);return;}
    const approve=target.dataset.pyramidApprove;
    if(approve){void runAction(()=>rpc('pyramid_approve_join',{p_request:approve}),'Teilnahme freigegeben.');return;}
    const move=target.dataset.pyramidMove;
    if(move)void runAction(()=>rpc('pyramid_move_entry',{p_entry:move,p_delta:Number(target.dataset.delta)}),
      'Reihenfolge geändert.');
  });
  const dialog=el<HTMLDialogElement>('pyramid-dialog');
  el('pyramid-dialog-close')?.addEventListener('click',()=>dialog?.close());
  el('pyramid-dialog-cancel')?.addEventListener('click',()=>dialog?.close());
  dialog?.addEventListener('click',(event)=>{if(event.target===dialog)dialog.close();});
  el<HTMLFormElement>('pyramid-result-form')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const value=el<HTMLInputElement>('pyramid-result-score')?.value.trim()||'';
    if(scoreWinner(value)!==1){notice('Das Ergebnis muss aus Sicht des Siegers angegeben werden (zwei Gewinnsätze, ggf. Champions-Tie-Break).','error');return;}
    const winner=state.superAdmin?el<HTMLSelectElement>('pyramid-result-winner')?.value:undefined;
    try{
      await rpc('pyramid_report_result',{p_challenge:state.resultChallenge,p_score:value,
        ...(winner?{p_winner:winner}:{})});
      dialog?.close();notice('Ergebnis und Rangliste aktualisiert.','success');await loadLadder();
    }catch(e){notice(safeError(e),'error');}
  });
}
export function initPyramid(){
  wireEvents();
  void load();
  supabase.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_IN'||event==='SIGNED_OUT')queueMicrotask(()=>void load());
  });
}
