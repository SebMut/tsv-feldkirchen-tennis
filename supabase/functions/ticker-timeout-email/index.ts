import { createClient } from 'npm:@supabase/supabase-js@2.75.0';

// Only a freshly issued, one-time token created by a private pg_cron job
// can trigger this server-to-server Edge Function. No public admin API.
const env=(key:string)=>Deno.env.get(key)?.trim()||'';
const GMAIL_SENDER='tsvfeldkirchen.tennis@gmail.com';
type Notice={
  id:string;recipient_email:string|null;match_id:string;
  opponent:string;team_name:string;is_home:boolean;started_at:string;
};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
});
function escapeHtml(s:unknown):string {
  return String(s??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[c]||c);
}
function toB64(s:string):string{
  const data=new TextEncoder().encode(s);
  let binary='';
  for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
  return btoa(binary);
}
function wrap(s:string):string{return toB64(s).match(/.{1,76}/g)?.join('\r\n')||''}
function message(to:string,text:string,html:string):string {
  const boundary='tsv-ticker-'+crypto.randomUUID().replaceAll('-','');
  const source=[
    'From: TSV Feldkirchen Tennis <'+GMAIL_SENDER+'>',
    'To: <'+to+'>',
    'Subject: TSV Feldkirchen Tennis: Liveticker nach 24 Stunden geschlossen',
    'Date: '+new Date().toUTCString(),
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="'+boundary+'"',
    '',
    '--'+boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',wrap(text),
    '--'+boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',wrap(html),'--'+boundary+'--','',
  ].join('\r\n');
  return toB64(source).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}

function buildMail(notice:Notice):{plain:string;html:string}{
  const date=new Intl.DateTimeFormat('de-DE',{
    dateStyle:'full',timeStyle:'short',timeZone:'Europe/Berlin',
  }).format(new Date(notice.started_at));
  const name=notice.team_name+' gegen '+notice.opponent;
  const adminBase=env('RSVP_BASE_URL');
  const safeBases=new Set([
    'https://sebmut.github.io/tsv-feldkirchen-tennis/',
    'https://www.tennis-tsvfeldkirchen.de/',
    'https://tennis-tsvfeldkirchen.de/',
  ]);
  const base=safeBases.has(adminBase)?adminBase:'https://sebmut.github.io/tsv-feldkirchen-tennis/';
  const admin=new URL('admin/?panel=matches',base).toString();
  const home=notice.is_home?'Heimspiel':'Auswärtsspiel';
  const plain=[
    'TSV FELDKIRCHEN TENNIS',
    'Erinnerung: Liveticker automatisch geschlossen',
    '',
    'Hallo,',
    'du hast den Liveticker für '+name+' gestartet.',
    'Dieser Spieltag war auch nach 24 Stunden noch als LIVE markiert.',
    'Damit kein veralteter Liveticker weiterläuft, wurde er nun automatisch geschlossen.',
    '',
    'Mannschaft: '+notice.team_name,
    'Gegner: '+notice.opponent,
    'Spielart: '+home,
    'Start des Livetickers: '+date,
    '',
    'Bitte prüfe den Spieltag im Mein-TSV-Adminbereich und trage den tatsächlichen Endstand ein.',
    'Die automatische Schließung legt KEIN sportliches Endergebnis fest.',
    '',
    'Zum Mein-TSV-Adminbereich: '+admin,
    '',
    'Sportliche Grüße',
    'TSV Feldkirchen Tennis',
    'Diese Nachricht wurde automatisch an die Person gesendet, die den Liveticker gestartet hat.',
  ].join('\n');
  const html=`<!doctype html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:25px 10px;background:#f4f6f4;font-family:Arial,Helvetica,sans-serif;color:#1a3828">
  <div style="max-width:640px;margin:auto;border-radius:15px;overflow:hidden;background:#fff;border:1px solid #dae4dd">
    <div style="background:#e30613;color:#fff;padding:24px 29px">
      <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:2px">TSV FELDKIRCHEN · TENNIS</p>
      <h1 style="font-size:25px;line-height:1.2;margin:12px 0 0;color:#fff">Liveticker automatisch geschlossen</h1>
    </div>
    <div style="padding:26px 29px">
      <p style="margin-top:0">Hallo,</p>
      <p>du hast den Liveticker für <strong>${escapeHtml(name)}</strong> gestartet. Der Spieltag war nach <strong>24 Stunden noch als LIVE markiert</strong>.</p>
      <p style="background:#fff1f2;border-left:5px solid #e30613;padding:14px 17px;border-radius:6px;font-weight:700;color:#9b1021">Wir haben den Liveticker deshalb automatisch geschlossen.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:22px 0;font-size:14px">
        <tr><td style="padding:9px 4px;border-bottom:1px solid #e4eae5;color:#5a6c60">Mannschaft</td><td style="padding:9px 4px;border-bottom:1px solid #e4eae5;font-weight:bold">${escapeHtml(notice.team_name)}</td></tr>
        <tr><td style="padding:9px 4px;border-bottom:1px solid #e4eae5;color:#5a6c60">Gegner</td><td style="padding:9px 4px;border-bottom:1px solid #e4eae5;font-weight:bold">${escapeHtml(notice.opponent)}</td></tr>
        <tr><td style="padding:9px 4px;border-bottom:1px solid #e4eae5;color:#5a6c60">Spielortstatus</td><td style="padding:9px 4px;border-bottom:1px solid #e4eae5">${escapeHtml(home)}</td></tr>
        <tr><td style="padding:9px 4px;color:#5a6c60">Ticker gestartet</td><td style="padding:9px 4px">${escapeHtml(date)}</td></tr>
      </table>
      <p>Bitte prüfe den Spieltag und trage bei Bedarf den tatsächlichen Endstand nach. <strong>Die automatische Schließung ist keine sportliche Ergebniswertung.</strong></p>
      <p style="margin:24px 0"><a href="${escapeHtml(admin)}" style="display:inline-block;border-radius:8px;background:#e30613;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 22px">Spieltag im Mein TSV öffnen</a></p>
      <p style="color:#536b5a;margin-bottom:0">Sportliche Grüße<br><strong>TSV Feldkirchen Tennis</strong></p>
    </div>
    <div style="background:#193c2c;color:#e6f1e9;padding:18px 29px;font-size:12px;line-height:1.6">
      Automatische Erinnerung an die Person, die den Liveticker gestartet hat.<br>
      Absender: ${GMAIL_SENDER}
    </div>
  </div></body></html>`;
  return {plain,html};
}
async function sendGmail(row:Notice):Promise<{ok:boolean;code:string}>{
  const authRequest=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      client_id:env('GMAIL_CLIENT_ID'),
      client_secret:env('GMAIL_CLIENT_SECRET'),
      refresh_token:env('GMAIL_REFRESH_TOKEN'),
      grant_type:'refresh_token',
    }),
  }).catch(()=>null);
  if(!authRequest?.ok){
    const e=await authRequest?.json().catch(()=>null);
    const code=typeof e?.error==='string'?e.error:'gmail_auth_failure';
    return {ok:false,code:code.slice(0,70)};
  }
  const token=await authRequest.json().catch(()=>null);
  if(typeof token?.access_token!=='string')return {ok:false,code:'gmail_access_token_missing'};
  const body=buildMail(row);
  const request=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
    method:'POST',
    headers:{authorization:'Bearer '+token.access_token,'content-type':'application/json'},
    body:JSON.stringify({raw:message(row.recipient_email!,body.plain,body.html)}),
  }).catch(()=>null);
  return {ok:!!request?.ok,code:request?.ok?'sent':('gmail_http_'+(request?.status||'network'))};
}

