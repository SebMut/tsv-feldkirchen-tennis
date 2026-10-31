import { supabase } from '../lib/supabase';
import { setStatus } from '../lib/ui';
// All source-backed player records stay behind authenticated SuperAdmin login and DB RLS.
type MatchRow={match_id:string;starts_at:string;is_home:boolean;opponent:string;team_name:string;season_code:string};
type Report={id:string;match_id:string;source_meeting_id:number;report_url:string;verification_status:string};
type Pairing={discipline:string;position:number;home_participants:{name:string}[];away_participants:{name:string}[];set_results:{home:number;away:number}[];special_status:string;winner_side:string|null;verification_status:string};
const byId=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T|null;
const el=(tag:string,value:string,cls='')=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
const date=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
let matches:MatchRow[]=[], reports=new Map<string,Report>(),selected:string|null=null,initialized=false;
const label=(m:MatchRow)=>m.is_home?'TSV Feldkirchen '+m.team_name+' – '+m.opponent:m.opponent+' – TSV Feldkirchen '+m.team_name;
function message(value:string,tone:'info'|'error'|'success'='info'){
 const node=byId<HTMLElement>('btv-rubbers-feedback');if(node)setStatus(node,value,tone);
}
function render(){
 const target=byId<HTMLElement>('btv-rubbers-list');if(!target)return;
 target.replaceChildren();
 const team=byId<HTMLSelectElement>('btv-rubbers-team')?.value||'all';
 const search=(byId<HTMLInputElement>('btv-rubbers-search')?.value||'').trim().toLocaleLowerCase('de-DE');
 const missing=!!byId<HTMLInputElement>('btv-rubbers-missing')?.checked;
 const filtered=matches.filter(m=>(team==='all'||team===m.team_name)&&(!missing||!reports.has(m.match_id))&&(!search||label(m).toLocaleLowerCase('de-DE').includes(search)));
 for(const m of filtered){
  const r=reports.get(m.match_id),b=document.createElement('button');
  b.type='button';b.className='button secondary';
  b.textContent=date.format(new Date(m.starts_at))+' · '+label(m)+(r?.verification_status==='verified'?' · Einzel/Doppel verifiziert':' · Spielbericht fehlt');
  b.setAttribute('aria-pressed',String(selected===m.match_id));
  b.addEventListener('click',()=>void choose(m.match_id));
  target.append(b);
 }
 if(!filtered.length)target.append(el('p','Keine passenden Begegnungen.','muted'));
 const count=byId<HTMLElement>('btv-rubbers-count');if(count)count.textContent=String(filtered.length);
}
async function choose(id:string){
 const fixture=matches.find(m=>m.match_id===id),target=byId<HTMLElement>('btv-rubbers-detail');if(!fixture||!target)return;
 selected=id;render();target.replaceChildren(el('h3',label(fixture)));
 const report=reports.get(id);
 if(!report||report.verification_status!=='verified'){
  target.append(el('p','Für diese Begegnung fehlt noch ein vollständig verifizierter amtlicher Einzel-/Doppelspielbericht.','muted'));return;
 }
 const url=new URL(report.report_url);
 if(url.origin==='https://btv.liga.nu'&&url.pathname.endsWith('/nuDokument')&&url.searchParams.get('dokument')==='MeetingReportFOP'&&url.searchParams.get('meeting')===String(report.source_meeting_id)){
   const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.className='text-link';a.textContent='Amtlichen BTV-Spielbericht öffnen ↗';target.append(a);
 }
 const {data,error}=await supabase.from('official_report_rubbers').select('discipline,position,home_participants,away_participants,set_results,special_status,winner_side,verification_status').eq('report_id',report.id).order('position',{ascending:true}).limit(20);
 if(selected!==id)return;
 if(error){target.append(el('p','Spielerdaten konnten nicht geladen werden.','muted'));return;}
 const rows=(data||[]) as Pairing[];
 if(!rows.length){target.append(el('p','Noch keine Einzel-/Doppeldaten vorhanden.','muted'));return;}
 for(const kind of ['single','double']){
   const set=rows.filter(r=>r.discipline===kind);if(!set.length)continue;
   target.append(el('h4',kind==='single'?'Einzel ('+set.length+')':'Doppel ('+set.length+')'));
   for(const r of set){
    const card=el('div','','card stack');
    card.append(el('strong',(kind==='single'?'Einzel ':'Doppel ')+r.position));
    const h=(r.home_participants||[]).map(p=>p.name).filter(Boolean).join(' / ');
    const a=(r.away_participants||[]).map(p=>p.name).filter(Boolean).join(' / ');
    card.append(el('p','Heim: '+h));card.append(el('p','Gast: '+a));
    const score=(r.set_results||[]).map(x=>x.home+':'+x.away).join(' · ');
    card.append(el('p',r.special_status==='walkover'?'Kampflos (w.o.), keine gespielten Sätze':'Sätze (Heim:Gast): '+score,'muted'));
    card.append(el('small',r.winner_side==='home'?'Gewinner: Heim':r.winner_side==='away'?'Gewinner: Gast':'Gewinner nicht bestätigt','muted'));
    target.append(card);
   }
 }
}
async function load(){
 message('Spielberichte Sommer 2026 werden geladen …');
 const [m,r]=await Promise.all([
  supabase.from('manual_editable_matches').select('match_id,starts_at,is_home,opponent,team_name,season_code').eq('season_code','sommer-2026').order('starts_at',{ascending:true}).limit(250),
  supabase.from('official_meeting_reports').select('id,match_id,source_meeting_id,report_url,verification_status').not('match_id','is',null).limit(250)
 ]);
 if(m.error||r.error){message('Spielberichte konnten nicht geladen werden. Berechtigungen prüfen.','error');return;}
 matches=(m.data||[]) as MatchRow[];
 reports=new Map(((r.data||[]) as Report[]).filter(x=>matches.some(m=>m.match_id===x.match_id)).map(x=>[x.match_id,x]));
 const team=byId<HTMLSelectElement>('btv-rubbers-team');
 if(team){
  const previous=team.value;team.replaceChildren();
  const option=(v:string)=>{const o=document.createElement('option');o.value=v;o.textContent=v==='all'?'Alle Mannschaften':v;return o;};
  team.append(option('all'));
  for(const name of [...new Set(matches.map(x=>x.team_name))].sort((a,b)=>a.localeCompare(b,'de')))team.append(option(name));
  if([...team.options].some(x=>x.value===previous))team.value=previous;
 }
 const verified=matches.filter(x=>reports.get(x.match_id)?.verification_status==='verified').length;
 const summary=byId<HTMLElement>('btv-rubbers-summary');
 if(summary)summary.textContent=verified+' von '+matches.length+' Begegnungen mit vollständig geprüftem Einzel-/Doppelbericht; '+(matches.length-verified)+' noch ohne vollständigen Detailbericht.';
 render();
 if(selected&&matches.some(x=>x.match_id===selected))await choose(selected);
 else{const details=byId<HTMLElement>('btv-rubbers-detail');details?.replaceChildren(el('p','Wähle eine Begegnung, um ihre Einzel- und Doppelresultate zu sehen.','muted'));}
 message('Spielberichte aktualisiert.','success');
}
export function initOfficialReportsPanel(){
 if(initialized)return;initialized=true;
 byId<HTMLButtonElement>('btv-rubbers-refresh')?.addEventListener('click',()=>void load());
 byId<HTMLSelectElement>('btv-rubbers-team')?.addEventListener('change',render);
 byId<HTMLInputElement>('btv-rubbers-search')?.addEventListener('input',render);
 byId<HTMLInputElement>('btv-rubbers-missing')?.addEventListener('change',render);
 void load();
}
