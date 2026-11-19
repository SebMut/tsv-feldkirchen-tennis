import { createClient } from 'npm:@supabase/supabase-js@2.75.0';

// Public Edge endpoint: no user login is required; all writes go through
// verified Cloudflare Turnstile and a single-use e-mail confirmation token.
// Never expose Gmail OAuth credentials, TURNSTILE_SECRET_KEY or service_role to browser.
// Only the account granted Gmail API gmail.send may send confirmation emails.
const env = (key: string) => Deno.env.get(key)?.trim() || '';
const GMAIL_SENDER = 'tsvfeldkirchen.tennis@gmail.com';
const TEMPORARILY_UNAVAILABLE = 'Die Online-Anmeldung ist gerade kurzzeitig nicht verfügbar. Wir kümmern uns darum und sind bald wieder für dich da. Bitte versuche es später noch einmal.';
// Require an exact base URL: a stray word or slash must never enter
// a confirmation link that is already delivered by email.
const allowedRsvpBases = new Set([
  'https://sebmut.github.io/tsv-feldkirchen-tennis/',
  'https://www.tennis-tsvfeldkirchen.de/',
  'https://tennis-tsvfeldkirchen.de/',
]);
// Accept the existing exact allowlisted RSVP_BASE_URL secret values, but
// ALWAYS use the verified live domain for links in newly sent emails.
// This safely handles an old GitHub Pages secret until it is updated.
const PRODUCTION_RSVP_BASE = 'https://www.tennis-tsvfeldkirchen.de/';
function validatedRsvpBase(): URL | null {
  try {
    const base=new URL(env('RSVP_BASE_URL'));
    return base.protocol==='https:' && allowedRsvpBases.has(base.href)
      ? new URL(PRODUCTION_RSVP_BASE) : null;
  } catch {
    return null;
  }
}
const allowedOrigins = new Set([
  'https://sebmut.github.io',
  'https://www.tennis-tsvfeldkirchen.de',
  'https://tennis-tsvfeldkirchen.de',
]);
const categories = new Set(['u10-mixed','u12-m','u15-m','u18-m','u18-w']);

