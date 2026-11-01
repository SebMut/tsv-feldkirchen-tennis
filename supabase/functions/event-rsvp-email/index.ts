import { createClient } from 'npm:@supabase/supabase-js@2.75.0';

// Public Edge endpoint: no user login is required; all writes go through
// verified Cloudflare Turnstile and a single-use e-mail confirmation token.
// Never expose RESEND_API_KEY, TURNSTILE_SECRET_KEY or service_role to browser.
const env = (key: string) => Deno.env.get(key)?.trim() || '';
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
    &&env('RESEND_API_KEY')&&env('RESEND_FROM_EMAIL')&&env('RSVP_BASE_URL')
    &&env('SUPABASE_URL')&&env('SUPABASE_SERVICE_ROLE_KEY'));
  if(action==='config') {
    return reply(200,configured?{enabled:true,siteKey:env('TURNSTILE_SITE_KEY')}
      :{enabled:false,message:'Der E-Mail-Versand und die Cloudflare-Menschprüfung müssen noch vom Verein eingerichtet werden.'},origin);
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
  const mail=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:'Bearer '+env('RESEND_API_KEY'),'content-type':'application/json'},
    body:JSON.stringify({from:env('RESEND_FROM_EMAIL'),to:[p.email],
      subject:'Bitte bestätige deine Rückmeldung: '+event.title,
      html,text:textContent}),
  }).catch(()=>null);
  if(!mail?.ok){
    await db.from('event_rsvp_pending').delete().eq('id',pending.id);
    return reply(503,{error:'Die E-Mail konnte nicht versendet werden. Bitte Adresse prüfen oder später erneut versuchen.'},origin);
  }
  return reply(200,{pending:true,message:'Bitte öffne die E-Mail und bestätige deine Rückmeldung über den Link. Erst dann zählt deine Antwort.'},origin);
});
