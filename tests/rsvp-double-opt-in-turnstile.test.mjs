import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const r=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const edge=r('supabase/functions/event-rsvp-email/index.ts');
const sql=r('supabase/migrations/20261101220000_rsvp_double_opt_in.sql');
const page=r('src/pages/veranstaltung/index.astro');
const confirmed=r('src/pages/veranstaltung/bestaetigen/index.astro');
const publicCode=r('src/scripts/event-rsvp.ts');
const admin=r('src/scripts/event-rsvp-admin.ts');
const config=r('supabase/config.toml');

test('admin: save submit not blocked by invisible native validation, exceptions are reported',()=>{
  assert.ok(admin.includes('form.noValidate = true'));
  assert.ok(admin.includes("message('Speichern fehlgeschlagen: '"));
  assert.ok(admin.includes("button.textContent = 'Veranstaltung speichern'"));
  assert.ok(admin.includes("field('rsvp-admin-start').focus()"));
  assert.ok(admin.includes("message('Speichere Veranstaltung …')"));
});

test('public email address is required and confirmation required before counting',()=>{
  assert.ok(page.includes('id="rsvp-member-email" name="member_email" type="email"'));
  assert.ok(page.includes('maxlength="254" required'));
  assert.ok(page.includes('id="rsvp-turnstile-widget"'));
  assert.ok(page.includes('Erst nach Bestätigung zählt deine Anmeldung'));
  assert.ok(publicCode.includes("supabase.functions.invoke('event-rsvp-email'"));
  assert.ok(publicCode.includes('turnstileToken'));
  assert.ok(publicCode.includes('if (!enabled)'));
  assert.ok(!publicCode.includes("supabase.rpc('submit_event_rsvp'"));
  assert.ok(!publicCode.includes('localStorage.setItem'));
});

test('server fails closed if Turnstile or e-mail settings not installed',()=>{
  for(const secret of ['TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY','GMAIL_CLIENT_ID','GMAIL_CLIENT_SECRET','GMAIL_REFRESH_TOKEN','RSVP_BASE_URL'])
    assert.ok(edge.includes("env('"+secret+"')"),secret);
  assert.ok(edge.includes('if (!configured) return reply(503'));
  assert.ok(edge.includes("action==='config'"));
  assert.ok(edge.includes('enabled:false'));
  assert.ok(config.includes('[functions.event-rsvp-email]'));
  assert.ok(config.includes('verify_jwt = false'));
});

test('Cloudflare Turnstile verified by remote Siteverify, hostname enforced and tokens single use',()=>{
  assert.ok(edge.includes('https://challenges.cloudflare.com/turnstile/v0/siteverify'));
  assert.ok(edge.includes("secret:env('TURNSTILE_SECRET_KEY'),response:token"));
  assert.ok(edge.includes('!verdict.success || !allowedHost.has(verdict.hostname)'));
  assert.ok(edge.includes('cf?.ok'));
  assert.ok(edge.includes('token.length>2048'));
  assert.ok(publicCode.includes('cf.turnstile.render'));
  assert.ok(publicCode.includes('resetChallenge()'));
});

test('Gmail sends with the TSV Feldkirchen address only after Cloudflare verification',()=>{
  assert.ok(edge.indexOf('siteverify') < edge.indexOf('const delivery=await sendGmail('));
  assert.ok(edge.includes("GMAIL_SENDER = 'tsvfeldkirchen.tennis@gmail.com'"));
  assert.ok(edge.includes('https://oauth2.googleapis.com/token'));
  assert.ok(edge.includes('https://gmail.googleapis.com/gmail/v1/users/me/messages/send'));
  assert.ok(edge.includes("grant_type:'refresh_token'"));
  assert.ok(edge.includes('authorization:\'Bearer \'+auth.access_token'));
  assert.ok(edge.includes("['E-Mail',p.email]"));
  assert.ok(edge.includes("['Jugendmeisterschaften'"));
  assert.ok(edge.includes('confirmation.searchParams.set(\'token\',secret)'));
  assert.ok(edge.includes('crypto.getRandomValues(new Uint8Array(32))'));
  assert.ok(!edge.includes('api.resend.com'));
  assert.ok(!edge.includes('RESEND_API_KEY'));
});