function headers(origin: string | null) {
  return {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'vary':'Origin',
    ...(origin && allowedOrigins.has(origin) ? {'access-control-allow-origin':origin} : {}),
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
  };
}
function reply(status:number, data:unknown, origin:string|null) {
  return new Response(JSON.stringify(data),{status,headers:headers(origin)});
}
function escapeHtml(input:unknown) {
  return String(input ?? '').replace(/[&<>"']/g, char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[char]||char);
}
async function sha256(s:string):Promise<string> {
  const bytes=new TextEncoder().encode(s);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
    .map(x=>x.toString(16).padStart(2,'0')).join('');
}
function uuid(input:unknown) {return typeof input==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);}
function validEmail(value:unknown) {
  return typeof value==='string' && value.length<=254
    && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(value);
}
function validate(input:Record<string,unknown>) {
  const name=String(input.name||'').trim();
  const email=String(input.email||'').trim().toLowerCase();
  const attendance=input.attendance;
  const adults=Number(input.adults),children=Number(input.children);
  const dessert=String(input.dessert||'').trim(), salad=String(input.salad||'').trim();
  const youth=input.youth;
  const women=input.women ?? [], men=input.men ?? [];
  const validAdults=(names:unknown):names is string[] => Array.isArray(names) && names.length<=12
    && names.every(n=>typeof n==='string'&&n.trim().length>=2&&n.trim().length<=100);
  if (!uuid(input.event_id) || name.length<2||name.length>100||!validEmail(email)
    || !['yes','maybe','no'].includes(String(attendance))
    || !Number.isInteger(adults)||!Number.isInteger(children)
    || adults<0||children<0||adults>20||children>20||adults+children>20
    || (attendance==='yes' && adults+children<1)
    || (attendance!=='yes' && adults+children!==0)
    || dessert.length>180||salad.length>180
    || !validAdults(women)||!validAdults(men)
    || !Array.isArray(youth)||youth.length>12
    || !youth.every(x=>x && typeof x==='object'
      && typeof x.name==='string' && x.name.trim().length>=2 && x.name.trim().length<=100
      && categories.has(x.category))) return null;
  return { name,email,attendance,adults,children,dessert,salad,
    help_setup:input.help_setup===true,help_cleanup:input.help_cleanup===true,
    youth:youth.map(x=>({name:x.name.trim(),category:x.category})),
    women:women.map(name=>name.trim()),men:men.map(name=>name.trim()) };
}
function describe(p:ReturnType<typeof validate>,event:{title:string;starts_at:string;location_name:string|null}) {
  if (!p) return [];
  const c:Record<string,string>={'u10-mixed':'U10 gemischt','u12-m':'U12 männlich','u15-m':'U15 männlich','u18-m':'U18 männlich','u18-w':'U18 weiblich'};
  const date=new Intl.DateTimeFormat('de-DE',{dateStyle:'full',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(event.starts_at));
  return [
    ['Veranstaltung',event.title],['Termin',date],['Ort',event.location_name||'Wird bekannt gegeben'],
    ['Name',p.name],['E-Mail',p.email],
    ['Teilnahme',p.attendance==='yes'?'Ja, dabei':p.attendance==='maybe'?'Vielleicht':'Nein'],
    ['Erwachsene',String(p.adults)],['Kinder/Jugendliche',String(p.children)],
    ['Kuchen/Nachspeise',p.dessert||'–'],['Salat/Vorspeise',p.salad||'–'],
    ['Hilfe Aufbau',p.help_setup?'Ja':'Nein'],['Hilfe Abbau',p.help_cleanup?'Ja':'Nein'],
    ['Jugendmeisterschaften',p.youth.length?p.youth.map(x=>x.name+' ('+c[x.category]+')').join(', '):'Keine Meldung'],
    ['Damenmeisterschaft',p.women.length?p.women.join(', '):'Keine Meldung'],
    ['Herrenmeisterschaft',p.men.length?p.men.join(', '):'Keine Meldung'],
  ] as [string,string][];
}

/**
 * Gmail API accepts RFC 5322 MIME encoded as base64url. Both plain text and
 * HTML must be UTF-8 safe; authentication is restricted to gmail.send.
 */
function base64Utf8(value:string):string {
  const bytes=new TextEncoder().encode(value);
  let binary='';
  for(let i=0;i<bytes.length;i+=8192){
    binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  }
  return btoa(binary);
}
function wrapBase64(value:string):string {
  return base64Utf8(value).match(/.{1,76}/g)?.join('\r\n') || '';
}
function mimeMessage(to:string,plain:string,html:string,subject='TSV Feldkirchen: Anmeldung bitte bestaetigen'):string {
  const boundary='tsv-rsvp-'+crypto.randomUUID().replaceAll('-','');
  const lines=[
    'From: TSV Feldkirchen Tennis <'+GMAIL_SENDER+'>',
    'To: <'+to+'>',
    'Subject: '+subject.replace(/[\r\n]/g,''),
    'Date: '+new Date().toUTCString(),
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="'+boundary+'"',
    '',
    '--'+boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(plain),
    '--'+boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(html),
    '--'+boundary+'--','',
  ];
  return base64Utf8(lines.join('\r\n')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
type GmailDelivery = { sent:true } | { sent:false; code:string; message:string };
let gmailHealthCache:{expires:number;result:GmailDelivery}|null=null;
/** Validate the stored refresh token without sending an e-mail. The short cache
 * avoids hitting Google's token endpoint on every public form page load. */
async function gmailOauthHealth():Promise<GmailDelivery> {
  if(gmailHealthCache&&gmailHealthCache.expires>Date.now()) return gmailHealthCache.result;
  const oauth=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      client_id:env('GMAIL_CLIENT_ID'),
      client_secret:env('GMAIL_CLIENT_SECRET'),
      refresh_token:env('GMAIL_REFRESH_TOKEN'),
      grant_type:'refresh_token',
    }),
  }).catch(()=>null);
  let result:GmailDelivery;
  if(!oauth) result={sent:false,code:'gmail_auth_unreachable',message:'Google OAuth ist vorübergehend nicht erreichbar. Bitte später erneut versuchen.'};
  else {
    const auth=await oauth.json().catch(()=>null);
    if(oauth.ok&&typeof auth?.access_token==='string'&&auth.access_token) result={sent:true};
    else {
      const reason=typeof auth?.error==='string'?auth.error:'unknown';
      console.warn('rsvp_gmail_health_failure',JSON.stringify({http:oauth.status,code:reason}));
      result=reason==='invalid_grant'
        ? {sent:false,code:'gmail_invalid_grant',message:TEMPORARILY_UNAVAILABLE}
        : reason==='invalid_client'
          ? {sent:false,code:'gmail_invalid_client',message:TEMPORARILY_UNAVAILABLE}
          : {sent:false,code:'gmail_auth_failed',message:TEMPORARILY_UNAVAILABLE};
    }
  }
  gmailHealthCache={expires:Date.now()+(result.sent?5*60_000:30_000),result};
  return result;
}
/** Report safe provider error codes, never OAuth secrets, tokens or user addresses. */
async function sendGmail(to:string,plain:string,html:string,subject?:string):Promise<GmailDelivery> {
  const oauth=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      client_id:env('GMAIL_CLIENT_ID'),
      client_secret:env('GMAIL_CLIENT_SECRET'),
      refresh_token:env('GMAIL_REFRESH_TOKEN'),
      grant_type:'refresh_token',
    }),
  }).catch(()=>null);
  if(!oauth) {
    console.warn('rsvp_gmail_auth_network_failure');
    return {sent:false,code:'gmail_auth_unreachable',message:'Google OAuth ist vorübergehend nicht erreichbar. Bitte später erneut versuchen.'};
  }
  const auth=await oauth.json().catch(()=>null);
  if(!oauth.ok) {
    const reason=typeof auth?.error==='string' ? auth.error : 'unknown';
    // Do not log provider descriptions: they could contain account information.
    console.warn('rsvp_gmail_auth_failure',JSON.stringify({http:oauth.status,code:reason}));
    switch(reason) {
      case 'invalid_client':
        return {sent:false,code:'gmail_invalid_client',message:TEMPORARILY_UNAVAILABLE};
      case 'invalid_grant':
        return {sent:false,code:'gmail_invalid_grant',message:TEMPORARILY_UNAVAILABLE};
      case 'unauthorized_client':
        return {sent:false,code:'gmail_unauthorized_client',message:TEMPORARILY_UNAVAILABLE};
      default:
        return {sent:false,code:'gmail_auth_failed',message:TEMPORARILY_UNAVAILABLE};
    }
  }
  if(typeof auth?.access_token!=='string'||!auth.access_token){
    console.warn('rsvp_gmail_missing_access_token');
    return {sent:false,code:'gmail_no_access_token',message:'Google hat keinen Zugriffstoken zurückgegeben. Bitte die Gmail-OAuth-Freigabe prüfen.'};
  }
  const sent=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
    method:'POST',
    headers:{authorization:'Bearer '+auth.access_token,'content-type':'application/json'},
    body:JSON.stringify({raw:mimeMessage(to,plain,html,subject)}),
  }).catch(()=>null);
  if(!sent) {
    console.warn('rsvp_gmail_send_network_failure');
    return {sent:false,code:'gmail_send_unreachable',message:'Gmail ist vorübergehend nicht erreichbar. Bitte später erneut versuchen.'};
  }
  if(!sent.ok) {
    const errorBody=await sent.json().catch(()=>null);
    const reason=String(errorBody?.error?.errors?.[0]?.reason || errorBody?.error?.status || 'unknown');
    console.warn('rsvp_gmail_send_failure',JSON.stringify({http:sent.status,code:reason.slice(0,90)}));
    if(sent.status===403 && /accessNotConfigured|SERVICE_DISABLED|SERVICE_BLOCKED|API_KEY_SERVICE_BLOCKED/i.test(reason))
      return {sent:false,code:'gmail_api_disabled',message:'Die Gmail API ist im Google-Cloud-Projekt noch nicht aktiviert oder freigegeben.'};
    if(sent.status===403 && /insufficientPermissions|PERMISSION_DENIED|forbidden/i.test(reason))
      return {sent:false,code:'gmail_insufficient_permission',message:'Dem Gmail-Zugriff fehlt die Berechtigung gmail.send. Bitte Gmail-Scope und Google-Freigabe kontrollieren.'};
    if(sent.status===429 || /rateLimitExceeded|userRateLimitExceeded|quotaExceeded/i.test(reason))
      return {sent:false,code:'gmail_rate_limit',message:'Google hat das Versandlimit erreicht. Bitte später erneut versuchen.'};
    if(sent.status===401)
      return {sent:false,code:'gmail_send_unauthorized',message:'Gmail hat den Zugriffstoken abgelehnt. Bitte Gmail-OAuth-Freigabe erneuern.'};
    return {sent:false,code:'gmail_send_rejected',message:'Gmail hat die Nachricht abgelehnt. Bitte Gmail API und Berechtigungen im Google-Cloud-Projekt prüfen.'};
  }
  return {sent:true};
}


