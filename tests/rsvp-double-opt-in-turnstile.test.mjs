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

test('one click in the email triggers automatic confirmation, no second button',()=>{
  assert.ok(confirmed.includes("const confirmFromEmail=async()=>{"));
  assert.ok(confirmed.includes("if(document.visibilityState==='visible')"));
  assert.ok(confirmed.includes("document.addEventListener('visibilitychange',confirmWhenVisible)"));
  assert.ok(confirmed.includes("void confirmFromEmail()"));
  assert.ok(confirmed.includes("action:'confirm'"));
  assert.ok(confirmed.includes("window.history.replaceState({},'',window.location.pathname)"));
  assert.ok(confirmed.includes("let started=false"));
  assert.ok(confirmed.includes("if(started) return"));
  assert.ok(confirmed.includes("data?.confirmed!==true"));
  assert.ok(confirmed.includes("Erfolgreich bestätigt!"));
  assert.ok(confirmed.includes("error.context.clone().json()"));
  assert.ok(!confirmed.includes('rsvp-confirm-button'));
  assert.ok(!confirmed.includes("addEventListener('click'"));
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

test('RSVP base URL accepts only known canonical paths, never a copied label or arbitrary path',()=>{
  const allowed = [
    'https://sebmut.github.io/tsv-feldkirchen-tennis/',
    'https://www.tennis-tsvfeldkirchen.de/',
    'https://tennis-tsvfeldkirchen.de/',
  ];
  assert.ok(edge.includes("const allowedRsvpBases = new Set(["));
  assert.ok(edge.includes("function validatedRsvpBase(): URL | null"));
  assert.ok(edge.includes("allowedRsvpBases.has(base.href)"));
  assert.ok(edge.includes("const base=validatedRsvpBase();"));
  assert.ok(edge.includes("&&base&&env('SUPABASE_URL')"));
  assert.ok(edge.includes("const confirmation=new URL('veranstaltung/bestaetigen/',base)"));
  assert.ok(edge.includes("Die Supabase-Einstellung RSVP_BASE_URL ist ungültig."));
  for(const url of allowed) {
    assert.ok(edge.includes("'"+url+"'"));
    assert.ok(new URL('veranstaltung/bestaetigen/',url).pathname.endsWith('/veranstaltung/bestaetigen/'));
  }
  for(const invalid of [
    'https://sebmut.github.io/tsv-feldkirchen-tennis/%20Wert/',
    'https://sebmut.github.io/tsv-feldkirchen-tennis/ Wert/',
    'https://sebmut.github.io/',
    'https://attacker.example/tsv-feldkirchen-tennis/',
    'http://sebmut.github.io/tsv-feldkirchen-tennis/',
  ]) {
    assert.ok(!allowed.includes(new URL(invalid).href),invalid);
  }
});


test('successful RSVP email submission highlights spam folder and sender above ordinary feedback',()=>{
  const pageHtml=page;
  const globalCss=r('src/styles/global.css');
  const reminder='<div id="rsvp-spam-warning" class="rsvp-spam-warning" role="alert" hidden>';
  assert.ok(pageHtml.includes(reminder));
  assert.ok(pageHtml.includes('WICHTIG: Bitte auch den SPAM-Ordner prüfen!'));
  assert.ok(pageHtml.includes('Die Bestätigungs-E-Mail kommt von'));
  assert.ok(pageHtml.includes('tsvfeldkirchen.tennis@gmail.com'));
  assert.ok(pageHtml.indexOf('id="rsvp-spam-warning"')<pageHtml.indexOf('id="rsvp-form-feedback"'));
  assert.ok(publicCode.includes("const spamWarning = byId<HTMLElement>('rsvp-spam-warning')"));
  assert.ok(publicCode.includes("if (spamWarning) spamWarning.hidden = true"));
  const success=publicCode.indexOf("showFeedback('Prüfe jetzt dein E-Mail-Postfach:");
  assert.ok(success>=0);
  assert.ok(publicCode.indexOf('if (spamWarning) spamWarning.hidden = false',success)>success);
  assert.ok(globalCss.includes('.rsvp-spam-warning[hidden]{display:none!important}'));
  assert.ok(globalCss.includes('font-size:clamp(1.35rem,3vw,1.65rem)'));
  assert.ok(globalCss.includes('border:3px solid #bb1026'));
});


test('admin controls youth, women and men independently and PDF export exists',()=>{
  const adminPage=r('src/pages/admin/index.astro');
  const report=r('src/scripts/rsvp-report-pdf.ts');
  for (const key of ['youth','women','men']) {
    assert.ok(adminPage.includes('id="rsvp-admin-tournament-'+key+'"'));
    assert.ok(admin.includes("field('rsvp-admin-tournament-"+key+"').checked"));
    assert.ok(admin.includes('tournament_'+key+'_enabled:'));
  }
  assert.ok(adminPage.includes('id="rsvp-admin-pdf"'));
  assert.ok(adminPage.includes('PDF erstellen'));
  assert.ok(admin.includes("downloadRsvpPdf({"));
  assert.ok(admin.includes("},verifiedResponses)"));
  assert.ok(report.includes('export function downloadRsvpPdf('));
  assert.ok(report.includes("new Blob([toBytes(pdf)],{type:'application/pdf'})"));
  assert.ok(report.includes("a.download='tsv-feldkirchen-'"));
  assert.ok(report.includes("const pages:string[][]=[[]]"));
  assert.ok(report.includes('7. Teilnehmer alphabetisch'));
  assert.ok(report.includes('6. Helfer'));
  assert.ok(report.includes('2. Buffet: Salate, Vorspeisen und Nachspeisen'));
  assert.ok(report.includes("localeCompare(b,'de'"));
  assert.ok(report.includes("r.attendance==='yes'"));
});

test('public RSVP disables individual tournament sections according to admin flags',()=>{
  for(const key of ['youth','women','men']){
    assert.ok(publicCode.includes('tournament_'+key+'_enabled'));
  }
  assert.ok(page.includes('id="rsvp-youth-section"'));
  assert.ok(page.includes('id="rsvp-women-section"'));
  assert.ok(page.includes('id="rsvp-men-section"'));
  assert.ok(publicCode.includes("const adultRoster = (id: string): string[] | null =>"));
  assert.ok(publicCode.includes('women,men,turnstileToken'));
  const css=r('src/styles/global.css');
  assert.ok(css.includes('.rsvp-adult-tournament[hidden],.rsvp-youth-section[hidden]{display:none!important}'));
});

test('email duplicates blocked by server and concurrent confirmations cannot overwrite existing response',()=>{
  const migration=r('supabase/migrations/20261101233000_rsvp_tournament_options_prevent_duplicate_email.sql');
  assert.ok(edge.includes("code:'rsvp_duplicate_email'"));
  assert.ok(edge.includes("eq('member_email',p.email)"));
  assert.ok(edge.includes(".not('verified_at','is',null).limit(1)"));
  assert.ok(edge.indexOf("const cf=await fetch('https://challenges.cloudflare.com/turnstile") <
    edge.indexOf("const existing=await db.from('event_rsvps')"));
  assert.ok(edge.includes('tournament_youth_enabled===false'));
  assert.ok(edge.includes('tournament_women_enabled!==true'));
  assert.ok(edge.includes('tournament_men_enabled!==true'));
  assert.ok(edge.includes("['Damenmeisterschaft',p.women.length"));
  assert.ok(edge.includes("['Herrenmeisterschaft',p.men.length"));
  assert.ok(migration.includes('women_registrations jsonb not null'));
  assert.ok(migration.includes('men_registrations jsonb not null'));
  assert.ok(migration.includes('on conflict(event_id,member_email) do nothing'));
  assert.ok(migration.includes('get diagnostics v_inserted = row_count'));
  assert.ok(migration.includes('if v_inserted=0 then return false'));
  assert.ok(!migration.includes('do update set'));
});