test('Gmail MIME is UTF-8 safe, includes text and HTML and a valid sender',()=>{
  assert.ok(edge.includes('function base64Utf8(value:string)'));
  assert.ok(edge.includes("new TextEncoder().encode(value)"));
  assert.ok(edge.includes('Content-Type: multipart/alternative'));
  assert.ok(edge.includes('Content-Type: text/html; charset=UTF-8'));
  assert.ok(edge.includes('Content-Type: text/plain; charset=UTF-8'));
  assert.ok(edge.includes("base64Utf8(lines.join("));
  assert.ok(edge.includes('raw:mimeMessage(to,plain,html)'));
  assert.ok(edge.includes("'From: TSV Feldkirchen Tennis <'+GMAIL_SENDER+'>'"));
});

test('confirmation requires an active deliberate click, not email link previews',()=>{
  assert.ok(confirmed.includes('id="rsvp-confirm-button"'));
  assert.ok(confirmed.includes("button.addEventListener('click'"));
  assert.ok(confirmed.includes("action:'confirm'"));
  assert.ok(confirmed.includes('window.history.replaceState'));
  assert.ok(!confirmed.includes('supabase.rpc'));
});

test('SQL disables former public RPC and protects pending sensitive data',()=>{
  assert.ok(sql.includes('drop function if exists public.submit_event_rsvp'));
  assert.ok(sql.includes('revoke all on public.event_rsvp_pending from public, anon, authenticated'));
  assert.ok(sql.includes('alter table public.event_rsvp_pending enable row level security'));
  assert.ok(sql.includes('token_hash text not null unique'));
  assert.ok(sql.includes('on conflict(event_id,member_email) do update'));
  assert.ok(sql.includes('where event_id=p_event_id and verified_at is not null'));
  assert.ok(sql.includes('grant execute on function public.confirm_event_rsvp_email(uuid,text) to service_role'));
  assert.ok(!sql.includes('grant execute on function public.confirm_event_rsvp_email(uuid,text) to anon'));
  assert.ok(sql.includes('p.expires_at>now()'));
});

test('registration cannot be inflated before email verification; admin sees email verified only',()=>{
  assert.ok(!edge.includes("db.from('event_rsvps').insert("));
  assert.ok(edge.includes("db.from('event_rsvp_pending')"));
  assert.ok(edge.includes("db.rpc('confirm_event_rsvp_email'"));
  assert.ok(admin.includes(".not('verified_at','is',null)"));
  assert.ok(admin.includes('member_email'));
  assert.ok(sql.includes('verified_at=excluded.verified_at'));
});


test('Gmail provider errors are safe, distinguish bad client from expired grant and retain no pending row',()=>{
  assert.ok(edge.includes("case 'invalid_client':"));
  assert.ok(edge.includes("case 'invalid_grant':"));
  assert.ok(edge.includes("code:'gmail_invalid_client'"));
  assert.ok(edge.includes("code:'gmail_invalid_grant'"));
  assert.ok(edge.includes("code:'gmail_api_disabled'"));
  assert.ok(edge.includes("code:'gmail_insufficient_permission'"));
  assert.ok(edge.includes("console.warn('rsvp_gmail_auth_failure'"));
  assert.ok(edge.includes("console.warn('rsvp_gmail_send_failure'"));
  assert.ok(edge.includes("return reply(503,{error:delivery.message,code:delivery.code},origin)"));
  assert.ok(edge.includes("if(!delivery.sent){"));
  assert.ok(edge.includes("db.from('event_rsvp_pending').delete().eq('id',pending.id)"));
  assert.ok(!edge.includes("console.log(auth)"));
  assert.ok(!edge.includes("console.log(access)"));
});
test('Browser displays safe provider error body even when HTTP status is 503',()=>{
  assert.ok(publicCode.includes("error.context instanceof Response"));
  assert.ok(publicCode.includes("error.context.clone().json()"));
  assert.ok(publicCode.includes("typeof failure?.error === 'string'"));
  assert.ok(publicCode.includes("showFeedback(reason ||"));
});
