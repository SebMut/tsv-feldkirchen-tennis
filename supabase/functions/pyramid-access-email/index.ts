// TSV Feldkirchen: production access-link delivery via existing Gmail OAuth,
// protected by the existing Cloudflare Turnstile and an atomic DB rate limiter.
// No tokens, recipient addresses or IP addresses in the logs or database.
import { createClient } from 'npm:@supabase/supabase-js@2.75.0';

const env=(key:string)=>Deno.env.get(key)?.trim()||'';
const LIVE_URL='https://www.tennis-tsvfeldkirchen.de/forderungspyramide/';
const SENDER='tsvfeldkirchen.tennis@gmail.com';
const origins=new Set(['https://www.tennis-tsvfeldkirchen.de','https://tennis-tsvfeldkirchen.de',
  'https://sebmut.github.io']);
const hosts=new Set(['www.tennis-tsvfeldkirchen.de','tennis-tsvfeldkirchen.de','sebmut.github.io']);
function headers(origin:string|null){
 return {'content-type':'application/json; charset=utf-8','cache-control':'no-store',
   'vary':'Origin','access-control-allow-methods':'POST,OPTIONS',
   'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
   ...(origin&&origins.has(origin)?{'access-control-allow-origin':origin}:{})};
}
function reply(status:number,data:unknown,origin:string|null){
 return new Response(JSON.stringify(data),{status,headers:headers(origin)});
}
const emailOK=(v:unknown):v is string=>typeof v==='string'&&v.length<=254&&
 /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(v);
