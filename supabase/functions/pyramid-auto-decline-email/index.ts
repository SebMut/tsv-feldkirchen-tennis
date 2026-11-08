// Separate staging-only notification worker. Dispatch requires a one-time pg_cron token.
// Existing Gmail OAuth sender credentials are reused; no client-side email secrets.
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';

const env=(key:string)=>Deno.env.get(key)?.trim()||'';
type Notice={
 id:string;recipient_email:string|null;challenger_name:string;
 defender_name:string;ladder_title:string;season_label:string;
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
 const title='TSV Feldkirchen Tennis · Forderung automatisch abgelehnt';
 const plain=[
 'TSV FELDKIRCHEN TENNIS','Forderung automatisch abgelehnt','','Hallo '+row.challenger_name+',',
 'deine offene Forderung an '+row.defender_name+' in der Forderungspyramide '+row.ladder_title+
 ' ('+row.season_label+') wurde automatisch abgelehnt.',
 'Grund: Für diese Person wurde inzwischen eine andere Forderung angenommen.',
 'Solange das angenommene Spiel nicht abgeschlossen ist, kann die Person nicht erneut gefordert werden.',
 'Du kannst danach eine neue Forderung stellen, sofern die Ranglistenregeln dies erlauben.','',
 'Diese E-Mail wurde automatisch erstellt. Du musst nichts weiter tun.','',
 'TSV Feldkirchen Tennis'
 ].join('\n');
 const html='<!doctype html><html lang="de"><head><meta charset="UTF-8"></head><body style="margin:0;background:#f4f5f5;font-family:Arial,Helvetica,sans-serif;color:#183026">'
  +'<div style="max-width:640px;margin:25px auto;background:white;border:1px solid #dde4e1;border-radius:14px;overflow:hidden">'
  +'<header style="background:#e30613;color:#fff;padding:24px 28px"><p style="margin:0;font-size:12px;letter-spacing:2px;font-weight:bold">TSV FELDKIRCHEN TENNIS</p>'
  +'<h1 style="font-size:24px;margin:9px 0 0">Forderung automatisch abgelehnt</h1></header>'
  +'<main style="padding:26px 28px"><p>Hallo '+escapeHtml(row.challenger_name)+',</p>'
  +'<p>deine Forderung an <strong>'+escapeHtml(row.defender_name)+'</strong> in der '
  +'<strong>'+escapeHtml(row.ladder_title)+' · '+escapeHtml(row.season_label)+'</strong> wurde automatisch abgelehnt.</p>'
  +'<p style="background:#fff2f2;border-left:5px solid #e30613;padding:14px">'
  +'Die geforderte Person hat inzwischen ein anderes Forderungsspiel angenommen. Bis zum Abschluss '
  +'dieses Spiels kann sie nicht erneut herausgefordert werden.</p>'
  +'<p>Danach kannst du gemäß den Ranglistenregeln eine neue Forderung stellen. '
  +'Für die abgelehnte Forderung musst du nichts weiter unternehmen.</p>'
  +'<p>Sportliche Grüße<br><strong>TSV Feldkirchen Tennis</strong></p></main>'
  +'<footer style="padding:16px 28px;background:#15382f;color:#f6f6f6;font-size:12px">'
  +'Automatische Benachrichtigung der Tennisabteilung</footer></div></body></html>';
 return {title,plain,html};
}
async function sendGmail(row:Notice) {
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
 const mail=buildMail(row);
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
  const {data,error}=await db.rpc('claim_pyramid_auto_decline_notice');
  if(error){console.error('pyramid_notice_claim_failed');return reply(503,{error:'Queue unavailable',sent,failed})}
  const row=(Array.isArray(data)?data[0]:null) as Notice|null;
  if(!row)break;
  const valid=!!row.recipient_email&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(row.recipient_email);
  const outcome=valid?await sendGmail(row):{ok:false,code:'recipient_email_missing'};
  const ack=await db.rpc('complete_pyramid_auto_decline_notice',{
   p_id:row.id,p_sent:outcome.ok,p_error:outcome.ok?null:outcome.code
  });
  if(ack.error)console.error('pyramid_notice_ack_failed');
  if(outcome.ok)sent++;else{failed++;console.warn('pyramid_notice_delivery_failed',outcome.code);}
 }
 return reply(200,{sent,failed});
});