/* Existing Gmail sender is also used for audited, admin-initiated RSVP notices.
 * Never put service-role credentials, verified addresses, or OAuth tokens in logs. */
type AdminRsvpChange = {
  member_name:string;attendance:'yes'|'no'|'maybe';adults_count:number;children_count:number;
  dessert_contribution:string;salad_contribution:string;help_setup:boolean;help_cleanup:boolean;
  youth_registrations:{name:string;category:string}[];women_registrations:string[];men_registrations:string[];
};
function adminRsvpInput(value:unknown):AdminRsvpChange|null {
  if (!value||typeof value!=='object'||Array.isArray(value)) return null;
  const v=value as Record<string,unknown>;
  const member_name=String(v.member_name??'').trim();
  const attendance=v.attendance;
  const adults_count=Number(v.adults_count),children_count=Number(v.children_count);
  const dessert_contribution=String(v.dessert_contribution??'').trim();
  const salad_contribution=String(v.salad_contribution??'').trim();
  const youth_registrations=v.youth_registrations;
  const women_registrations=v.women_registrations, men_registrations=v.men_registrations;
  const validNames=(xs:unknown):xs is string[]=>Array.isArray(xs)&&xs.length<=12
    &&xs.every(x=>typeof x==='string'&&x.trim().length>=2&&x.trim().length<=100);
  if(member_name.length<2||member_name.length>100||!['yes','no','maybe'].includes(String(attendance))
    ||!Number.isInteger(adults_count)||!Number.isInteger(children_count)
    ||adults_count<0||children_count<0||adults_count+children_count>20
    ||(attendance==='yes'&&adults_count+children_count<1)
    ||(attendance!=='yes'&&adults_count+children_count!==0)
    ||dessert_contribution.length>180||salad_contribution.length>180
    ||typeof v.help_setup!=='boolean'||typeof v.help_cleanup!=='boolean'
    ||!validNames(women_registrations)||!validNames(men_registrations)
    ||!Array.isArray(youth_registrations)||youth_registrations.length>12
    ||!youth_registrations.every(item=>item&&typeof item==='object'
      &&typeof item.name==='string'&&item.name.trim().length>=2&&item.name.trim().length<=100
      &&categories.has(item.category))
    ||(attendance!=='yes'&&(dessert_contribution||salad_contribution
      ||v.help_setup||v.help_cleanup||youth_registrations.length
      ||women_registrations.length||men_registrations.length))) return null;
  return {
    member_name,attendance:attendance as AdminRsvpChange['attendance'],
    adults_count,children_count,dessert_contribution,salad_contribution,
    help_setup:v.help_setup,help_cleanup:v.help_cleanup,
    youth_registrations:youth_registrations.map(item=>({name:item.name.trim(),category:item.category})),
    women_registrations:women_registrations.map(x=>x.trim()),
    men_registrations:men_registrations.map(x=>x.trim()),
  };
}
function adminNoticeValues(raw:Record<string,unknown>|null):[string,string][] {
  if(!raw)return [];
  const attendance=raw.attendance==='yes'?'Ja':raw.attendance==='maybe'?'Vielleicht':'Nein';
  const youth=Array.isArray(raw.youth_registrations)
    ? raw.youth_registrations.map((x:{name?:string;category?:string})=>String(x.name||'')+' ('+String(x.category||'')+')').join(', ') : '';
  const names=(x:unknown)=>Array.isArray(x)?x.join(', '):'';
  return [
    ['Name',String(raw.member_name||'')],
    ['Teilnahme',attendance],
    ['Erwachsene',String(raw.adults_count??0)],
    ['Kinder/Jugendliche',String(raw.children_count??0)],
    ['Kuchen/Nachspeise',String(raw.dessert_contribution||'–')],
    ['Salat/Vorspeise',String(raw.salad_contribution||'–')],
    ['Hilfe beim Aufbau',raw.help_setup?'Ja':'Nein'],
    ['Hilfe beim Abbau',raw.help_cleanup?'Ja':'Nein'],
    ['Jugendmeisterschaft',youth||'–'],
    ['Damenmeisterschaft',names(raw.women_registrations)||'–'],
    ['Herrenmeisterschaft',names(raw.men_registrations)||'–'],
  ];
}
async function sendAdminRsvpNotice(db:ReturnType<typeof createClient>,id:string)
  :Promise<{sent:boolean;code?:string}> {
  // Claim a pending/failed entry to avoid duplicate sends on repeated clicks.
  const {data:notice,error:claimError}=await db.from('event_rsvp_admin_notifications')
    .update({mail_status:'sending',updated_at:new Date().toISOString(),last_error:null})
    .eq('id',id).in('mail_status',['pending','failed'])
    .select('id,event_id,recipient_email,action,before_data,after_data').maybeSingle();
  if(claimError||!notice)return {sent:false,code:'notice_not_retryable'};
  const {data:event,error:eventError}=await db.from('events')
    .select('title,starts_at').eq('id',notice.event_id).single();
  if(eventError||!event) {
    await db.from('event_rsvp_admin_notifications').update({mail_status:'failed',last_error:'event_not_found'})
      .eq('id',id);
    return {sent:false,code:'event_not_found'};
  }
  const deleted=notice.action==='delete';
  const before=adminNoticeValues(notice.before_data);
  const after=adminNoticeValues(notice.after_data);
  const changes=deleted?before:after.filter(([label,value])=>before.find(row=>row[0]===label)?.[1]!==value);
  const when=new Intl.DateTimeFormat('de-DE',{dateStyle:'full',timeStyle:'short',timeZone:'Europe/Berlin'})
    .format(new Date(event.starts_at));
  const intro=deleted
    ? 'Deine Anmeldung wurde durch die Vereinsverwaltung gelöscht.'
    : 'Deine Anmeldung wurde durch die Vereinsverwaltung aktualisiert.';
  const heading=deleted?'Anmeldung gelöscht':'Anmeldung aktualisiert';
  const plain='TSV Feldkirchen Tennis\n'+heading+'\n\n'+intro+'\n\nVeranstaltung: '+event.title
    +'\nTermin: '+when+'\n\n'+changes.map(([label,value])=>label+': '+value).join('\n')
    +'\n\nBei Fragen antworte bitte auf diese E-Mail.\nTSV Feldkirchen Tennis';
  const lines=changes.map(([label,value])=>'<tr><th style="padding:9px;text-align:left;border-bottom:1px solid #e4eae5;color:#36513e">'
    +escapeHtml(label)+'</th><td style="padding:9px;border-bottom:1px solid #e4eae5">'
    +escapeHtml(value)+'</td></tr>').join('');
  const html='<div style="background:#f3f6f3;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#173e2b">'
    +'<div style="max-width:620px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #dbe5dc">'
    +'<div style="background:#af1526;color:white;padding:20px 26px;font-weight:700;letter-spacing:.04em">'
    +'TSV FELDKIRCHEN <span style="font-weight:400">TENNIS</span></div>'
    +'<div style="padding:26px"><h1 style="font-size:25px;color:#173e2b;margin:0 0 16px">'
    +heading+'</h1><p style="line-height:1.6">'+intro+'</p>'
    +'<p style="line-height:1.6"><b>Veranstaltung:</b> '+escapeHtml(event.title)
    +'<br><b>Termin:</b> '+escapeHtml(when)+'</p>'
    +(changes.length?'<table style="width:100%;border-collapse:collapse;font-size:14px">'+lines+'</table>':'')
    +'<p style="font-size:14px;line-height:1.6;margin-top:24px">Bei Fragen kannst du auf diese E-Mail antworten.</p>'
    +'</div><div style="border-top:4px solid #af1526;padding:16px 26px;font-size:12px;color:#587061">'
    +'TSV Feldkirchen Tennis · Vereinsverwaltung</div></div></div>';
  const delivery=await sendGmail(notice.recipient_email,plain,html,
    deleted?'TSV Feldkirchen: Anmeldung geloescht':'TSV Feldkirchen: Anmeldung aktualisiert');
  const update=delivery.sent
    ?{mail_status:'sent',sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}
    :{mail_status:'failed',last_error:delivery.code||'send_failed',updated_at:new Date().toISOString()};
  const {error:saveError}=await db.from('event_rsvp_admin_notifications').update(update).eq('id',id);
  if(saveError)return {sent:false,code:'mail_status_not_saved'};
  return delivery.sent?{sent:true}:{sent:false,code:delivery.code};
}
async function adminRsvpAction(
  request:Request,body:Record<string,unknown>,db:ReturnType<typeof createClient>
):Promise<{status:number;data:Record<string,unknown>}> {
  const authorization=request.headers.get('authorization')||'';
  const match=/^Bearer\s+(\S+)$/i.exec(authorization);
  if(!match)return {status:401,data:{error:'Bitte erneut im Adminbereich anmelden.'}};
  const {data:identity,error:authError}=await db.auth.getUser(match[1]);
  if(authError||!identity?.user)return {status:401,data:{error:'Anmeldung abgelaufen. Bitte erneut anmelden.'}};
  // Server side role enforcement. Client-side "data-events-only" is only UX.
  const {data:profile,error:profileError}=await db.from('profiles')
    .select('global_role,global_permissions').eq('id',identity.user.id).single();
  if(profileError||!profile||(profile.global_role!=='super_admin'
      &&!profile.global_permissions?.includes('events')))
    return {status:403,data:{error:'Keine Berechtigung zum Verwalten von Veranstaltungsanmeldungen.'}};
  const action=String(body.action||'');
  if(action==='admin-rsvp-retry'){
    if(!uuid(body.notification_id))return {status:400,data:{error:'Ungültige Benachrichtigung.'}};
    const result=await sendAdminRsvpNotice(db,body.notification_id as string);
    return {status:200,data:{notification_sent:result.sent,notification_id:body.notification_id,
      message:result.sent?'Benachrichtigung per E-Mail versendet.':'Die E-Mail konnte nicht versendet werden. Du kannst es erneut versuchen.'}};
  }
  if(!uuid(body.rsvp_id)||typeof body.expected_updated_at!=='string'
    ||!Number.isFinite(Date.parse(body.expected_updated_at))
    ||!['admin-rsvp-update','admin-rsvp-delete'].includes(action))
    return {status:400,data:{error:'Ungültige Bearbeitungsanfrage.'}};
  const values=action==='admin-rsvp-update'?adminRsvpInput(body.values):null;
  if(action==='admin-rsvp-update'&&!values)
    return {status:400,data:{error:'Bitte Namen, Teilnahme, Personenzahl und Zusatzangaben prüfen.'}};
  const {data:changed,error:mutationError}=await db.rpc('admin_change_event_rsvp',{
    p_rsvp_id:body.rsvp_id,
    p_expected_updated_at:body.expected_updated_at,
    p_action:action==='admin-rsvp-delete'?'delete':'update',
    p_values:values||{},
    p_editor_user_id:identity.user.id,
  });
  if(mutationError){
    const reason=String(mutationError.message||'');
    return reason.includes('RSVP_CONFLICT')
      ? {status:409,data:{error:'Die Anmeldung wurde inzwischen verändert. Bitte aktualisieren und erneut bearbeiten.'}}
      : reason.includes('RSVP_NOT_FOUND')
        ? {status:404,data:{error:'Diese bestätigte Anmeldung ist nicht mehr vorhanden.'}}
        : {status:400,data:{error:'Die Änderung konnte nicht gespeichert werden. Bitte Angaben prüfen oder erneut versuchen.'}};
  }
  if(changed?.unchanged)return {status:200,data:{unchanged:true,message:'Keine Änderungen vorhanden.'}};
  if(!uuid(changed?.notification_id))
    return {status:503,data:{error:'Änderung nicht bestätigt. Bitte die Teilnehmerliste neu laden.'}};
  const notice=await sendAdminRsvpNotice(db,changed.notification_id);
  return {status:200,data:{
    saved:true,notification_id:changed.notification_id,notification_sent:notice.sent,
    message:notice.sent
      ? 'Anmeldung aktualisiert und Benachrichtigung per E-Mail versendet.'
      : 'Anmeldung gespeichert, aber die E-Mail konnte nicht versendet werden. Bitte erneut senden.',
  }};
}

