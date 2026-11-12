import { supabase, mediaUrl } from '../lib/supabase';
import { replaceMediaImage, removeMediaImage, assertImageFile } from '../lib/media-upload';
import { escapeHtml, setStatus } from '../lib/ui';
import { canChallenge, canQualifyAgainst, defaultMasterSeason, pyramidRows, dateWithinPeriod, scoreWinner } from '../lib/pyramid-rules.mjs';

type Ladder = { id:string;title:string;season_label:string;starts_on:string;ends_on:string;active:boolean;seeded_at:string|null };
type Entry = { id:string;ladder_id:string;user_id:string|null;display_name:string;position:number;provisional:boolean;qualified?:boolean;is_test?:boolean;lk_rating?:number|null;last_loss_at:string|null;last_win_at?:string|null;neutralized_at?:string|null;neutralized_reason?:string|null;withdrawn_at?:string|null };
type Request = { id:string;ladder_id:string;user_id:string;display_name:string;status:string };
type Challenge = {id:string;ladder_id:string;challenger_id:string;defender_id:string;status:string;
  created_at:string;accept_deadline:string;play_deadline:string|null;scheduled_for?:string|null;scheduled_at?:string|null;scheduled_confirmed_at?:string|null;refusal_reason?:string|null;winner_id:string|null;proposed_winner_id?:string|null;proposed_score?:string|null;result_reporter_id?:string|null;reported_at?:string|null;confirmation_deadline?:string|null;dispute_reason?:string|null;weather_extended_at?:string|null;overdue_extended_at?:string|null;no_show_requested_at?:string|null;no_show_reporter_id?:string|null;score:string|null;decline_reason?:string|null;source?:string;resolved_at?:string|null};
const state: {
  user:any;profile:any;superAdmin:boolean;ladders:Ladder[];ladderId:string;
  entries:Entry[];requests:Request[];ownRequests:Request[];hasActiveEntry:boolean;
  challenges:Challenge[];resultChallenge:string;avatars:Record<string,string>;
}={user:null,profile:null,superAdmin:false,ladders:[],ladderId:'',entries:[],requests:[],ownRequests:[],hasActiveEntry:false,challenges:[],resultChallenge:'',avatars:{}};

