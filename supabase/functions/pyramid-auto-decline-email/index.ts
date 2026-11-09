// Separate staging-only notification worker. Dispatch requires a one-time pg_cron token.
// Existing Gmail OAuth sender credentials are reused; no client-side email secrets.
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';

const env=(key:string)=>Deno.env.get(key)?.trim()||'';
type Notice={
 id:string;kind:'auto_decline'|'challenge_created'|'result_reported';recipient_email:string|null;challenger_name:string;
 defender_name:string;ladder_title:string;season_label:string;challenge_status:string;
};
type ChangeNotice={
 id:string;recipient_email:string|null;recipient_name:string;opponent_name:string;
 ladder_title:string;season_label:string;event_type:string;
 details:{status?:string;scheduled_for?:string|null;score?:string|null;reason?:string|null};
};
type JoinApprovalNotice={
 id:string;recipient_email:string|null;recipient_name:string;
 ladder_title:string;season_label:string;
};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
});
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,(c)=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[c]||c));
function b64(value:string){
 const bytes=new TextEncoder().encode(value);
 let binary='';
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(binary);
}
function wrap(value:string){
 return b64(value).match(/.{1,76}/g)?.join('\r\n')||'';
}
function gmailRaw(to:string,subject:string,plain:string,html:string) {
 const boundary='tsv-pyramid-'+crypto.randomUUID().replaceAll('-','');
 const source=[
 'From: TSV Feldkirchen Tennis <tsvfeldkirchen.tennis@gmail.com>',
 'To: <'+to+'>',
 'Subject: =?UTF-8?B?'+b64(subject)+'?=',
 'Date: '+new Date().toUTCString(),
 'MIME-Version: 1.0',
 'Content-Type: multipart/alternative; boundary="'+boundary+'"',
 '',
 '--'+boundary,'Content-Type: text/plain; charset=UTF-8',
 'Content-Transfer-Encoding: base64','',wrap(plain),
 '--'+boundary,'Content-Type: text/html; charset=UTF-8',
 'Content-Transfer-Encoding: base64','',wrap(html),
 '--'+boundary+'--',''
 ].join('\r\n');
 return b64(source).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function buildMail(row:Notice) {
 const newChallenge=row.kind==='challenge_created';
 const resultReported=row.kind==='result_reported';
 const accepted=row.challenge_status==='accepted';
 const title=resultReported
   ?'TSV Feldkirchen Tennis · Ergebnis bitte bestätigen'
   :newChallenge
     ?(accepted?'TSV Feldkirchen Tennis · Privates Forderungsspiel eingetragen'
       :'TSV Feldkirchen Tennis · Neue Forderung')
     :'TSV Feldkirchen Tennis · Forderung automatisch abgelehnt';
 const greeting='Hallo '+(newChallenge?row.defender_name:
   resultReported?'Tennis-Mitglied':row.challenger_name)+',';
 const stateText=resultReported
   ?'Das Ergebnis eures Forderungsspiels wurde vom Sieger eingetragen. Bitte prüfe und bestätige es innerhalb von 48 Stunden in Mein TSV. Wenn das Ergebnis falsch ist, kannst du widersprechen; der Ranglistenwart entscheidet. Die Platzierung bleibt bis zur Bestätigung unverändert.'
   :newChallenge
     ?(accepted
       ?'Ein privates Forderungsspiel gegen '+row.challenger_name+' wurde in der Rangliste eingetragen.'
       :'Du wurdest von '+row.challenger_name+' gefordert. Bitte stimmt euren Spieltermin möglichst innerhalb von drei Tagen ab. Das Spiel ist spätestens 14 Tage nach der Forderung auszutragen.')
     :'Deine Forderung an '+row.defender_name+' wurde automatisch abgelehnt, weil ein anderes Forderungsspiel angenommen wurde.';
 const followup=resultReported
   ?'Bitte melde dich im geschützten Mitgliederbereich an. Die Rangliste wird erst nach Ergebnisbestätigung oder Entscheidung des Ranglistenwarts geändert.'
   :newChallenge
     ?'Der Forderer reserviert den Platz und stellt die neuen Bälle. Bei Fristproblemen entscheidet der Ranglistenwart; eine automatische Niederlage erfolgt nicht.'
     :'Sobald beide Spieler wieder frei sind, kannst du nach den gültigen Sperrfristen erneut fordern.';
 const link='https://www.tennis-tsvfeldkirchen.de/forderungspyramide/';
 const plain=[
  'TSV FELDKIRCHEN TENNIS',title,'',greeting,'',stateText,'',
  'Gruppe: '+row.ladder_title+' · '+row.season_label,'',followup,'',
  'Forderungspyramide: '+link,'',
  'Diese Nachricht wurde automatisch erstellt. Bitte antworte nicht direkt auf diese E-Mail.',
  'TSV Feldkirchen Tennis'
 ].join('\n');
 const html='<!doctype html><html lang="de"><head><meta charset="UTF-8"></head><body style="margin:0;background:#f4f5f5;font-family:Arial,Helvetica,sans-serif;color:#183026">'
  +'<div style="max-width:640px;margin:25px auto;background:white;border:1px solid #dde4e1;border-radius:14px;overflow:hidden">'
  +'<header style="background:#e30613;color:#fff;padding:24px 28px"><p style="margin:0;font-size:12px;letter-spacing:2px;font-weight:bold">TSV FELDKIRCHEN TENNIS</p>'
  +'<h1 style="font-size:24px;margin:9px 0 0">'+escapeHtml(title.replace('TSV Feldkirchen Tennis · ',''))+'</h1></header>'
  +'<main style="padding:26px 28px"><p>'+escapeHtml(greeting)+'</p><p>'+escapeHtml(stateText)+'</p>'
  +'<p style="background:#fff2f2;border-left:5px solid #e30613;padding:14px"><strong>'
  +escapeHtml(row.ladder_title)+' · '+escapeHtml(row.season_label)+'</strong></p>'
  +'<p>'+escapeHtml(followup)+'</p>'
  +'<p><a href="'+link+'" style="display:inline-block;background:#e30613;color:white;'
  +'border-radius:8px;padding:13px 20px;text-decoration:none;font-weight:bold">'
  +'Zur Forderungspyramide</a></p>'
  +'<p>Sportliche Grüße<br><strong>TSV Feldkirchen Tennis</strong></p></main>'
  +'<footer style="padding:16px 28px;background:#15382f;color:#f6f6f6;font-size:12px">'
  +'Automatische Benachrichtigung der Tennisabteilung</footer></div></body></html>';
 return {title,plain,html};
}
function buildChangeMail(row:ChangeNotice){
 const labels:Record<string,string>={
  status_pending:'Forderung aktualisiert',status_accepted:'Forderung angenommen',
  status_result_pending:'Ergebnis zur Bestätigung',status_result_disputed:'Widerspruch zum Ergebnis',
  status_completed:'Ergebnis bestätigt',status_declined:'Forderung abgelehnt',
  status_cancelled:'Forderung beendet',status_forfeit:'Spiel gewertet',
  termin_geaendert:'Spieltermin geändert',termin_bestaetigt:'Spieltermin bestätigt',
  ergebnis_geaendert:'Ergebnis geändert',spiel_geaendert:'Forderungsspiel geändert'
 };
 const eventLabel=labels[row.event_type]||'Forderungsspiel geändert';
 const date=row.details?.scheduled_for
   ?new Intl.DateTimeFormat('de-DE',{dateStyle:'full',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(row.details.scheduled_for)):'';
 const facts=[date?'Spieltermin: '+date:'',row.details?.score?'Ergebnis: '+row.details.score:'',
  row.details?.reason?'Hinweis: '+row.details.reason:''].filter(Boolean);
 const title='TSV Feldkirchen Tennis · '+eventLabel;
 const link='https://www.tennis-tsvfeldkirchen.de/forderungspyramide/';
 const plain=['TSV FELDKIRCHEN TENNIS',title,'','Hallo '+row.recipient_name+',','',
  'Bei deinem Forderungsspiel gegen '+row.opponent_name+' gibt es eine Änderung.',...facts,'',
  'Rangliste: '+row.ladder_title+' · '+row.season_label,'','Details ansehen: '+link,'',
  'Sportliche Grüße','TSV Feldkirchen Tennis'].join('\n');
 const factHtml=facts.length?'<div style="background:#fff2f2;border-left:5px solid #e30613;padding:14px 16px;margin:20px 0">'
  +facts.map(x=>'<p style="margin:5px 0"><strong>'+escapeHtml(x)+'</strong></p>').join('')+'</div>':'';
 const html='<!doctype html><html lang="de"><head><meta charset="UTF-8"></head><body style="margin:0;background:#f4f5f5;font-family:Arial,Helvetica,sans-serif;color:#183026">'
  +'<div style="max-width:640px;margin:25px auto;background:#fff;border:1px solid #dde4e1;border-radius:14px;overflow:hidden">'
  +'<header style="background:#e30613;color:#fff;padding:24px 28px"><p style="margin:0;font-size:12px;letter-spacing:2px;font-weight:bold">TSV FELDKIRCHEN TENNIS</p><h1 style="font-size:24px;margin:9px 0 0">'+escapeHtml(eventLabel)+'</h1></header>'
  +'<main style="padding:26px 28px"><p>Hallo '+escapeHtml(row.recipient_name)+',</p><p>Bei deinem Forderungsspiel gegen <strong>'+escapeHtml(row.opponent_name)+'</strong> gibt es eine Änderung.</p>'
  +factHtml+'<p><strong>'+escapeHtml(row.ladder_title)+' · '+escapeHtml(row.season_label)+'</strong></p>'
  +'<p><a href="'+link+'" style="display:inline-block;background:#e30613;color:#fff;border-radius:8px;padding:13px 20px;text-decoration:none;font-weight:bold">Änderung ansehen</a></p>'
  +'<p>Sportliche Grüße<br><strong>TSV Feldkirchen Tennis</strong></p></main>'
  +'<footer style="padding:16px 28px;background:#15382f;color:#f6f6f6;font-size:12px">Automatische Benachrichtigung der Tennisabteilung</footer></div></body></html>';
 return {title,plain,html};
}
function buildJoinApprovalMail(row:JoinApprovalNotice){
 const title='TSV Feldkirchen Tennis · Teilnahme genehmigt';
 const link='https://www.tennis-tsvfeldkirchen.de/forderungspyramide/';
 const plain=['TSV FELDKIRCHEN TENNIS',title,'','Hallo '+row.recipient_name+',','',
  'deine Anmeldung für die Forderungspyramide wurde genehmigt. Du bist jetzt in der Rangliste sichtbar und kannst nach den gültigen Regeln Forderungen aussprechen und annehmen.','',
  'Rangliste: '+row.ladder_title+' · '+row.season_label,'','Zur Forderungspyramide: '+link,'',
  'Sportliche Grüße','TSV Feldkirchen Tennis'].join('\n');
 const html='<!doctype html><html lang="de"><head><meta charset="UTF-8"></head><body style="margin:0;background:#f4f5f5;font-family:Arial,Helvetica,sans-serif;color:#183026">'
  +'<div style="max-width:640px;margin:25px auto;background:#fff;border:1px solid #dde4e1;border-radius:14px;overflow:hidden">'
  +'<header style="background:#e30613;color:#fff;padding:24px 28px"><p style="margin:0;font-size:12px;letter-spacing:2px;font-weight:bold">TSV FELDKIRCHEN TENNIS</p><h1 style="font-size:24px;margin:9px 0 0">Teilnahme genehmigt</h1></header>'
  +'<main style="padding:26px 28px"><p>Hallo '+escapeHtml(row.recipient_name)+',</p>'
  +'<p>deine Anmeldung für die Forderungspyramide wurde genehmigt. Du bist jetzt in der Rangliste sichtbar und kannst nach den gültigen Regeln Forderungen aussprechen und annehmen.</p>'
  +'<p style="background:#fff2f2;border-left:5px solid #e30613;padding:14px"><strong>'+escapeHtml(row.ladder_title)+' · '+escapeHtml(row.season_label)+'</strong></p>'
  +'<p><a href="'+link+'" style="display:inline-block;background:#e30613;color:#fff;border-radius:8px;padding:13px 20px;text-decoration:none;font-weight:bold">Zur Forderungspyramide</a></p>'
  +'<p>Sportliche Grüße<br><strong>TSV Feldkirchen Tennis</strong></p></main>'
  +'<footer style="padding:16px 28px;background:#15382f;color:#f6f6f6;font-size:12px">Automatische Benachrichtigung der Tennisabteilung</footer></div></body></html>';
 return {title,plain,html};
}
async function sendGmail(row:Notice|ChangeNotice|JoinApprovalNotice,mode:'legacy'|'change'|'join'='legacy') {
 const authResponse=await fetch('https://oauth2.googleapis.com/token',{
  method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({
   client_id:env('GMAIL_CLIENT_ID'),
   client_secret:env('GMAIL_CLIENT_SECRET'),
   refresh_token:env('GMAIL_REFRESH_TOKEN'),
   grant_type:'refresh_token'
  }),
 }).catch(()=>null);
 if(!authResponse?.ok)return {ok:false,code:'gmail_auth_failure'};
 const response=await authResponse.json().catch(()=>null);
 if(typeof response?.access_token!=='string')return {ok:false,code:'gmail_token_missing'};
 const mail=mode==='join'?buildJoinApprovalMail(row as JoinApprovalNotice)
  :mode==='change'?buildChangeMail(row as ChangeNotice):buildMail(row as Notice);
 const result=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
  method:'POST',
  headers:{authorization:'Bearer '+response.access_token,'content-type':'application/json'},
  body:JSON.stringify({raw:gmailRaw(row.recipient_email!,mail.title,mail.plain,mail.html)})
 }).catch(()=>null);
 return {ok:!!result?.ok,code:result?.ok?'sent':('gmail_http_'+(result?.status||'network'))};
}
Deno.serve(async(req)=>{
 if(req.method!=='POST')return reply(405,{error:'POST only'});
 const raw=await req.text();
 if(raw.length>2000)return reply(413,{error:'Request too large'});
 let body:Record<string,unknown>;
 try{body=JSON.parse(raw)}catch{return reply(400,{error:'Invalid JSON'})}
 if(typeof body.dispatch_token!=='string'
  || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.dispatch_token))
   return reply(401,{error:'Unauthorized'});
 if(!env('SUPABASE_URL')||!env('SUPABASE_SERVICE_ROLE_KEY'))return reply(503,{error:'Server not configured'});
 const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{
  auth:{autoRefreshToken:false,persistSession:false}
 });
 const {data:authorized,error:authError}=await db.rpc('consume_pyramid_cron_token',{p_token:body.dispatch_token});
 if(authError||authorized!==true)return reply(401,{error:'Unauthorized'});
 let sent=0,failed=0;
 for(let n=0;n<10;n++){
  const joinClaim=await db.rpc('claim_pyramid_join_approval_notification');
  if(joinClaim.error){console.error('pyramid_join_notice_claim_failed');return reply(503,{error:'Queue unavailable',sent,failed})}
  let row:Notice|ChangeNotice|JoinApprovalNotice|null=(Array.isArray(joinClaim.data)?joinClaim.data[0]:null) as JoinApprovalNotice|null;
  let mode:'legacy'|'change'|'join'=row?'join':'legacy';
  if(!row){
   const changeClaim=await db.rpc('claim_pyramid_change_notification');
   if(changeClaim.error){console.error('pyramid_change_notice_claim_failed');return reply(503,{error:'Queue unavailable',sent,failed})}
   row=(Array.isArray(changeClaim.data)?changeClaim.data[0]:null) as ChangeNotice|null;
   if(row)mode='change';
  }
  if(!row){
   const legacy=await db.rpc('claim_pyramid_notification');
   if(legacy.error){console.error('pyramid_notice_claim_failed');return reply(503,{error:'Queue unavailable',sent,failed})}
   row=(Array.isArray(legacy.data)?legacy.data[0]:null) as Notice|null;
  }
  if(!row)break;
  // result_reported is now covered for BOTH participants by the change queue.
  // Acknowledge the former one-recipient notice without sending a duplicate.
  if(mode==='legacy'&&(row as Notice).kind==='result_reported'){
   await db.rpc('complete_pyramid_auto_decline_notice',{p_id:row.id,p_sent:true,p_error:null});
   continue;
  }
  const valid=!!row.recipient_email&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(row.recipient_email);
  const outcome=valid?await sendGmail(row,mode):{ok:false,code:'recipient_email_missing'};
  const completeRpc=mode==='join'?'complete_pyramid_join_approval_notification'
    :mode==='change'?'complete_pyramid_change_notification':'complete_pyramid_auto_decline_notice';
  const ack=await db.rpc(completeRpc,{
   p_id:row.id,p_sent:outcome.ok,p_error:outcome.ok?null:outcome.code
  });
  if(ack.error)console.error('pyramid_notice_ack_failed');
  if(outcome.ok)sent++;else{failed++;console.warn('pyramid_notice_delivery_failed',outcome.code);}
 }
 return reply(200,{sent,failed});
});