Deno.serve(async req=>{
  if(req.method!=='POST')return reply(405,{error:'POST only'});
  if(!env('SUPABASE_URL')||!env('SUPABASE_SERVICE_ROLE_KEY'))
    return reply(503,{error:'Server not configured'});
  const raw=await req.text();
  if(raw.length>2000)return reply(413,{error:'Body too large'});
  let body:Record<string,unknown>;
  try{body=JSON.parse(raw)}catch{return reply(400,{error:'Invalid JSON'})}
  if(typeof body?.dispatch_token!=='string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.dispatch_token))
    return reply(401,{error:'Unauthorized'});
  const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{
    auth:{autoRefreshToken:false,persistSession:false},
  });
  const {data:authorized,error:authError}=await db.rpc('consume_ticker_cron_token',{p_token:body.dispatch_token});
  if(authError||authorized!==true)return reply(401,{error:'Unauthorized'});
  let sent=0,failed=0;
  for(let i=0;i<10;i++){
    const {data,error}=await db.rpc('claim_ticker_timeout_notice');
    if(error){console.error('ticker_timeout_claim_failed');return reply(500,{error:'Queue unavailable',sent,failed})}
    const row=(Array.isArray(data)?data[0]:null) as Notice|null;
    if(!row)break;
    let result:{ok:boolean;code:string};
    if(!row.recipient_email|| !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(row.recipient_email)){
      result={ok:false,code:'starter_email_missing'};
    }else{
      result=await sendGmail(row);
    }
    const completed=await db.rpc('complete_ticker_timeout_notice',{
      p_id:row.id,p_sent:result.ok,p_error:result.ok?null:result.code,
    });
    if(completed.error)console.error('ticker_timeout_ack_failed');
    if(result.ok)sent++;else{
      failed++;
      console.warn('ticker_timeout_delivery_failed',result.code);
    }
  }
  return reply(200,{sent,failed});
});