Deno.serve(async request=>{
  const origin=request.headers.get('origin');
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers:headers(origin)});
  if (request.method!=='POST') return reply(405,{error:'Nur POST erlaubt'},origin);
  if (origin && !allowedOrigins.has(origin)) return reply(403,{error:'Unzulässige Herkunft'},origin);
  const raw=await request.text();
  if (raw.length>16000) return reply(413,{error:'Anfrage zu groß'},origin);
  let body:Record<string,unknown>;
  try {body=JSON.parse(raw);} catch {return reply(400,{error:'Ungültige Anfrage'},origin);}
  const action=body.action;
  const base=validatedRsvpBase();
  const configured=!!(env('TURNSTILE_SITE_KEY')&&env('TURNSTILE_SECRET_KEY')
    &&env('GMAIL_CLIENT_ID')&&env('GMAIL_CLIENT_SECRET')&&env('GMAIL_REFRESH_TOKEN')
    &&base&&env('SUPABASE_URL')&&env('SUPABASE_SERVICE_ROLE_KEY'));
  if(action==='config') {
    if(configured) {
      const gmail=await gmailOauthHealth();
      return reply(200,gmail.sent?{
        enabled:true,siteKey:env('TURNSTILE_SITE_KEY'),sender:GMAIL_SENDER,
      }:{enabled:false,code:gmail.code,message:gmail.message},origin);
    }
    return reply(200,{enabled:false,message:!base
      ? 'Die Supabase-Einstellung RSVP_BASE_URL ist ungültig. Bitte die vollständige Live-Domain inklusive https:// und abschließendem Schrägstrich eintragen.'
      : 'Gmail-Zugriff und Cloudflare-Menschprüfung müssen vor der Anmeldung noch vom Verein freigegeben werden.'},origin);
  }
  if (!configured) return reply(503,{error:'Anmeldung derzeit nicht verfügbar. E-Mail-Versand und Cloudflare Turnstile sind noch nicht eingerichtet.'},origin);
  const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{
    auth:{autoRefreshToken:false,persistSession:false},
  });
  if(typeof action==='string'&&action.startsWith('admin-rsvp-')) {
    const result=await adminRsvpAction(request,body,db);
    return reply(result.status,result.data,origin);
  }
  if(action==='confirm'){
    if(!uuid(body.request_id)||typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))
      return reply(400,{error:'Der Bestätigungslink ist ungültig.'},origin);
    const hash=await sha256(body.token);
    const {data,error}=await db.rpc('confirm_event_rsvp_email',{
      p_request_id:body.request_id,p_token_hash:hash,
    });
    if(error) return reply(500,{error:'Bestätigung fehlgeschlagen. Bitte den Verein kontaktieren.'},origin);
    return data===true?reply(200,{confirmed:true},origin)
      :reply(410,{error:'Der Link ist abgelaufen, wurde bereits genutzt oder die Anmeldefrist ist geschlossen.'},origin);
  }
  if(action!=='submit') return reply(400,{error:'Unbekannte Aktion'},origin);
  const token=body.turnstileToken;
  if(typeof token!=='string'||token.length<8||token.length>2048)
    return reply(400,{error:'Bitte zuerst die Cloudflare-Menschprüfung abschließen.'},origin);

  // Verify on the server every time. Turnstile tokens are single-use, expiring after 5 min.
  const check=new URLSearchParams({secret:env('TURNSTILE_SECRET_KEY'),response:token});
  const cf=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:check,
  }).catch(()=>null);
  if(!cf?.ok) return reply(503,{error:'Menschprüfung vorübergehend nicht erreichbar.'},origin);
  const verdict=await cf.json();
  const allowedHost=new Set(['sebmut.github.io','www.tennis-tsvfeldkirchen.de','tennis-tsvfeldkirchen.de']);
  if(!verdict.success || !allowedHost.has(verdict.hostname))
    return reply(403,{error:'Menschprüfung nicht erfolgreich. Bitte erneut versuchen.'},origin);

  const p=validate(body);
  if(!p) return reply(400,{error:'Bitte die Angaben einschließlich E-Mail-Adresse prüfen.'},origin);
  const {data:event,error:eventError}=await db.from('events')
    .select('id,title,starts_at,location_name,rsvp_enabled,rsvp_deadline,rsvp_details')
    .eq('id',body.event_id).eq('status','published').eq('rsvp_enabled',true).maybeSingle();
  if(eventError||!event) return reply(404,{error:'Die Veranstaltung ist nicht für Anmeldungen geöffnet.'},origin);
  if(new Date(event.starts_at).getTime()<=Date.now()
    || (event.rsvp_deadline&&new Date(event.rsvp_deadline).getTime()<Date.now()))
    return reply(409,{error:'Die Anmeldefrist ist abgelaufen.'},origin);

  const offers=event.rsvp_details || {};
  if ((offers.show_contributions===false && (p.dessert || p.salad))
    || (offers.show_help===false && (p.help_setup || p.help_cleanup)))
    return reply(409,{error:'Eine ausgeblendete Anmeldeoption kann für diese Veranstaltung nicht verwendet werden.'},origin);
  if ((offers.tournament_youth_enabled===false && p.youth.length>0)
    || (offers.tournament_women_enabled!==true && p.women.length>0)
    || (offers.tournament_men_enabled!==true && p.men.length>0))
    return reply(409,{error:'Eine ausgewählte Vereinsmeisterschaft ist für diese Veranstaltung nicht freigeschaltet.'},origin);

  // Check after server-verified Turnstile. Never allow a second email to
  // replace an already CONFIRMED response, even if a client sends forged data.
  const existing=await db.from('event_rsvps').select('id')
    .eq('event_id',event.id).eq('member_email',p.email)
    .not('verified_at','is',null).limit(1);
  if(existing.error) return reply(503,{error:'Die Rückmeldung konnte nicht auf doppelte Einträge geprüft werden.'},origin);
  if((existing.data?.length||0)>0)
    return reply(409,{error:'Für diese E-Mail-Adresse wurde bereits eine Rückmeldung bestätigt. Eine zweite Rückmeldung ist nicht möglich. Bitte eine andere E-Mail-Adresse verwenden oder den Verein kontaktieren.',code:'rsvp_duplicate_email'},origin);

  const ip=request.headers.get('cf-connecting-ip')
    ||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const fingerprint=await sha256(ip+'|'+env('TURNSTILE_SECRET_KEY'));
  const hour=new Date(Date.now()-60*60*1000).toISOString();
  const [sameEmail,sameIp]=await Promise.all([
    db.from('event_rsvp_pending').select('id',{count:'exact',head:true})
      .eq('member_email',p.email).gte('created_at',hour),
    db.from('event_rsvp_pending').select('id',{count:'exact',head:true})
      .eq('request_fingerprint',fingerprint).gte('created_at',hour),
  ]);
  if(sameEmail.error||sameIp.error) return reply(503,{error:'Die Anmeldung konnte nicht geprüft werden.'},origin);
  if((sameEmail.count||0)>=3||(sameIp.count||0)>=10)
    return reply(429,{error:'Zu viele Anfragen. Bitte später erneut versuchen.'},origin);

  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const secret=Array.from(bytes).map(n=>n.toString(16).padStart(2,'0')).join('');
  const hash=await sha256(secret);
  const {data:pending,error:pendingError}=await db.from('event_rsvp_pending')
    .insert({event_id:event.id,member_email:p.email,token_hash:hash,
      request_fingerprint:fingerprint,payload:p})
    .select('id').single();
  if(pendingError||!pending) return reply(503,{error:'Rückmeldung konnte nicht vorbereitet werden.'},origin);

  // The configuration is checked before any signup can start.
  // An exact allowlisted path also prevents accidental /%20Wert/ in emails.
  if(!base) {
    await db.from('event_rsvp_pending').delete().eq('id',pending.id);
    return reply(503,{error:'Die Basis-URL der Bestätigungsseite ist ungültig.'},origin);
  }
  const confirmation=new URL('veranstaltung/bestaetigen/',base);
  confirmation.searchParams.set('request',pending.id);
  confirmation.searchParams.set('token',secret);
  const rows=describe(p,event);
  const rowsHtml=rows.map(([k,v])=>'<tr><th style="text-align:left;padding:7px;border-bottom:1px solid #eee">'+escapeHtml(k)+'</th><td style="padding:7px;border-bottom:1px solid #eee">'+escapeHtml(v)+'</td></tr>').join('');
  const link=confirmation.toString();
  const html='<div style="font:16px/1.55 Arial,sans-serif;max-width:620px;margin:auto;color:#1c3024">'
    +'<h1>Rückmeldung bestätigen – TSV Feldkirchen Tennis</h1>'
    +'<p>Bitte prüfe deine Angaben. <strong>Die Rückmeldung zählt erst nach deiner Bestätigung.</strong></p>'
    +'<table style="border-collapse:collapse;width:100%">'+rowsHtml+'</table>'
    +'<p><a href="'+escapeHtml(link)+'" style="display:inline-block;background:#b51224;color:white;padding:13px 18px;text-decoration:none;border-radius:9px">Angaben bestätigen</a></p>'
    +'<p>Der Link ist 24 Stunden gültig und kann nur einmal verwendet werden. Wenn du die Anmeldung nicht selbst angefordert hast, ignoriere diese E-Mail.</p>'
    +'</div>';
  const textContent='Bitte prüfe deine Angaben:\n\n'
    +rows.map(([k,v])=>k+': '+v).join('\n')
    +'\n\nErst nach deiner Bestätigung zählt die Rückmeldung.\nBestätigen: '+link
    +'\n\nDer Link ist 24 Stunden gültig. Falls du das nicht angefordert hast, ignoriere diese Nachricht.';
  // E-Mail geht tatsächlich vom verknüpften Vereins-Gmail-Konto aus.
  // Die Adresse gehört nicht einem externen Domain-Sender wie Resend.
  const delivery=await sendGmail(p.email,textContent,html);
  if(!delivery.sent){
    await db.from('event_rsvp_pending').delete().eq('id',pending.id);
    return reply(503,{error:delivery.message,code:delivery.code},origin);
  }
  return reply(200,{pending:true,message:'Bitte öffne die E-Mail und bestätige deine Rückmeldung über den Link. Erst dann zählt deine Antwort.'},origin);
});