const el = <T extends HTMLElement>(id:string) => document.getElementById(id) as T | null;
const html = (id:string, value:string) => { const target=el(id); if(target)target.innerHTML=value; };
const text = (id:string, value:string) => {const target=el(id);if(target)target.textContent=value;};
const hidden = (id:string, isHidden:boolean) => el(id)?.classList.toggle('hidden',isHidden);
const notice = (message:string,tone:'success'|'error'|'info'='info') => {
  const target=el('pyramid-status');if(!target)return;
  target.classList.remove('hidden');setStatus(target,message,tone);
};
const modalMessage=(id:string,message='')=>{
  const target=el(id);if(!target)return;
  target.textContent=message;target.classList.toggle('hidden',!message);
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
const activeEntries = () => state.entries.filter((item)=>!item.withdrawn_at&&typeof item.position==='number');
const myEntry = () => activeEntries().find((item)=>item.user_id===state.user?.id);
const formerEntry = () => state.entries.find((item)=>item.user_id===state.user?.id&&!!item.withdrawn_at);
const currentLadder = () => state.ladders.find((item)=>item.id===state.ladderId);
const entryName = (id:string) => state.entries.find((item)=>item.id===id)?.display_name || 'Teilnehmer';
const isInvolved = (c:Challenge) => !!myEntry() && (c.challenger_id===myEntry()?.id || c.defender_id===myEntry()?.id);
const waitingDays=(date:string|null|undefined,days:number)=>!!date && new Date(date).getTime()>Date.now()-days*86400000;
const openStatuses=['pending','accepted','result_pending','result_disputed'];
const neutralNow=(e:Entry)=>!!e.neutralized_at&&waitingDays(e.neutralized_at,28);
function canSendChallenge(me:Entry,target:Entry){
  if(me.is_test||target.is_test||!me.user_id||!target.user_id||me.id===target.id||neutralNow(target)||neutralNow(me))return false;
  if(waitingDays(me.last_loss_at,7)||waitingDays(target.last_win_at,2))return false;
  if(state.challenges.some(game=>openStatuses.includes(game.status)
    &&[me.id,target.id].some(id=>game.challenger_id===id||game.defender_id===id)))return false;
  if(state.challenges.some(game=>game.challenger_id===me.id&&game.defender_id===target.id
    &&['completed','forfeit'].includes(game.status)
    &&waitingDays(game.resolved_at,7)))return false;
  return canChallenge(me.position,target.position);
}
const friendlyReason=(reason:string|null|undefined)=>({
  injury:'Verletzung',illness:'Krankheit',vacation:'Urlaub',other:'Sonstiges'
} as Record<string,string>)[reason||'']||'Spielbereit';

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

type PublicStanding={
 ladder_id:string;ladder_title:string;season_label:string;starts_on:string;ends_on:string;
 seeded:boolean;position:number|null;display_name:string|null;
};
let publicStandings:PublicStanding[]=[];
let chosenPublicLadder='';
function renderGuestStandings(){
 const picker=el<HTMLSelectElement>('pyramid-public-select');
 const groups=[...new Map(publicStandings.map(x=>[x.ladder_id,x])).values()];
 if(picker){
   picker.innerHTML=groups.map(x=>'<option value="'+escapeHtml(x.ladder_id)+'">'
     +escapeHtml(x.ladder_title+' · '+x.season_label)+'</option>').join('');
   if(!groups.some(x=>x.ladder_id===chosenPublicLadder))chosenPublicLadder=groups[0]?.ladder_id||'';
   picker.value=chosenPublicLadder;
   picker.disabled=groups.length<2;
 }
 const ladder=groups.find(x=>x.ladder_id===chosenPublicLadder);
 text('pyramid-public-dates',ladder?formatDate(ladder.starts_on)+' bis '+formatDate(ladder.ends_on):'');
 if(!ladder){
   html('pyramid-public-board','<p class="muted">Momentan ist keine öffentliche Rangliste eingerichtet.</p>');
   text('pyramid-public-message','');return;
 }
 const entries=publicStandings.filter((x):x is PublicStanding & {position:number;display_name:string}=>
   x.ladder_id===chosenPublicLadder
   &&typeof x.position==='number'&&typeof x.display_name==='string'
   &&x.display_name.trim().length>0);
 if(!entries.length){
   html('pyramid-public-board','<p class="muted">Noch keine freigegebenen Mitglieder in dieser Rangliste.</p>');
 }else{
   html('pyramid-public-board',pyramidRows(entries).map((row,index)=>
     '<div class="pyramid-board-row" role="list" aria-label="Pyramidenreihe '+(index+1)+'">'
     +row.map(x=>x
       ?'<div class="pyramid-entry pyramid-entry-public" role="listitem">'
        +'<span class="pyramid-entry-rank">#'+x.position+'</span>'
        +'<span class="pyramid-entry-name">'+escapeHtml(x.display_name||'')+'</span></div>'
       :'<div class="pyramid-entry is-empty" aria-hidden="true"></div>').join('')
     +'</div>').join(''));
 }
 text('pyramid-public-message',ladder.seeded?'':'Die Startaufstellung wurde noch nicht endgültig freigegeben.');
}
async function loadGuestStandings(){
 hidden('pyramid-public-panel',!!state.user);
 if(state.user)return;
 const {data,error}=await supabase.rpc('pyramid_public_standings');
 if(error){
   html('pyramid-public-board','<p class="muted">Die Rangliste konnte nicht geladen werden. Bitte Seite erneut öffnen.</p>');
   console.warn('Public pyramid read unavailable:',error.code);return;
 }
 publicStandings=(data||[]) as PublicStanding[];
 renderGuestStandings();
}

function renderBoard() {
  const ladder=currentLadder();
  const me=myEntry();
  const qualified=activeEntries();
  text('pyramid-ladder-heading',ladder ? ladder.title+' · '+ladder.season_label : 'Noch keine Rangliste');
  text('pyramid-ladder-dates',ladder ? formatDate(ladder.starts_on)+' bis '+formatDate(ladder.ends_on)
    : 'Die erste Rangliste kann von der Ranglistenverwaltung angelegt werden.');
  text('pyramid-own-rank',me ? 'Mein Platz #'+me.position : '');
  hidden('pyramid-own-rank',!me);
  if(!ladder){html('pyramid-board','<p class="muted">Noch keine Ranglisten vorhanden.</p>');html('pyramid-qualifier','');return;}
  const canPlay=ladder.active && !!ladder.seeded_at
    && dateWithinPeriod(ladder.starts_on,ladder.ends_on);
  if(!qualified.length){
    html('pyramid-board','<p class="muted">Noch keine eingeordneten Teilnehmer. Die Rangliste wird nach der Startaufstellung sichtbar.</p>');
  }else{
    const board=pyramidRows(qualified).map((row,index)=>
      '<div class="pyramid-board-row" role="list" aria-label="Pyramidenreihe '+(index+1)+'">'+row.map(item=>{
        if(!item)return '<div class="pyramid-entry is-empty" aria-hidden="true"></div>';
        const mine=me?.id===item.id;
        // Always visualize the geometric challenge range. Temporary blockers
        // (open match, protection, absence) and non-login test places only
        // suppress the action button, not the helpful red orientation.
        const canHighlight=!!me&&canPlay&&me.id!==item.id&&canChallenge(me.position,item.position);
        const canTarget=!!me&&canPlay&&canSendChallenge(me,item);
        const portrait=item.user_id?state.avatars[item.user_id]:undefined;
        return '<div role="listitem" class="pyramid-entry'+(mine?' is-self':'')+(canHighlight?' is-target':'')
          +(neutralNow(item)?' is-neutralized':'')+'">'
          +(portrait?'<img class="pyramid-entry-avatar" src="'+escapeHtml(mediaUrl(portrait))
             +'" alt="Profilbild von '+escapeHtml(item.display_name)+'" loading="lazy" decoding="async" />':'')
          +'<span class="pyramid-entry-rank">#'+item.position+'</span>'
          +'<span class="pyramid-entry-name">'+escapeHtml(item.display_name)+'</span>'
          +(item.lk_rating!=null?'<span class="pyramid-entry-lk">LK '
            +escapeHtml(item.lk_rating.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1}))+'</span>':'')
          +(item.is_test?'<span class="pyramid-entry-hint">Testplatz</span>':'')
          +(mine?'<span class="pyramid-entry-hint">Du</span>':'')
          +(neutralNow(item)?'<span class="pyramid-entry-away" aria-label="Aktueller Status: '
            +escapeHtml(friendlyReason(item.neutralized_reason))+'">'
            +escapeHtml(friendlyReason(item.neutralized_reason))+'</span>':'')
          +(item.last_win_at&&waitingDays(item.last_win_at,2)?'<span class="pyramid-entry-hint">Siegerschutz (48 Stunden)</span>':'')
          +(canTarget?'<button type="button" data-pyramid-challenge="'+item.id+'">Fordern</button>':'')
          +'</div>';
      }).join('')+'</div>').join('');
    html('pyramid-board',board);
  }
  html('pyramid-qualifier',!ladder.seeded_at
    ?'<p class="muted">Die LK-Startaufstellung muss noch durch die Ranglistenverwaltung freigegeben werden.</p>'
    :'<p class="muted">Neue Mitglieder werden nach Freigabe automatisch am Ende der Rangliste eingereiht.</p>');
}
function renderGames() {
  const visible=state.challenges.filter(c=>state.superAdmin||isInvolved(c))
    .sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,40);
  if(!myEntry()&&!state.superAdmin){hidden('pyramid-games-panel',true);return;}
  hidden('pyramid-games-panel',false);
  if(!visible.length){html('pyramid-games','<p class="muted">Noch keine Forderungsspiele eingetragen.</p>');return;}
  const labels:Record<string,string>={pending:'Forderung offen',accepted:'Spiel vereinbart',
    result_pending:'Ergebnis wartet auf Bestätigung',result_disputed:'Ergebnis widersprochen – Korrektur offen',
    completed:'Beendet',forfeit:'Kampflos gewertet',declined:'Abgelehnt',cancelled:'Abgebrochen'};
  html('pyramid-games',visible.map(c=>{
    const me=myEntry();
    const opponentMayConfirm=c.status==='result_pending'&&!!me
      &&[c.challenger_id,c.defender_id].includes(me.id)
      &&me.id!==c.proposed_winner_id
      &&(!c.confirmation_deadline||new Date(c.confirmation_deadline).getTime()>=Date.now());
    const open=!!me&&isInvolved(c);
    const expiresAt=c.play_deadline||new Date(new Date(c.created_at).getTime()+14*86400000).toISOString();
    const late=['pending','accepted'].includes(c.status)
      &&new Date(expiresAt).getTime()<Date.now();
    const noShowAllowed=c.status==='accepted'&&open&&!!c.scheduled_for&&!!c.scheduled_confirmed_at
      &&new Date(c.scheduled_for).getTime()+15*60000<=Date.now()
      &&!c.no_show_requested_at;
    const actions=(c.status==='pending'&&me?.id===c.defender_id&&!c.refusal_reason&&!late
      ?'<button type="button" data-pyramid-accept="'+c.id+'">Annehmen</button>'
        +'<button type="button" data-pyramid-decline="'+c.id+'">Absage begründen</button>':'')
      +(['pending','accepted'].includes(c.status)&&me?.id===c.challenger_id
        ?'<button type="button" data-pyramid-withdraw="'+c.id+'">Forderung zurückziehen</button>':'')
      +(c.status==='accepted'&&!late&&!c.refusal_reason&&me?.id===c.challenger_id
        ?'<button type="button" data-pyramid-schedule="'+c.id+'">'
          +(c.scheduled_for?'Spieltermin ändern':'Spieltermin eintragen')+'</button>':'')
      +(c.status==='accepted'&&!late&&!c.refusal_reason&&me?.id===c.defender_id
        &&!!c.scheduled_for&&!c.scheduled_confirmed_at
        ?'<button type="button" data-pyramid-confirm-schedule="'+c.id+'">Termin akzeptieren</button>':'')
      +(c.status==='accepted'&&!late&&!c.refusal_reason&&(state.superAdmin||open)
        ?'<button type="button" data-pyramid-result="'+c.id+'">Ergebnis melden</button>':'')
      +(opponentMayConfirm?'<button type="button" data-pyramid-confirm="'+c.id+'">Ergebnis bestätigen</button>'
        +'<button type="button" data-pyramid-dispute="'+c.id+'">Widersprechen</button>':'')
      +(c.status==='result_disputed'&&!!me&&me.id===c.result_reporter_id
        ?'<button type="button" data-pyramid-result="'+c.id+'">Ergebnis korrigieren</button>':'')
      +(noShowAllowed?'<button type="button" data-pyramid-noshow="'+c.id+'">Nichtantreten melden</button>':'');
    const gameTitle=me?.id===c.defender_id
      ?entryName(c.challenger_id)+' fordert dich heraus.'
      :me?.id===c.challenger_id
        ?'Du forderst '+entryName(c.defender_id)+' heraus.'
        :entryName(c.challenger_id)+' fordert '+entryName(c.defender_id);
    return '<article class="pyramid-game"><div><strong>'+escapeHtml(gameTitle)+'</strong>'
      +'<small>'+escapeHtml(c.status==='cancelled'&&c.decline_reason==='withdrawn_by_challenger'
        ?'Vom Herausforderer zurückgezogen':labels[c.status]||c.status)+' · '+formatTime(c.created_at)+'</small>'
      +(c.refusal_reason?'<small>Absage zur Prüfung: '+escapeHtml(c.refusal_reason)+'</small>':'')
      +(c.status==='pending'?'<small>Spieltermin möglichst innerhalb von 3 Tagen vereinbaren.</small>':'')
      +(c.scheduled_confirmed_at?'<span class="pyramid-accepted">✓ Akzeptiert</span>':'')
      +(c.scheduled_for?'<small>'+(c.scheduled_confirmed_at?'Bestätigter Termin: ':'Terminvorschlag: ')
        +formatTime(c.scheduled_for)+(c.scheduled_confirmed_at?'':' · Bestätigung ausstehend')+'</small>':'')
      +(['pending','accepted'].includes(c.status)?'<small>Spielfrist: '+formatTime(expiresAt)+'</small>':'')
      +(late?'<small class="pyramid-deadline-warning">Frist überschritten – Ranglistenwart entscheidet; keine automatische Rangänderung.</small>':'')
      +(c.no_show_requested_at?'<small>Nichtantreten gemeldet – Entscheidung des Ranglistenwarts offen.</small>':'')
      +(c.status==='result_pending' || c.status==='result_disputed'
        ?'<small>Gemeldetes Ergebnis: '+escapeHtml(entryName(c.proposed_winner_id||''))
         +(c.proposed_score?' · '+escapeHtml(c.proposed_score):'')+'</small>':'')
      +(c.status==='result_pending'&&c.confirmation_deadline
        ?'<small>Bestätigen bis: '+formatTime(c.confirmation_deadline)
        +(new Date(c.confirmation_deadline).getTime()<Date.now()
          ?' · Ranglistenwart entscheidet':'')+'</small>':'')
      +(c.status==='result_disputed'&&c.dispute_reason
        ?'<small>Widerspruch: '+escapeHtml(c.dispute_reason)+'</small><small>Bitte Ergebnis korrigieren und erneut zur Bestätigung senden.</small>':'')
      +(c.winner_id?'<small>Sieger: '+escapeHtml(entryName(c.winner_id))
        +(c.score?' · '+escapeHtml(c.score):'')+'</small>':'')
      +'</div><div class="pyramid-game-actions">'+actions+'</div></article>';
  }).join(''));
}
function renderUpcomingGames(){
  const upcoming=state.challenges
    .filter(c=>c.status==='accepted'&&isInvolved(c)&&!!c.scheduled_for&&!!c.scheduled_confirmed_at
      &&new Date(c.scheduled_for).getTime()>=Date.now()-15*60000)
    .sort((a,b)=>String(a.scheduled_for).localeCompare(String(b.scheduled_for))).slice(0,1);
  hidden('pyramid-upcoming-panel',!upcoming.length);
  html('pyramid-upcoming-games',upcoming.length?upcoming.map(c=>
    '<article class="pyramid-upcoming-game"><time datetime="'+escapeHtml(c.scheduled_for||'')+'">'
      +escapeHtml(formatTime(c.scheduled_for))+'</time><strong>'+escapeHtml(entryName(c.challenger_id))
      +' gegen '+escapeHtml(entryName(c.defender_id))+'</strong><span class="pyramid-accepted">✓ Akzeptiert</span></article>'
  ).join(''):'');
}
function renderJoin() {
  const ladder=currentLadder();
  const me=myEntry();
  const former=formerEntry();
  const request=state.requests.find((r)=>r.user_id===state.user?.id && r.ladder_id===state.ladderId);
  hidden('pyramid-join-panel',!ladder||!!me);
  hidden('pyramid-join-form',!!former||request?.status==='pending'||request?.status==='approved');
  const message=former?'Du hast dein Forderungspyramidenkonto für diese Rangliste gelöscht.'
    :request?.status==='pending'?'Deine Teilnahme wurde angefragt und wartet auf Freigabe.'
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
  const finalized=!!currentLadder()?.seeded_at;
  const seedButton=el<HTMLButtonElement>('pyramid-finalize-seed');
  const entries=activeEntries();
  if(seedButton){seedButton.disabled=finalized||entries.length<2;seedButton.textContent=finalized?'Startaufstellung bereits festgelegt':'Startaufstellung verbindlich abschließen';}
  const pending=state.requests.filter((r)=>r.status==='pending');
  html('pyramid-admin-requests',pending.length ? pending.map((r)=>
    '<div class="pyramid-admin-item"><span>'+escapeHtml(r.display_name)+'</span>'
    +'<button type="button" class="button secondary" data-pyramid-approve="'+r.id+'">Freigeben</button></div>'
  ).join(''):'<p class="muted">Keine offenen Anfragen in dieser Gruppe.</p>');
  html('pyramid-admin-entries',entries.length?entries.map((item,i)=>
    '<div class="pyramid-admin-item"><span>#'+item.position+' · '+escapeHtml(item.display_name)
    +(item.qualified===false?' (Qualifikationsspiel offen)':item.provisional?' (vorläufig)':'')+'</span><div>'
    +'<button type="button" title="Einen Platz höher" aria-label="'+escapeHtml(item.display_name)+' höher" data-pyramid-move="'+item.id+'" data-delta="-1"'+(i===0?' disabled':'')+'>↑</button>'
    +'<button type="button" title="Einen Platz tiefer" aria-label="'+escapeHtml(item.display_name)+' tiefer" data-pyramid-move="'+item.id+'" data-delta="1"'+(i===entries.length-1?' disabled':'')+'>↓</button>'
    +'</div></div>').join(''):'<p class="muted">Noch keine Teilnehmer.</p>');
}
function renderMemberPortrait(){
  hidden('pyramid-avatar-panel',!state.user);
  const preview=el('pyramid-avatar-preview');
  const current=state.profile?.avatar_path;
  const owner=state.user?.id;
  const valid=typeof current==='string'&&owner
    && current.startsWith('users/'+owner+'/')&&current.endsWith('.webp');
  if(preview){
    preview.innerHTML=valid
      ?'<img class="pyramid-member-avatar-preview" src="'+escapeHtml(mediaUrl(current))
        +'" alt="Dein aktuelles Profilbild" loading="lazy" decoding="async" />'
      :'<span class="pyramid-avatar-placeholder" aria-hidden="true">🎾</span>';
  }
  const remove=el<HTMLButtonElement>('pyramid-avatar-remove');
  if(remove)remove.disabled=!valid;
}
function renderAccountDeletion(){
  hidden('pyramid-account-delete-panel',!myEntry());
}
function renderOwnAvailability(){
  const me=myEntry();
  hidden('pyramid-availability-panel',!me);
  const field=el<HTMLSelectElement>('pyramid-neutral-reason');
  if(field&&me)field.value=me.neutralized_reason||'';
  text('pyramid-neutral-state',me&&neutralNow(me)
    ?'Neutralisiert seit '+formatDate(me.neutralized_at)+': '+friendlyReason(me.neutralized_reason)
       +' · maximal 28 Tage, danach ans Reihenende oder – wenn du dort bereits stehst – in die Mitte der nächsten Reihe'
    :'Du bist spielbereit und kannst unter Beachtung der Forderungsregeln gefordert werden.');
}
function renderAll(){
  const selector=el<HTMLSelectElement>('pyramid-ladder-select');
  if(selector){
    selector.innerHTML=state.ladders.map((l)=>'<option value="'+l.id+'">'
      +escapeHtml(l.title+' · '+l.season_label)+(l.active?'':' (archiviert)')+'</option>').join('');
    selector.value=state.ladderId;
  }
  renderBoard();renderUpcomingGames();renderGames();renderJoin();renderAdmin();renderOwnAvailability();renderMemberPortrait();renderAccountDeletion();
}
function showFirstJoinDialog(){
  const dialog=el<HTMLDialogElement>('pyramid-first-join-dialog');
  const selectable=state.ladders.filter(l=>l.active);
  const alreadyApplied=state.ownRequests.some(r=>r.status==='pending'||r.status==='approved');
  if(!dialog||state.superAdmin||state.hasActiveEntry||alreadyApplied||!selectable.length)return false;
  const select=el<HTMLSelectElement>('pyramid-first-join-ladder');
  if(select){
    select.innerHTML=selectable.map(l=>'<option value="'+l.id+'">'
      +escapeHtml(l.title+' · '+l.season_label)+'</option>').join('');
    select.value=selectable.some(l=>l.id===state.ladderId)?state.ladderId:selectable[0].id;
  }
  const name=el<HTMLInputElement>('pyramid-first-join-name');
  if(name&&!name.value)name.value=state.profile?.display_name||'';
  modalMessage('pyramid-first-join-error');
  if(!dialog.open)dialog.showModal();
  return true;
}
async function loadLadder(){
  const ladder=currentLadder();
  if(!ladder){state.entries=[];state.requests=[];state.challenges=[];renderAll();return;}
  const [entries,requests,challenges]=await Promise.all([
    supabase.from('pyramid_entries').select('id,ladder_id,user_id,display_name,position,provisional,qualified,is_test,lk_rating,last_loss_at,last_win_at,neutralized_at,neutralized_reason,withdrawn_at')
      .eq('ladder_id',ladder.id).order('position'),
    supabase.from('pyramid_requests').select('id,ladder_id,user_id,display_name,status')
      .eq('ladder_id',ladder.id),
    supabase.from('pyramid_challenges').select('id,ladder_id,challenger_id,defender_id,status,created_at,accept_deadline,play_deadline,scheduled_for,scheduled_at,scheduled_confirmed_at,refusal_reason,winner_id,score,decline_reason,source,resolved_at,proposed_winner_id,proposed_score,result_reporter_id,reported_at,confirmation_deadline,dispute_reason,weather_extended_at,overdue_extended_at,no_show_requested_at,no_show_reporter_id')
      .eq('ladder_id',ladder.id).order('created_at',{ascending:false}).limit(150)
  ]);
  for(const answer of [entries,requests,challenges])if(answer.error)throw answer.error;
  state.entries=(entries.data||[]) as Entry[];
  state.requests=(requests.data||[]) as Request[];
  state.challenges=(challenges.data||[]) as Challenge[];
  state.avatars={};
  // Only a member of this ladder (or a designated manager) can read its
  // participant portraits. This avoids widening generic profiles RLS.
  if(state.superAdmin||activeEntries().some(e=>e.user_id===state.user?.id)){
    const {data:portraits,error:portraitError}=await supabase.rpc('pyramid_member_avatars',{p_ladder:ladder.id});
    if(portraitError){
      console.warn('Pyramid portrait list unavailable:',portraitError.message);
    }else{
      state.avatars=Object.fromEntries((portraits||[]).filter(
        (r:{user_id:string;avatar_path:string})=>typeof r.avatar_path==='string'
          &&r.avatar_path.startsWith('users/'+r.user_id+'/')
          &&r.avatar_path.endsWith('.webp')
      ).map((r:{user_id:string;avatar_path:string})=>[r.user_id,r.avatar_path]));
    }
  }
  renderAll();
}
async function load() {
  try {
    const response=await supabase.auth.getUser();
    if(response.error&&response.error.message!=='Auth session missing!')throw response.error;
    state.user=response.data.user;
    if(passwordSetupMode){
      hidden('pyramid-auth',true);
      hidden('pyramid-app',true);
      hidden('pyramid-public-panel',true);
      return;
    }
    hidden('pyramid-password-setup',true);
    hidden('pyramid-auth',!!state.user);
    hidden('pyramid-app',!state.user);
    hidden('pyramid-public-panel',!!state.user);
    if(!state.user){await loadGuestStandings();return;}
    const profile=await supabase.from('profiles').select('id,display_name,global_role,global_permissions,avatar_path,tennis_lk_rating,tennis_lk_declared_at').eq('id',state.user.id).maybeSingle();
    if(profile.error)throw profile.error;
    state.profile=profile.data;
    state.superAdmin=profile.data?.global_role==='super_admin'||(profile.data?.global_permissions||[]).includes('pyramid');
    text('pyramid-user-name',profile.data?.display_name||state.user.email||'Mein TSV');
    const {data,error}=await supabase.from('pyramid_ladders')
      .select('id,title,season_label,starts_on,ends_on,active,seeded_at').order('starts_on',{ascending:false}).order('title');
    if(error)throw error;
    state.ladders=(data||[]) as Ladder[];
    if(!state.ladders.some((item)=>item.id===state.ladderId))state.ladderId=state.ladders[0]?.id||'';
    const [ownRequests,ownEntries]=await Promise.all([
      supabase.from('pyramid_requests').select('id,ladder_id,user_id,display_name,status')
        .eq('user_id',state.user.id),
      supabase.from('pyramid_entries').select('id').eq('user_id',state.user.id)
        .is('withdrawn_at',null).limit(1)
    ]);
    if(ownRequests.error)throw ownRequests.error;
    if(ownEntries.error)throw ownEntries.error;
    state.ownRequests=(ownRequests.data||[]) as Request[];
    state.hasActiveEntry=!!ownEntries.data?.length;
    await loadLadder();
    const lkDialog=el<HTMLDialogElement>('pyramid-lk-dialog');
    if(!showFirstJoinDialog()&&!profile.data?.tennis_lk_declared_at&&!lkDialog?.open)lkDialog?.showModal();
  }catch(error){notice(safeError(error),'error');}
}
const resultSets:string[]=[];
const normalizeWinnerScore=(score:string)=>{
  const winner=scoreWinner(score);
  if(winner===1)return score.trim();
  if(winner!==2)return null;
  return score.trim().split(/,\s*/).map(set=>set.split(':').reverse().join(':')).join(', ');
};
const normalSetScores=['6:0','0:6','6:1','1:6','6:2','2:6','6:3','3:6','6:4','4:6','7:5','5:7','7:6','6:7'];
const tieBreakScores=['10:0','0:10','10:5','5:10','10:7','7:10','10:8','8:10'];
function setIsValid(score:string,tieBreak:boolean){
  const parts=score.split(':').map(Number);if(parts.length!==2||parts.some(x=>!Number.isInteger(x)||x<0))return false;
  const hi=Math.max(...parts),lo=Math.min(...parts);
  const normal=(hi===6&&lo<=4)||(hi===7&&(lo===5||lo===6));
  return tieBreak?hi>=10&&hi-lo>=2:normal;
}
function renderResultWizard(){
  const value=resultSets.join(', ');
  const winner=scoreWinner(value);
  const tieBreak=resultSets.length===2&&winner===null;
  const finished=winner!==null;
  const score=el<HTMLInputElement>('pyramid-result-score');if(score)score.value=value;
  text('pyramid-dialog-title',finished?'Ergebnis prüfen':(resultSets.length+1)+'. Satz auswählen');
  html('pyramid-result-sets',resultSets.map((set,index)=>'<span><small>Satz '+(index+1)+'</small><strong>'+escapeHtml(set)+'</strong></span>').join(''));
  hidden('pyramid-result-undo',resultSets.length===0);
  hidden('pyramid-result-set-entry',finished);
  const quick=el('pyramid-result-quick');
  if(quick)quick.innerHTML=(tieBreak?tieBreakScores:normalSetScores).map(set=>
    '<button type="button" data-pyramid-result-score="'+set+'">'+set+'</button>').join('');
  if(quick)quick.parentElement?.classList.toggle('hidden',finished);
  text('pyramid-result-example',tieBreak?'z. B. 10:8':'z. B. 6:4');
  const correction=state.challenges.find(c=>c.id===state.resultChallenge);
  const correctionHint=correction?.status==='result_disputed'&&correction.dispute_reason
    ?'Widerspruch: '+correction.dispute_reason+' Bitte gib das korrigierte Ergebnis vollständig neu ein. '
    :'';
  text('pyramid-result-help',correctionHint+(tieBreak?'Der dritte Satz ist immer ein Champions-Tie-Break bis mindestens 10 Punkte mit zwei Punkten Abstand.':'Sobald der Sieger zwei Sätze gewonnen hat, erscheint der Speichern-Button.'));
  const own=el<HTMLInputElement>('pyramid-result-own-games');const opponent=el<HTMLInputElement>('pyramid-result-opponent-games');
  if(own)own.value=tieBreak?'10':'6';if(opponent)opponent.value=tieBreak?'8':'0';
  hidden('pyramid-result-submit',winner===null);
  modalMessage('pyramid-result-error');
}
function addResultSet(score:string){
  const tieBreak=resultSets.length===2;
  if(!setIsValid(score,tieBreak)){
    modalMessage('pyramid-result-error',tieBreak?'Ungültiger Match-Tie-Break: mindestens 10 Punkte und zwei Punkte Abstand.':'Ungültiger Satzstand. Erlaubt sind 6:0 bis 6:4, 7:5 oder 7:6 – jeweils auch umgekehrt.');return;
  }
  modalMessage('pyramid-result-error');resultSets.push(score);renderResultWizard();
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
  resultSets.splice(0);modalMessage('pyramid-result-error');renderResultWizard();
  dialog.showModal();
}