function escapeHtml(v:string){return v.replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]||c));}
function b64(v:string){let result='';const data=new TextEncoder().encode(v);
 for(let i=0;i<data.length;i+=8192)result+=String.fromCharCode(...data.subarray(i,i+8192));
 return btoa(result);
}
function gmailRaw(to:string,subject:string,plain:string,html:string){
 const boundary='tsv-pyramid-'+crypto.randomUUID().replaceAll('-','');
 const wrap=(v:string)=>b64(v).match(/.{1,76}/g)?.join('\r\n')||'';
 const source=[
 'From: TSV Feldkirchen Tennis <'+SENDER+'>',
 'To: <'+to+'>',
 'Subject: =?UTF-8?B?'+b64(subject)+'?=',
 'Date: '+new Date().toUTCString(),
 'MIME-Version: 1.0',
 'Content-Type: multipart/alternative; boundary="'+boundary+'"',
 '','--'+boundary,
 'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',wrap(plain),
 '--'+boundary,'Content-Type: text/html; charset=UTF-8',
 'Content-Transfer-Encoding: base64','',wrap(html),
 '--'+boundary+'--',''
 ].join('\r\n');
 return b64(source).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
async function hash(v:string){
 const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));
 return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function send(to:string,link:string){
 const subject='TSV Feldkirchen Tennis · Passwort einrichten';
 const plain=[
  'TSV FELDKIRCHEN TENNIS','','Hallo,',
  'du hast einen einmaligen Link angefordert, mit dem du dein Passwort für Mein TSV einrichten kannst.','',
  'Passwort einrichten:',link,'',
  'Der Link ist nur einmal gültig und verfällt nach der in Mein TSV eingestellten Gültigkeitsdauer.',
  'Nach dem Festlegen deines Passworts kannst du die Teilnahme an einer Pyramide beantragen. Die Ranglistenverwaltung prüft deine Anfrage.',
  'Falls du keinen Link angefordert hast, kannst du diese Nachricht ignorieren.','','TSV Feldkirchen Tennis'
 ].join('\n');
 const html='<!doctype html><html lang="de"><head><meta charset="UTF-8"></head>'
  +'<body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f4;color:#183026;margin:0;padding:24px">'
  +'<main style="max-width:620px;margin:auto;background:#fff;border:1px solid #dce4dd;border-radius:14px;overflow:hidden">'
  +'<header style="background:#e30613;color:white;padding:24px">'
  +'<p style="font-size:12px;letter-spacing:2px;margin:0">TSV FELDKIRCHEN TENNIS</p>'
  +'<h1 style="margin:10px 0 0;font-size:24px">Passwort einrichten</h1></header>'
  +'<section style="padding:26px"><p>Hallo,</p><p>du hast einen einmaligen Link angefordert, mit dem du dein Passwort für Mein TSV einrichten kannst.</p>'
  +'<p><a href="'+escapeHtml(link)+'" style="display:inline-block;background:#e30613;'
  +'color:#fff;padding:13px 22px;text-decoration:none;border-radius:9px;font-weight:bold">Passwort festlegen</a></p>'
  +'<p>Nach dem Festlegen deines Passworts kannst du dich direkt für eine Forderungspyramide anmelden. Die Aufnahme wird vom Verein freigegeben. Der Link ist nur einmal gültig.</p>'
  +'<p>Falls du keinen Link angefordert hast, kannst du diese Nachricht ignorieren.</p>'
  +'<p>Sportliche Grüße<br><strong>TSV Feldkirchen Tennis</strong></p></section>'
  +'<footer style="background:#16392f;color:#fff;padding:16px 26px;font-size:12px">Automatische E-Mail der Tennisabteilung</footer>'
  +'</main></body></html>';
 const auth=await fetch('https://oauth2.googleapis.com/token',{
  method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({
   client_id:env('GMAIL_CLIENT_ID'),client_secret:env('GMAIL_CLIENT_SECRET'),
   refresh_token:env('GMAIL_REFRESH_TOKEN'),grant_type:'refresh_token'
  }),
 }).catch(()=>null);
 if(!auth?.ok){console.error('pyramid-access-mail: gmail oauth failed',auth?.status);return false;}
 const data=await auth.json().catch(()=>null);
 if(typeof data?.access_token!=='string'){console.error('pyramid-access-mail: no oauth token');return false;}
 const sent=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
  method:'POST',headers:{authorization:'Bearer '+data.access_token,'content-type':'application/json'},
  body:JSON.stringify({raw:gmailRaw(to,subject,plain,html)})
 }).catch(()=>null);
 if(!sent?.ok)console.error('pyramid-access-mail: gmail rejected',sent?.status);
 return !!sent?.ok;
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
 if(req.method!=='POST')return reply(405,{error:'Nur POST erlaubt.'},origin);
 if(!origin||!origins.has(origin))return reply(403,{error:'Anfrage nur von der TSV-Website zulässig.'},origin);
 const raw=await req.text();
 if(raw.length>3600)return reply(413,{error:'Ungültige Anfrage.'},origin);
 let body:Record<string,unknown>;
 try{body=JSON.parse(raw);}catch{return reply(400,{error:'Ungültige Anfrage.'},origin);}
 const ready=!!(env('TURNSTILE_SITE_KEY')&&env('TURNSTILE_SECRET_KEY')&&
  env('GMAIL_CLIENT_ID')&&env('GMAIL_CLIENT_SECRET')&&env('GMAIL_REFRESH_TOKEN')&&
  env('SUPABASE_URL')&&env('SUPABASE_SERVICE_ROLE_KEY'));
 if(body.action==='config')return reply(200,ready
  ?{enabled:true,siteKey:env('TURNSTILE_SITE_KEY')}
  :{enabled:false,message:'Der Zugangslink-Versand ist derzeit nicht vollständig eingerichtet. Passwort-Anmeldung ist weiterhin möglich.'},origin);
 if(body.action!=='send')return reply(400,{error:'Unbekannte Aktion.'},origin);
 if(!ready)return reply(503,{error:'Der E-Mail-Versand ist derzeit nicht eingerichtet. Bitte die Ranglistenverwaltung informieren.'},origin);
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(!emailOK(email))return reply(400,{error:'Bitte gültige E-Mail-Adresse eingeben.'},origin);
 const captcha=body.turnstileToken;
 if(typeof captcha!=='string'||captcha.length<8||captcha.length>2048)
  return reply(400,{error:'Bitte die Menschprüfung abschließen.'},origin);
 const proof=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
  method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({secret:env('TURNSTILE_SECRET_KEY'),response:captcha})
 }).catch(()=>null);
 if(!proof?.ok)return reply(503,{error:'Menschprüfung nicht erreichbar.'},origin);
 const verified=await proof.json().catch(()=>null);
 if(!verified?.success||!hosts.has(verified.hostname))
  return reply(403,{error:'Menschprüfung fehlgeschlagen. Bitte erneut versuchen.'},origin);
 const client=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{
  auth:{autoRefreshToken:false,persistSession:false}
 });
 const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').trim();
 const [emailHash,ipHash]=await Promise.all([hash(email),hash(ip)]);
 const {data:allowed,error:limitError}=await client.rpc('pyramid_access_link_allow',{
  p_email_hash:emailHash,p_ip_hash:ipHash
 });
 if(limitError){console.error('pyramid-access-mail: rate limiter failed',limitError.code);return reply(503,{error:'Zugangslink momentan nicht verfügbar.'},origin);}
 if(allowed!==true)return reply(429,{error:'Bitte vor dem nächsten Zugangslink etwas warten.'},origin);
 const {data:generated,error:generateError}=await client.auth.admin.generateLink({
  type:'magiclink',email,options:{redirectTo:LIVE_URL}
 });
 if(generateError||!generated?.properties?.action_link){
  console.error('pyramid-access-mail: auth link failed',generateError?.status||generateError?.code);
  return reply(503,{error:'Der Zugangslink konnte nicht erstellt werden. Bitte die Ranglistenverwaltung kontaktieren.'},origin);
 }
 // Use the one-time token hash supplied by GoTrue, but deliver the link to
 // our own first-party page (not the Supabase verification URL). Tokens are
 // carried in a fragment: they never reach hosting access logs or referers.
 // The browser exchanges this token through verifyOtp, then sets a password.
 const action=generated.properties.action_link;
 const hashed=generated.properties.hashed_token;
 const verification=generated.properties.verification_type;
 try{
  const authLink=new URL(action);
  const domain=new URL(env('SUPABASE_URL'));
  if(authLink.origin!==domain.origin||!authLink.pathname.endsWith('/auth/v1/verify'))
   throw new Error('Unexpected link destination');
  if(typeof hashed!=='string'||!/^[a-f0-9]{64}$/i.test(hashed))
   throw new Error('Unexpected token');
  if(!['magiclink','signup','invite','recovery','email'].includes(verification))
   throw new Error('Unexpected verification type');
 }catch{
  console.error('pyramid-access-mail: invalid generated authentication link');
  return reply(503,{error:'Zugangslink konnte nicht sicher erstellt werden.'},origin);
 }
 const fragment=new URLSearchParams({
  pyramid_token_hash:hashed,pyramid_token_type:verification
 });
 const link=LIVE_URL+'#'+fragment.toString();
 const accepted=await send(email,link);
 if(!accepted)return reply(503,{error:'Gmail konnte den Zugangslink nicht versenden. Bitte die Ranglistenverwaltung informieren.'},origin);
 return reply(200,{ok:true,message:'Dein Link zur Passworteinrichtung wurde an Gmail zur Zustellung übergeben. Prüfe bitte dein Postfach.'},origin);
});
