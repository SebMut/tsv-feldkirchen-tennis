import { createClient } from 'npm:@supabase/supabase-js@2.75.0';

// Public Edge endpoint: no user login is required; all writes go through
// verified Cloudflare Turnstile and a single-use e-mail confirmation token.
// Never expose Gmail OAuth credentials, TURNSTILE_SECRET_KEY or service_role to browser.
// Only the account granted Gmail API gmail.send may send confirmation emails.
const env = (key: string) => Deno.env.get(key)?.trim() || '';
const GMAIL_SENDER = 'tsvfeldkirchen.tennis@gmail.com';
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
  if (!uuid(input.event_id) || name.length<2||name.length>100||!validEmail(email)
    || !['yes','maybe','no'].includes(String(attendance))
    || !Number.isInteger(adults)||!Number.isInteger(children)
    || adults<0||children<0||adults>20||children>20||adults+children>20
    || (attendance==='yes' && adults+children<1)
    || (attendance!=='yes' && adults+children!==0)
    || dessert.length>180||salad.length>180
    || !Array.isArray(youth)||youth.length>12
    || !youth.every(x=>x && typeof x==='object'
      && typeof x.name==='string' && x.name.trim().length>=2 && x.name.trim().length<=100
      && categories.has(x.category))) return null;
  return { name,email,attendance,adults,children,dessert,salad,
    help_setup:input.help_setup===true,help_cleanup:input.help_cleanup===true,
    youth:youth.map(x=>({name:x.name.trim(),category:x.category})) };
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
function mimeMessage(to:string,plain:string,html:string):string {
  const boundary='tsv-rsvp-'+crypto.randomUUID().replaceAll('-','');
  const lines=[
    'From: TSV Feldkirchen Tennis <'+GMAIL_SENDER+'>',
    'To: <'+to+'>',
    'Subject: TSV Feldkirchen: Anmeldung bitte bestaetigen',
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
/** Report safe provider error codes, never OAuth secrets, tokens or user addresses. */
async function sendGmail(to:string,plain:string,html:string):Promise<GmailDelivery> {
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
        return {sent:false,code:'gmail_invalid_client',message:'Gmail-Anmeldung abgelehnt: OAuth Client ID und Client Secret passen nicht zusammen. Bitte die beiden Supabase-Secrets prüfen.'};
      case 'invalid_grant':
        return {sent:false,code:'gmail_invalid_grant',message:'Gmail-Zugriff abgelaufen oder widerrufen. Bitte den Google Refresh Token erneuern und den OAuth-Veröffentlichungsstatus prüfen.'};
      case 'unauthorized_client':
        return {sent:false,code:'gmail_unauthorized_client',message:'Google erlaubt diesem OAuth-Client den Zugriff noch nicht. Bitte OAuth-Client und Gmail-Berechtigung prüfen.'};
      default:
        return {sent:false,code:'gmail_auth_failed',message:'Google hat den Gmail-Zugriff abgelehnt (OAuth-Fehler). Bitte die Google-Cloud-Einstellungen prüfen.'};
    }
  }
  if(typeof auth?.access_token!=='string'||!auth.access_token){
    console.warn('rsvp_gmail_missing_access_token');
    return {sent:false,code:'gmail_no_access_token',message:'Google hat keinen Zugriffstoken zurückgegeben. Bitte die Gmail-OAuth-Freigabe prüfen.'};
  }
  const sent=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
    method:'POST',
    headers:{authorization:'Bearer '+auth.access_token,'content-type':'application/json'},
    body:JSON.stringify({raw:mimeMessage(to,plain,html)}),
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
  const configured=!!(env('TURNSTILE_SITE_KEY')&&env('TURNSTILE_SECRET_KEY')
    &&env('GMAIL_CLIENT_ID')&&env('GMAIL_CLIENT_SECRET')&&env('GMAIL_REFRESH_TOKEN')
    &&env('RSVP_BASE_URL')&&env('SUPABASE_URL')&&env('SUPABASE_SERVICE_ROLE_KEY'));
  if(action==='config') {
    return reply(200,configured?{
      enabled:true,siteKey:env('TURNSTILE_SITE_KEY'),sender:GMAIL_SENDER,
    }:{enabled:false,message:'Gmail-Zugriff und Cloudflare-Menschprüfung müssen vor der Anmeldung noch vom Verein freigegeben werden.'},origin);
  }
  if (!configured) return reply(503,{error:'Anmeldung derzeit nicht verfügbar. E-Mail-Versand und Cloudflare Turnstile sind noch nicht eingerichtet.'},origin);
  const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{
    auth:{autoRefreshToken:false,persistSession:false},
  });
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
    .select('id,title,starts_at,location_name,rsvp_enabled,rsvp_deadline')
    .eq('id',body.event_id).eq('status','published').eq('rsvp_enabled',true).maybeSingle();
  if(eventError||!event) return reply(404,{error:'Die Veranstaltung ist nicht für Anmeldungen geöffnet.'},origin);
  if(new Date(event.starts_at).getTime()<=Date.now()
    || (event.rsvp_deadline&&new Date(event.rsvp_deadline).getTime()<Date.now()))
    return reply(409,{error:'Die Anmeldefrist ist abgelaufen.'},origin);

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

  let confirmation:URL;
  try {
    const base=new URL(env('RSVP_BASE_URL'));
    if(base.protocol!=='https:' || !allowedHost.has(base.hostname)) throw new Error('Unzulässige Basis-URL');
    const prefix=base.pathname.endsWith('/')?base.pathname:base.pathname+'/';
    confirmation=new URL(prefix+'veranstaltung/bestaetigen/',base.origin);
    confirmation.searchParams.set('request',pending.id);
    confirmation.searchParams.set('token',secret);
  } catch {
    await db.from('event_rsvp_pending').delete().eq('id',pending.id);
    return reply(503,{error:'Die Bestätigungsseite ist noch nicht konfiguriert.'},origin);
  }
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