// Authenticated access links arrive directly on this page. Supabase's token
// hash lives in the URL fragment (never the HTTP request). Remove it before
// loading any additional resources or showing the application.
type SetupLinkType='magiclink'|'signup'|'invite'|'recovery'|'email';
type SetupLink={token:string;type:SetupLinkType};
let passwordSetupMode:'link'|'manual'|null=null;
function consumePasswordSetupLink():SetupLink|null{
 const params=new URLSearchParams(location.hash.replace(/^#/,''));
 const raw=params.get('pyramid_token_hash');
 if(!raw)return null;
 history.replaceState(history.state,'',location.pathname+location.search);
 const type=params.get('pyramid_token_type');
 if(raw.length<8||raw.length>1024||/[\s<>\x00-\x1f\x7f]/.test(raw)
    ||!['magiclink','signup','invite','recovery','email'].includes(type||'')){
   notice('Der Einrichtungslink ist ungültig. Bitte einen neuen Link anfordern.','error');
   return null;
 }
 return {token:raw,type:type as SetupLinkType};
}
function showPasswordSetup(mode:'link'|'manual',verified:boolean){
 passwordSetupMode=mode;
 hidden('pyramid-password-setup',false);
 hidden('pyramid-password-setup-form',!verified);
 hidden('pyramid-password-setup-cancel',mode!=='manual');
 hidden('pyramid-auth',true);
 hidden('pyramid-app',true);
 hidden('pyramid-public-panel',true);
 text('pyramid-password-setup-title',mode==='link'?'Passwort für Mein TSV einrichten':'Passwort ändern');
 text('pyramid-password-setup-intro',verified
   ?'Lege ein Passwort fest. Damit kannst du dich anschließend jederzeit mit deiner E-Mail-Adresse anmelden und dich sofort für eine Pyramide bewerben.'
   :'Dein einmaliger E-Mail-Link wird sicher geprüft …');
 text('pyramid-password-setup-status',verified
   ?'Verwende mindestens 10 Zeichen und wiederhole das neue Passwort.'
   :'');
}
async function exchangePasswordSetupLink(link:SetupLink){
 showPasswordSetup('link',false);
 try{
   const {data,error}=await supabase.auth.verifyOtp({
     type:link.type,token_hash:link.token
   });
   if(error)throw error;
   if(!data.user||!data.session)throw new Error('Keine gültige Anmeldung nach Link-Bestätigung.');
   showPasswordSetup('link',true);
   el<HTMLInputElement>('pyramid-new-password')?.focus();
 }catch(e){
   passwordSetupMode=null;
   hidden('pyramid-password-setup',true);
   await load();
   notice('Einrichtungslink ungültig oder abgelaufen: '+safeError(e)
     +'. Bitte fordere einen neuen Passwort-Link an.','error');
 }
}

function wireEvents(){
  const mobileMenu=el('pyramid-mobile-menu-toggle');
  mobileMenu?.addEventListener('click',()=>{
    const nav=mobileMenu.closest('.pyramid-member-nav');
    const open=!nav?.classList.contains('is-open');
    nav?.classList.toggle('is-open',open);
    mobileMenu.setAttribute('aria-expanded',String(open));
  });
  el<HTMLFormElement>('pyramid-lk-form')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const input=el<HTMLInputElement>('pyramid-own-lk');
    const value=Number(String(input?.value||'').replace(',','.'));
    modalMessage('pyramid-lk-error');
    if(!Number.isFinite(value)||value<1||value>25){
      modalMessage('pyramid-lk-error','Bitte eine gültige LK zwischen 1,0 und 25,0 eintragen.');return;
    }
    try{
      await rpc('pyramid_declare_my_lk',{p_lk:value});
      state.profile={...state.profile,tennis_lk_rating:value,tennis_lk_declared_at:new Date().toISOString()};
      el<HTMLDialogElement>('pyramid-lk-dialog')?.close();
      notice('Deine LK wurde verbindlich gespeichert. Spätere Korrekturen übernimmt der Superadmin.','success');
      await loadLadder();
    }catch(e){modalMessage('pyramid-lk-error',safeError(e));}
  });
  el<HTMLDialogElement>('pyramid-lk-dialog')?.addEventListener('cancel',event=>event.preventDefault());
  el<HTMLFormElement>('pyramid-password-setup-form')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const password=el<HTMLInputElement>('pyramid-new-password')?.value||'';
    const confirmation=el<HTMLInputElement>('pyramid-confirm-password')?.value||'';
    const button=el<HTMLButtonElement>('pyramid-password-setup-save');
    if(password.length<10||password.length>128){
      text('pyramid-password-setup-status','Das Passwort muss zwischen 10 und 128 Zeichen lang sein.');
      return;
    }
    if(password!==confirmation){
      text('pyramid-password-setup-status','Die Passwörter stimmen nicht überein. Bitte erneut prüfen.');
      return;
    }
    if(button)button.disabled=true;
    text('pyramid-password-setup-status','Dein Passwort wird sicher gespeichert …');
    try{
      const {data,error}=await supabase.auth.updateUser({password});
      if(error)throw error;
      if(!data.user)throw new Error('Die Passwortänderung konnte nicht bestätigt werden.');
      el<HTMLFormElement>('pyramid-password-setup-form')?.reset();
      passwordSetupMode=null;
      hidden('pyramid-password-setup',true);
      await load();
      notice('Passwort erfolgreich eingerichtet. Du kannst dich jetzt für die gewünschte Pyramide bewerben.','success');
      const join=el('pyramid-join-panel');
      if(join&&!join.classList.contains('hidden'))join.scrollIntoView({behavior:'smooth',block:'center'});
    }catch(e){
      text('pyramid-password-setup-status','Passwort konnte nicht gespeichert werden: '+safeError(e));
    }finally{
      if(button)button.disabled=false;
    }
  });
  el('pyramid-password-change')?.addEventListener('click',()=>{
    if(!state.user){notice('Bitte zuerst anmelden.','error');return;}
    showPasswordSetup('manual',true);
    el<HTMLInputElement>('pyramid-new-password')?.focus();
  });
  el('pyramid-password-setup-cancel')?.addEventListener('click',()=>{
    if(passwordSetupMode!=='manual')return;
    passwordSetupMode=null;
    el<HTMLFormElement>('pyramid-password-setup-form')?.reset();
    hidden('pyramid-password-setup',true);
    void load();
  });
  el<HTMLSelectElement>('pyramid-public-select')?.addEventListener('change',event=>{
    chosenPublicLadder=(event.target as HTMLSelectElement).value;
    renderGuestStandings();
  });
  el<HTMLFormElement>('pyramid-login-form')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const email=el<HTMLInputElement>('pyramid-email')?.value.trim()||'';
    const password=el<HTMLInputElement>('pyramid-password')?.value||'';
    try{await signIn(email,password);await load();notice('Du bist angemeldet.','success');}
    catch(e){notice(safeError(e),'error');}
  });
  el('pyramid-finalize-seed')?.addEventListener('click',()=>{
    if(!state.superAdmin||!state.ladderId)return;
    if(confirm('LK-Startaufstellung verbindlich abschließen? Später freigegebene Mitglieder werden am Ende eingereiht.')) {
      void (async () => {
        try {
          await rpc('pyramid_finalize_seed',{p_ladder:state.ladderId});
          notice('Startaufstellung abgeschlossen.','success');
          await load(); // Refresh the ladder's seeded_at flag, not just its entries.
        } catch(e) { notice(safeError(e),'error'); }
      })();
    }
  });
  el('pyramid-sign-out')?.addEventListener('click',async()=>{
    const {error}=await supabase.auth.signOut();
    if(error){notice(safeError(error),'error');return;}
    state.user=null;state.profile=null;state.superAdmin=false;state.ladders=[];state.entries=[];
    state.ownRequests=[];state.hasActiveEntry=false;
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
  el<HTMLFormElement>('pyramid-first-join-form')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const ladder=el<HTMLSelectElement>('pyramid-first-join-ladder')?.value||'';
    const name=el<HTMLInputElement>('pyramid-first-join-name')?.value.trim()||'';
    modalMessage('pyramid-first-join-error');
    if(!state.ladders.some(l=>l.id===ladder&&l.active)){
      modalMessage('pyramid-first-join-error','Bitte eine aktive Rangliste auswählen.');return;
    }
    if(name.length<2){modalMessage('pyramid-first-join-error','Bitte deinen Namen für die Rangliste eintragen.');return;}
    const form=el<HTMLFormElement>('pyramid-first-join-form');
    const button=form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if(button)button.disabled=true;
    try{
      await rpc('pyramid_request_join',{p_ladder:ladder,p_name:name});
      state.ladderId=ladder;
      state.ownRequests.push({id:'pending',ladder_id:ladder,user_id:state.user.id,display_name:name,status:'pending'});
      el<HTMLDialogElement>('pyramid-first-join-dialog')?.close();
      await loadLadder();
      notice('Deine Teilnahmeanfrage wurde gesendet. Nach der Freigabe erhältst du eine E-Mail.','success');
      const lkDialog=el<HTMLDialogElement>('pyramid-lk-dialog');
      if(!state.profile?.tennis_lk_declared_at&&!lkDialog?.open)lkDialog?.showModal();
    }catch(e){modalMessage('pyramid-first-join-error',safeError(e));}
    finally{if(button)button.disabled=false;}
  });
  el('pyramid-account-delete')?.addEventListener('click',async()=>{
    const me=myEntry(),ladder=currentLadder();
    if(!me||!ladder)return;
    const confirmation=prompt(
      'Dein Platz in „'+ladder.title+'“ wird freigegeben. Abgeschlossene Ergebnisse bleiben erhalten. Tippe LÖSCHEN zum Bestätigen.'
    );
    if(confirmation!=='LÖSCHEN'){
      if(confirmation!==null)notice('Kontolöschung nicht bestätigt.','info');
      return;
    }
    const button=el<HTMLButtonElement>('pyramid-account-delete');
    if(button)button.disabled=true;
    try{
      await rpc('pyramid_delete_my_account',{p_ladder:ladder.id});
      await loadLadder();
      notice('Dein Forderungspyramidenkonto wurde gelöscht. Der Ranglistenplatz ist wieder frei.','success');
    }catch(e){
      notice('Forderungspyramidenkonto konnte nicht gelöscht werden: '+safeError(e),'error');
      if(button)button.disabled=false;
    }
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
    const target=(event.target as HTMLElement).closest<HTMLElement>('[data-pyramid-challenge],[data-pyramid-accept],[data-pyramid-decline],[data-pyramid-withdraw],[data-pyramid-schedule],[data-pyramid-confirm-schedule],[data-pyramid-result],[data-pyramid-confirm],[data-pyramid-dispute],[data-pyramid-noshow],[data-pyramid-approve],[data-pyramid-move]');
    if(!target)return;
    const challenge=target.dataset.pyramidChallenge;
    if(challenge){if(confirm('Diese Person verbindlich herausfordern?'))void runAction(
      ()=>rpc('pyramid_challenge',{p_defender:challenge}),'Forderung eingetragen.');return;}
    const accept=target.dataset.pyramidAccept;
    if(accept){void runAction(()=>rpc('pyramid_respond',{p_challenge:accept,p_accept:true}),'Forderung angenommen.');return;}
    const decline=target.dataset.pyramidDecline;
    if(decline){
      const reason=prompt('Bitte den triftigen Grund für deine Absage angeben (mind. 10 Zeichen). Die Verwaltung entscheidet über Wertung oder Streichung.');
      if(reason!==null){
        if(reason.trim().length<10){notice('Bitte die Absage ausführlicher begründen.','error');return;}
        void runAction(()=>rpc('pyramid_submit_refusal',{p_challenge:decline,p_reason:reason.trim()}),
          'Absage eingereicht. Die Ranglistenverwaltung prüft sie.');
      }
      return;
    }
    const withdraw=target.dataset.pyramidWithdraw;
    if(withdraw){
      if(confirm('Forderung wirklich zurückziehen? Ein bereits vereinbarter Termin wird damit abgesagt.'))void runAction(
        ()=>rpc('pyramid_withdraw_challenge',{p_challenge:withdraw}),'Forderung zurückgezogen.');
      return;
    }
    const schedule=target.dataset.pyramidSchedule;
    if(schedule){
      state.resultChallenge=schedule;
      modalMessage('pyramid-schedule-error');
      const game=state.challenges.find(c=>c.id===schedule);
      const date=el<HTMLInputElement>('pyramid-schedule-date');
      if(date)date.value=game?.scheduled_for?new Date(game.scheduled_for).toISOString().slice(0,16):'';
      scheduleDialog?.showModal();
      return;
    }
    const confirmSchedule=target.dataset.pyramidConfirmSchedule;
    if(confirmSchedule){
      if(confirm('Diesen Spieltermin verbindlich akzeptieren?'))void runAction(
        ()=>rpc('pyramid_confirm_schedule',{p_challenge:confirmSchedule}),
        'Spieltermin akzeptiert. Das Spiel ist jetzt verbindlich vereinbart.');
      return;
    }
    const result=target.dataset.pyramidResult;
    if(result){openResult(result);return;}
    const confirmId=target.dataset.pyramidConfirm;
    if(confirmId){
      if(confirm('Stimmen Sieger und Satzergebnis? Erst danach wird die Rangliste geändert.'))
        void runAction(()=>rpc('pyramid_confirm_result',{
          p_challenge:confirmId,p_confirm:true,p_reason:null
        }),'Ergebnis bestätigt. Die Rangliste wurde aktualisiert.');
      return;
    }
    const disputeId=target.dataset.pyramidDispute;
    if(disputeId){
      const reason=prompt('Was stimmt am gemeldeten Ergebnis nicht? Der Ranglistenwart entscheidet.');
      if(reason===null)return;
      if(reason.trim().length<5){notice('Bitte den Widerspruch kurz begründen (mindestens 5 Zeichen).','error');return;}
      void runAction(()=>rpc('pyramid_confirm_result',{
        p_challenge:disputeId,p_confirm:false,p_reason:reason.trim()
      }),'Ergebnis bestritten. Die Rangliste bleibt bis zur Entscheidung unverändert.');
      return;
    }
    const noShow=target.dataset.pyramidNoshow;
    if(noShow){
      if(confirm('Ist dein Gegner mehr als 15 Minuten nach dem vereinbarten Termin nicht erschienen? Die Ranglistenverwaltung prüft die Meldung.'))
        void runAction(()=>rpc('pyramid_request_no_show',{p_challenge:noShow}),
          'Nichtantreten gemeldet. Entscheidung des Ranglistenwarts ausstehend.');
      return;
    }
    const approve=target.dataset.pyramidApprove;
    if(approve){void runAction(()=>rpc('pyramid_approve_join',{p_request:approve}),'Teilnahme freigegeben.');return;}
    const move=target.dataset.pyramidMove;
    if(move)void runAction(()=>rpc('pyramid_move_entry',{p_entry:move,p_delta:Number(target.dataset.delta)}),
      'Reihenfolge geändert.');
  });
  const avatarUpload=el<HTMLFormElement>('pyramid-avatar-form');
  const avatarInput=el<HTMLInputElement>('pyramid-avatar-file');
  let avatarSaving=false;
  let temporaryAvatarUrl:string|null=null;
  const releasePreview=()=>{
    if(temporaryAvatarUrl)URL.revokeObjectURL(temporaryAvatarUrl);
    temporaryAvatarUrl=null;
  };
  avatarInput?.addEventListener('change',()=>{
    const file=avatarInput.files?.[0];
    if(!file){releasePreview();renderMemberPortrait();return;}
    try{assertImageFile(file);}catch(e){
      releasePreview();
      avatarInput.value='';
      renderMemberPortrait();
      notice('Profilbild ungültig: '+safeError(e),'error');
      text('pyramid-avatar-save-state','Bitte ein gültiges Foto bis 8 MB auswählen.');
      return;
    }
    releasePreview();
    temporaryAvatarUrl=URL.createObjectURL(file);
    const preview=el('pyramid-avatar-preview');
    if(preview){
      const image=document.createElement('img');
      image.className='pyramid-member-avatar-preview';
      image.alt='Vorschau deines ausgewählten Profilbilds';
      image.src=temporaryAvatarUrl;
      preview.replaceChildren(image);
    }
    text('pyramid-avatar-save-state','Foto wird automatisch gespeichert …');
    avatarUpload?.requestSubmit();
  });
  avatarUpload?.addEventListener('submit',async event=>{
    event.preventDefault();
    if(avatarSaving)return;
    const file=avatarInput?.files?.[0],uid=state.user?.id;
    if(!uid||!file){
      notice('Bitte zuerst ein Profilbild auswählen.','error');
      return;
    }
    avatarSaving=true;
    if(avatarInput)avatarInput.disabled=true;
    try{
      const path=await replaceMediaImage({
        directory:'users/'+uid,file,basename:'avatar',maxDimension:512,quality:0.78,
        oldPath:state.profile?.avatar_path||null,
        persistPath:async newPath=>{
          const {error}=await supabase.rpc('pyramid_set_my_avatar',{p_path:newPath});
          return {error};
        }
      });
      state.profile={...state.profile,avatar_path:path};
      state.avatars[uid]=path;
      if(avatarInput)avatarInput.value='';
      releasePreview();renderMemberPortrait();renderBoard();
      text('pyramid-avatar-save-state','Dein Profilbild ist gespeichert und wird auf deiner Spieler-Kachel angezeigt.');
      notice('Profilbild automatisch gespeichert.','success');
    }catch(e){
      releasePreview();renderMemberPortrait();
      text('pyramid-avatar-save-state','Speichern fehlgeschlagen. Du kannst das Foto erneut auswählen.');
      notice('Profilbild konnte nicht gespeichert werden: '+safeError(e),'error');
    }finally{
      avatarSaving=false;
      if(avatarInput)avatarInput.disabled=false;
    }
  });
  el('pyramid-avatar-remove')?.addEventListener('click',async()=>{
    const uid=state.user?.id;
    const path=state.profile?.avatar_path;
    if(!uid||!path||!confirm('Eigenes Profilbild wirklich entfernen?'))return;
    const removeButton=el<HTMLButtonElement>('pyramid-avatar-remove');
    if(removeButton)removeButton.disabled=true;
    try{
      await removeMediaImage({
        path,directory:'users/'+uid,
        clearReference:async()=>{
          const {error}=await supabase.rpc('pyramid_set_my_avatar',{p_path:null});
          return {error};
        }
      });
      state.profile={...state.profile,avatar_path:null};
      delete state.avatars[uid];
      renderMemberPortrait();renderBoard();
      notice('Profilbild entfernt.','success');
    }catch(e){notice('Profilbild konnte nicht entfernt werden: '+safeError(e),'error');}
    finally{if(removeButton)removeButton.disabled=false;}
  });
  el<HTMLFormElement>('pyramid-availability-form')?.addEventListener('submit',event=>{
    event.preventDefault();
    const me=myEntry();
    if(!me)return;
    const reason=el<HTMLSelectElement>('pyramid-neutral-reason')?.value||null;
    void runAction(()=>rpc('pyramid_set_neutralized',{p_entry:me.id,p_reason:reason}),
      reason?'Dein Status wurde neutralisiert.':'Dein Status wurde auf spielbereit gesetzt.');
  });
  const scheduleDialog=el<HTMLDialogElement>('pyramid-schedule-dialog');
  el('pyramid-schedule-close')?.addEventListener('click',()=>scheduleDialog?.close());
  el('pyramid-schedule-cancel')?.addEventListener('click',()=>scheduleDialog?.close());
  scheduleDialog?.addEventListener('click',event=>{if(event.target===scheduleDialog)scheduleDialog.close();});
  el<HTMLFormElement>('pyramid-schedule-form')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const input=el<HTMLInputElement>('pyramid-schedule-date');
    const date=input?.value?new Date(input.value):null;
    modalMessage('pyramid-schedule-error');
    if(!date||Number.isNaN(date.getTime())){modalMessage('pyramid-schedule-error','Bitte einen gültigen Spieltermin auswählen.');return;}
    try{
      await rpc('pyramid_schedule_match',{p_challenge:state.resultChallenge,p_date:date.toISOString()});
      scheduleDialog?.close();
      notice('Spieltermin eingetragen. Das Spiel muss innerhalb von 14 Tagen nach der ursprünglichen Forderung stattfinden.','success');
      await loadLadder();
    }catch(e){modalMessage('pyramid-schedule-error',safeError(e));}
  });
  const dialog=el<HTMLDialogElement>('pyramid-dialog');
  el('pyramid-dialog-close')?.addEventListener('click',()=>dialog?.close());
  el('pyramid-dialog-cancel')?.addEventListener('click',()=>dialog?.close());
  dialog?.addEventListener('click',(event)=>{if(event.target===dialog)dialog.close();});
  el('pyramid-result-quick')?.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLElement>('[data-pyramid-result-score]');
    if(button?.dataset.pyramidResultScore)addResultSet(button.dataset.pyramidResultScore);
  });
  el('pyramid-result-custom-save')?.addEventListener('click',()=>{
    const own=el<HTMLInputElement>('pyramid-result-own-games')?.value||'';
    const opponent=el<HTMLInputElement>('pyramid-result-opponent-games')?.value||'';
    addResultSet(own+':'+opponent);
  });
  el('pyramid-result-undo')?.addEventListener('click',()=>{
    resultSets.pop();modalMessage('pyramid-result-error');renderResultWizard();
  });
  el<HTMLFormElement>('pyramid-result-form')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const value=el<HTMLInputElement>('pyramid-result-score')?.value.trim()||'';
    const normalizedScore=normalizeWinnerScore(value);
    if(!normalizedScore){modalMessage('pyramid-result-error','Bitte zuerst ein vollständiges Ergebnis mit zwei gewonnenen Sätzen erfassen.');return;}
    const winner=state.superAdmin?el<HTMLSelectElement>('pyramid-result-winner')?.value:undefined;
    try{
      await rpc('pyramid_report_result',{p_challenge:state.resultChallenge,p_score:normalizedScore,
        ...(winner?{p_winner:winner}:{})});
      dialog?.close();notice('Ergebnis gemeldet. Die Rangliste ändert sich erst nach Bestätigung des Gegners (innerhalb von 48 Stunden) oder Entscheidung des Ranglistenwarts.','success');await loadLadder();
    }catch(e){modalMessage('pyramid-result-error',safeError(e));}
  });
}
// This browser-only staging simulation never sends demo actions or players to Supabase.
// Nothing is persisted in storage. Every reload starts with fresh fictitious data.
const demoMode=import.meta.env.PUBLIC_PREVIEW_MODE==='true'
  && new URLSearchParams(location.search).get('demo')==='1';
type DemoRecords={entries:Entry[];requests:Request[];challenges:Challenge[]};
const demoRecords=new Map<string,DemoRecords>();
let demoSequence=0;
const demoTimestamp=()=>new Date().toISOString();
const demoDeadline=(days:number)=>new Date(Date.now()+days*86400000).toISOString();
function demoMessage(message:string,tone:'success'|'error'|'info'='info'){
  notice('TESTMODUS · '+message,tone);
}
function demoSwitchLadder(id:string){
  const data=demoRecords.get(id);
  if(!data)return;
  state.ladderId=id;
  state.entries=data.entries;
  state.requests=data.requests;
  state.challenges=data.challenges;
  demoRefresh();
}
function demoRefresh(){
  state.entries.sort((a,b)=>a.position-b.position);
  renderAll();
}
function demoRole(role:string){
  state.superAdmin=role==='admin';
  state.user={id:role==='admin'?'demo-user-15':role};
  state.profile={display_name:role==='admin'?'Muster-Admin'
    :role==='demo-user-12'?'Spieler 12':role==='demo-user-13'?'Spieler 13':role==='demo-user-15'?'Musterperson':'Gastkonto'};
  text('pyramid-user-name','Demo · '+state.profile.display_name);
  demoRefresh();
}
function demoMakeChallenge(targetId:string){
  const me=myEntry();
  const defender=state.entries.find((entry)=>entry.id===targetId);
  if(!me||!defender||!canSendChallenge(me,defender)){
    demoMessage('Diese Forderung ist für deine Testrolle nicht erlaubt.','error');return;
  }
  if(state.challenges.some((item)=>['pending','accepted'].includes(item.status)
    && item.challenger_id===me.id)){
    demoMessage('Du hast bereits eine offene Forderung. Beende sie zuerst.','error');return;
  }
  if(state.challenges.some(item=>item.status==='accepted'
    && (item.challenger_id===defender.id||item.defender_id===defender.id))){
    demoMessage('Dieser Spieler ist bis zum Abschluss seines angenommenen Spiels gesperrt.','error');return;
  }
  const id='demo-challenge-'+(++demoSequence);
  state.challenges.unshift({
    id,ladder_id:state.ladderId,challenger_id:me.id,defender_id:defender.id,
    status:'pending',created_at:demoTimestamp(),accept_deadline:demoDeadline(14),
    play_deadline:null,winner_id:null,score:null
  });
  demoAutomaticMailLog.push('An '+defender.display_name+': Neue Forderung durch '+me.display_name+'.');
  renderDemoMails();
  demoRefresh();
  demoMessage('Forderung gegen '+defender.display_name+' erstellt. Wechsle oben zur Rolle der geforderten Person, um sie anzunehmen.','success');
}
const demoAutomaticMailLog:string[]=[];
function renderDemoMails(){
  const list=el('pyramid-demo-mails');
  if(list)list.innerHTML=demoAutomaticMailLog.length
    ?'<h3>Simulierte E-Mail-Benachrichtigungen</h3><p class="muted">Diese Nachrichten werden in der Demo nicht verschickt.</p>'
      +demoAutomaticMailLog.map(line=>'<p>'+escapeHtml(line)+'</p>').join('')
    :'<p class="muted">Noch keine Benachrichtigungen.</p>';
}
function demoRespond(id:string,accept:boolean){
  const item=state.challenges.find((c)=>c.id===id);
  if(!item||item.status!=='pending')return;
  if(myEntry()?.id!==item.defender_id){
    demoMessage('Nur die geforderte Person kann antworten.','error');return;
  }
  item.status=accept?'accepted':'declined';
  if(accept){
    item.play_deadline=demoDeadline(14);
    const rejected=state.challenges.filter(c=>c.id!==item.id && c.status==='pending'
      && (c.defender_id===item.defender_id || c.defender_id===item.challenger_id
        || c.challenger_id===item.defender_id || c.challenger_id===item.challenger_id));
    for(const c of rejected){
      c.status='declined';c.decline_reason='another_match_accepted';
      demoAutomaticMailLog.push('An '+entryName(c.challenger_id)+': Forderung an '+entryName(c.defender_id)
        +' automatisch abgelehnt, weil ein anderes Spiel angenommen wurde.');
    }
    demoRefresh();renderDemoMails();
    demoMessage('Forderung angenommen. '+rejected.length+' weitere Forderung(en) automatisch abgelehnt. E-Mail-Benachrichtigung im Testprotokoll simuliert.','success');
  }else{
    item.decline_reason='player_declined';demoRefresh();
    demoMessage('Forderung abgelehnt.','success');
  }
}
function demoFinishGame(game:Challenge,winnerId:string,score:string|null,status:'completed'|'forfeit'='completed'){
  const winner=state.entries.find(e=>e.id===winnerId);
  const challenger=state.entries.find(e=>e.id===game.challenger_id);
  const defender=state.entries.find(e=>e.id===game.defender_id);
  if(!winner||!challenger||!defender)return;
  const loser=winner.id===challenger.id?defender:challenger;
  if(winner.id===challenger.id&&challenger.position>defender.position){
    const from=challenger.position,to=defender.position;
    state.entries.forEach(e=>{
      if(e.id!==challenger.id&&e.position>=to&&e.position<from)e.position++;
    });
    challenger.position=to;
  }
  game.status=status;game.winner_id=winner.id;game.score=score;
  game.resolved_at=demoTimestamp();
  winner.last_win_at=demoTimestamp();loser.last_loss_at=demoTimestamp();
  winner.provisional=false;loser.provisional=false;
}
function demoConfirmResult(id:string,accept:boolean){
  const game=state.challenges.find(c=>c.id===id);
  if(!game||game.status!=='result_pending')return;
  const own=myEntry();
  if(!own||![game.challenger_id,game.defender_id].includes(own.id)
      ||own.id===game.proposed_winner_id){
    demoMessage('Nur der gemeldete Verlierer darf das Ergebnis bestätigen.','error');return;
  }
  if(accept){
    demoFinishGame(game,game.proposed_winner_id!,game.proposed_score||null);
    demoRefresh();
    demoMessage('Ergebnis bestätigt. Die Rangliste wurde neu sortiert.','success');
  }else{
    game.status='result_disputed';game.dispute_reason='Muster-Widerspruch';
    demoRefresh();
    demoMessage('Widerspruch gespeichert. Bis zur Entscheidung bleiben die Plätze unverändert.','success');
  }
}
function demoReportResult(event:SubmitEvent){
  event.preventDefault();
  const dialog=el<HTMLDialogElement>('pyramid-dialog');
  const game=state.challenges.find(c=>c.id===state.resultChallenge);
  const score=el<HTMLInputElement>('pyramid-result-score')?.value.trim()||'';
  if(!game||game.status!=='accepted'){
    demoMessage('Kein angenommenes Spiel ausgewählt.','error');return;
  }
  if(scoreWinner(score)!==1){
    demoMessage('Bitte gültige zwei Gewinnsätze eingeben (dritter Satz ggf. Match-Tie-Break).','error');return;
  }
  const winnerId=state.superAdmin
    ?el<HTMLSelectElement>('pyramid-result-winner')?.value
    :myEntry()?.id;
  const winner=state.entries.find(e=>e.id===winnerId);
  if(!winner||![game.challenger_id,game.defender_id].includes(winner.id)
    ||(!state.superAdmin&&winner.user_id!==state.user?.id)){
    demoMessage('Nur der Sieger darf sein eigenes Ergebnis melden.','error');return;
  }
  game.status='result_pending';
  game.proposed_winner_id=winner.id;
  game.proposed_score=score;
  game.reported_at=demoTimestamp();
  game.confirmation_deadline=demoDeadline(2);
  demoAutomaticMailLog.push('An '+entryName(winner.id===game.challenger_id?game.defender_id:game.challenger_id)
    +': Ergebnis bitte innerhalb von 48 Stunden bestätigen.');
  dialog?.close();demoRefresh();renderDemoMails();
  demoMessage('Ergebnis gespeichert – wartet auf Bestätigung. Die Rangliste bleibt unverändert.','success');
}
function demoHandleButton(event:MouseEvent){
  const button=(event.target as Element).closest<HTMLButtonElement>('button');
  if(!button)return;
  if(button.disabled)return;
  if(button.id==='pyramid-demo-reset'){
    demoInitialize();
    demoMessage('Demo mit frischen Testdaten zurückgesetzt.','success');return;
  }
  if(button.id==='pyramid-sign-out'){
    location.href=location.pathname;return;
  }
  const challenger=button.dataset.pyramidChallenge;
  if(challenger){demoMakeChallenge(challenger);return;}
  const accept=button.dataset.pyramidAccept;
  if(accept){demoRespond(accept,true);return;}
  const decline=button.dataset.pyramidDecline;
  if(decline){demoRespond(decline,false);return;}
  const result=button.dataset.pyramidResult;
  if(result){openResult(result);return;}
  const confirmId=button.dataset.pyramidConfirm;
  if(confirmId){demoConfirmResult(confirmId,true);return;}
  const disputeId=button.dataset.pyramidDispute;
  if(disputeId){demoConfirmResult(disputeId,false);return;}
  const noShowId=button.dataset.pyramidNoshow;
  if(noShowId){demoMessage('Nichtantreten wurde simuliert. Die Ranglistenverwaltung muss entscheiden.');return;}
  const approval=button.dataset.pyramidApprove;
  if(approval){
    if(!state.superAdmin){demoMessage('Nur Super-Admins können freigeben.','error');return;}
    const request=state.requests.find((r)=>r.id===approval&&r.status==='pending');
    if(!request)return;
    request.status='approved';
    const position=Math.max(0,...state.entries.map((e)=>e.position))+1;
    state.entries.push({
      id:'demo-entry-'+(++demoSequence),
      ladder_id:state.ladderId,user_id:request.user_id,
      display_name:request.display_name,position,provisional:!currentLadder()?.seeded_at,
      qualified:true,last_loss_at:null
    });
    demoRefresh();
    demoMessage(request.display_name+' auf Rang '+position+' freigegeben.','success');
    return;
  }
  const moved=button.dataset.pyramidMove;
  if(moved){
    if(!state.superAdmin)return;
    const first=state.entries.find((e)=>e.id===moved);
    const delta=Number(button.dataset.delta);
    const second=state.entries.find((e)=>e.position===((first?.position??0)+delta));
    if(!first||!second)return;
    const prior=first.position;first.position=second.position;second.position=prior;
    demoRefresh();
    demoMessage('Die beiden Musterteilnehmer haben ihre Startplätze getauscht.','success');
    return;
  }
  if(button.id==='pyramid-finalize-seed'){
    const ladder=currentLadder();
    if(!state.superAdmin||!ladder||ladder.seeded_at)return;
    ladder.seeded_at=demoTimestamp();
    state.entries.forEach((e)=>{e.provisional=false;});
    demoRefresh();demoMessage('Startaufstellung abgeschlossen.','success');
  }
}
function demoHandleForm(event:SubmitEvent){
  const target=event.target as HTMLFormElement;
  if(target.id==='pyramid-availability-form'){
    event.preventDefault();
    const me=myEntry();
    const reason=el<HTMLSelectElement>('pyramid-neutral-reason')?.value||null;
    if(!me){demoMessage('Wähle zunächst einen Teilnehmer aus.','error');return;}
    if(state.challenges.some(c=>openStatuses.includes(c.status)
       &&(c.challenger_id===me.id||c.defender_id===me.id))&&reason){
      demoMessage('Bitte zuerst dein eingetragenes Forderungsspiel abschließen.','error');return;
    }
    me.neutralized_at=reason?demoTimestamp():null;
    me.neutralized_reason=reason;
    demoRefresh();
    demoMessage(reason?'Status '+friendlyReason(reason)+' gesetzt. Die Spieler-Kachel ist jetzt gekennzeichnet.':'Status wieder spielbereit.','success');
    return;
  }
  if(target.id==='pyramid-avatar-form'){
    event.preventDefault();
    demoMessage('Profilbild-Uploads sind in der unverbindlichen Demo deaktiviert. Melde dich auf der echten Mitgliederseite an, um ein eigenes Bild zu speichern.');
    return;
  }
  if(target.id==='pyramid-join-form'){
    event.preventDefault();
    if(!currentLadder())return;
    if(myEntry()){demoMessage('Du bist schon Teilnehmer dieser Gruppe.','error');return;}
    const name=el<HTMLInputElement>('pyramid-display-name')?.value.trim()||'';
    if(name.length<2){demoMessage('Bitte einen gültigen Namen eingeben.','error');return;}
    const existing=state.requests.find((r)=>r.user_id===state.user?.id);
    if(existing&&existing.status==='pending'){
      demoMessage('Eine Teilnahmeanfrage ist schon offen.','error');return;
    }
    if(existing){existing.status='pending';existing.display_name=name;}
    else state.requests.push({
      id:'demo-request-'+(++demoSequence),ladder_id:state.ladderId,
      user_id:state.user.id,display_name:name,status:'pending'
    });
    demoRefresh();demoMessage('Teilnahmeanfrage eingegangen. Zur Freigabe auf Muster-Admin wechseln.','success');
  }else if(target.id==='pyramid-create-form'){
    event.preventDefault();
    if(!state.superAdmin){demoMessage('Nur Super-Admins dürfen neue Gruppen anlegen.','error');return;}
    const title=el<HTMLInputElement>('pyramid-new-name')?.value.trim()||'';
    const season_label=el<HTMLInputElement>('pyramid-new-season')?.value.trim()||'';
    const starts_on=el<HTMLInputElement>('pyramid-new-start')?.value||'';
    const ends_on=el<HTMLInputElement>('pyramid-new-end')?.value||'';
    if(title.length<3||season_label.length<3||!starts_on||!ends_on||ends_on<starts_on){
      demoMessage('Bitte gültigen Namen, Saison und Zeitraum angeben.','error');return;
    }
    const id='demo-ladder-'+(++demoSequence);
    state.ladders.push({id,title,season_label,starts_on,ends_on,active:true,seeded_at:null});
    demoRecords.set(id,{entries:[],requests:[],challenges:[]});
    demoSwitchLadder(id);
    target.reset();
    demoMessage('Neue Test-Rangliste angelegt. Wechsle zur Teilnehmerrolle, um die Teilnahme zu beantragen.','success');
  }
}
function demoInitialize(){
  demoSequence=30;
  demoRecords.clear();
  state.avatars={};
  demoAutomaticMailLog.length=0;
  renderDemoMails();
  state.ladders=[{
    id:'demo-winter',title:'Herren · Mustergruppe',
    season_label:'Winter 2026/2027',starts_on:'2026-11-01',
    ends_on:'2027-03-31',active:true,seeded_at:demoTimestamp()
  },{
    id:'demo-summer',title:'Testpyramide',
    season_label:'Sommer 2027',starts_on:'2027-05-01',
    ends_on:'2027-09-30',active:true,seeded_at:demoTimestamp()
  }];
  demoRecords.set('demo-winter',{
    entries:Array.from({length:15},(_,index)=>({
      id:'demo-entry-'+(index+1),ladder_id:'demo-winter',
      user_id:'demo-user-'+(index+1),
      display_name:index===14?'Musterperson':'Spieler '+(index+1),
      position:index+1,provisional:false,last_loss_at:null
    })),
    requests:[{
      id:'demo-request-1',ladder_id:'demo-winter',
      user_id:'demo-requester',display_name:'Neue Musterperson',status:'pending'
    }],
    challenges:[{
      id:'demo-game-1',ladder_id:'demo-winter',challenger_id:'demo-entry-7',
      defender_id:'demo-entry-5',status:'accepted',
      created_at:demoTimestamp(),accept_deadline:demoDeadline(14),
      play_deadline:demoDeadline(14),winner_id:null,score:null
    },{
      id:'demo-game-2',ladder_id:'demo-winter',challenger_id:'demo-entry-14',
      defender_id:'demo-entry-13',status:'pending',
      created_at:demoTimestamp(),accept_deadline:demoDeadline(14),
      play_deadline:null,winner_id:null,score:null
    }]
  });
  demoRecords.set('demo-summer',{
    entries:[
      15.2,9.6,18.1,13.4,20.7,11.8,16.5,7.9,14.6,22.1,
      12.7,17.3,10.5,19.2,15.8,8.8,13.9,21.4,16.9,6.7,
      14.1,18.7,11.2,23.0,15.5,9.1,17.8,12.2,20.0,13.1
    ].map((lk,index)=>({
      id:'demo-test-entry-'+(index+1),ladder_id:'demo-summer',
      user_id:'demo-user-'+(index+1),
      display_name:'Test'+(index+1),position:index+1,lk_rating:lk,
      provisional:false,qualified:true,last_loss_at:null
    })),
    requests:[],challenges:[]
  });
  demoSwitchLadder('demo-summer');
  const picker=el<HTMLSelectElement>('pyramid-demo-role');
  if(picker)picker.value='admin';
  demoRole('admin');
}
function renderDemo(){
  const root=el('pyramid-root');
  if(!root)return;
  root.dataset.demoMode='true';
  // The staging demo intentionally keeps every tool on one page so the
  // interaction check can exercise the complete flow without real accounts.
  root.querySelectorAll<HTMLElement>('.pyramid-section-disabled').forEach(node=>node.classList.remove('pyramid-section-disabled'));
  for(const id of ['pyramid-ladders','pyramid-avatar-panel','pyramid-overview','pyramid-availability-panel','pyramid-games-panel','pyramid-admin-panel'])
    hidden(id,false);
  const availability=el<HTMLDetailsElement>('pyramid-availability-panel');
  if(availability)availability.open=true;
  hidden('pyramid-auth',true);
  hidden('pyramid-public-panel',true);
  hidden('pyramid-app',false);
  hidden('pyramid-password-change',true);
  const banner=document.createElement('section');
  banner.className='card pyramid-demo-bar';
  banner.setAttribute('aria-label','Testmodus');
  banner.innerHTML='<p class="eyebrow">Nur Testdaten · keine echte Anmeldung</p>'
    +'<h2>Interaktive Vorschau</h2>'
    +'<p>Du kannst alle Aktionen ausprobieren. Änderungen bleiben ausschließlich im Browser '
    +'und werden beim Neuladen zurückgesetzt.</p>'
    +'<p><strong>30-Personen-Test:</strong> Die vorausgewählte Testpyramide zeigt Test1 bis Test30 '
    +'mit gaußähnlich verteilten LK-Werten für Sommer 2027. '
    +'<strong>Forderung annehmen:</strong> Wechsle für den Interaktionstest zur Herren-Mustergruppe und wähle unten „Geforderte Person · Spieler 13“. '
    +'Öffne „Forderungsspiele“ und klicke bei „Spieler 14 fordert Spieler 13“ auf „Annehmen“. '
    +'Die TSV-Regeln erlauben pro Spieler nur eine offene Forderung. Ein Test-Urlaub lässt sich im Abschnitt „Meine Verfügbarkeit“ aktivieren.</p>'
    +'<div class="pyramid-demo-controls">'
    +'<label for="pyramid-demo-role">Testrolle auswählen</label>'
    +'<select id="pyramid-demo-role">'
    +'<option value="admin">Muster-Admin (mit Teilnehmerplatz 15)</option>'
    +'<option value="demo-user-15">Mitglied · Musterperson (Platz 15)</option>'
    +'<option value="demo-user-12">Geforderte Person · Spieler 12</option>'
    +'<option value="demo-user-13">Geforderte Person · Spieler 13</option>'
    +'<option value="demo-guest">Mitglied ohne Ranglistenplatz</option>'
    +'</select><button type="button" class="button secondary" id="pyramid-demo-reset">'
    +'Demo zurücksetzen</button></div>';
  root.insertBefore(banner,el('pyramid-app'));
  const mailBox=document.createElement('section');
  mailBox.id='pyramid-demo-mails';
  mailBox.className='card';
  mailBox.setAttribute('aria-label','Simulierte E-Mail-Benachrichtigungen');
  root.insertBefore(mailBox,el('pyramid-app'));
  el('pyramid-app')?.addEventListener('click',demoHandleButton);
  banner.addEventListener('click',demoHandleButton);
  el('pyramid-app')?.addEventListener('submit',demoHandleForm);
  el<HTMLSelectElement>('pyramid-ladder-select')?.addEventListener('change',(event)=>{
    demoSwitchLadder((event.target as HTMLSelectElement).value);
  });
  el<HTMLSelectElement>('pyramid-demo-role')?.addEventListener('change',(event)=>{
    demoRole((event.target as HTMLSelectElement).value);
    demoMessage('Ansicht auf die ausgewählte Testrolle umgestellt.','success');
  });
  el<HTMLFormElement>('pyramid-result-form')?.addEventListener('submit',demoReportResult);
  el('pyramid-result-quick')?.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLElement>('[data-pyramid-result-score]');
    if(button?.dataset.pyramidResultScore)addResultSet(button.dataset.pyramidResultScore);
  });
  el('pyramid-result-custom-save')?.addEventListener('click',()=>{
    const own=el<HTMLInputElement>('pyramid-result-own-games')?.value||'';
    const opponent=el<HTMLInputElement>('pyramid-result-opponent-games')?.value||'';
    addResultSet(own+':'+opponent);
  });
  el('pyramid-result-undo')?.addEventListener('click',()=>{resultSets.pop();renderResultWizard();});
  const dialog=el<HTMLDialogElement>('pyramid-dialog');
  el('pyramid-dialog-close')?.addEventListener('click',()=>dialog?.close());
  el('pyramid-dialog-cancel')?.addEventListener('click',()=>dialog?.close());
  dialog?.addEventListener('click',(event)=>{if(event.target===dialog)dialog.close();});
  demoInitialize();
}
export function initPyramid(){
  if(demoMode) {renderDemo();return;}
  const summer=defaultMasterSeason();
  for(const [id,value] of [
    ['pyramid-new-season',summer.label],
    ['pyramid-new-start',summer.startsOn],
    ['pyramid-new-end',summer.endsOn]
  ]){
    const field=el<HTMLInputElement>(id);
    if(field&&!field.value)field.value=value;
  }
  wireEvents();
  const token=consumePasswordSetupLink();
  if(token){
    passwordSetupMode='link';
    void exchangePasswordSetupLink(token);
  }else{
    void load();
  }
  supabase.auth.onAuthStateChange((event)=>{
    if(event==='PASSWORD_RECOVERY'){
      queueMicrotask(()=>showPasswordSetup('link',true));
    }else if(event==='SIGNED_IN'||event==='SIGNED_OUT'){
      queueMicrotask(()=>void load());
    }
  });
}
