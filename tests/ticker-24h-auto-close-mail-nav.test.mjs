import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const header=read('src/components/SiteHeader.astro');
const nav=read('src/scripts/live-nav-pulse.ts');
const css=read('src/styles/global.css');
const db=read('supabase/migrations/20261102070000_live_ticker_24h_timeout.sql');
const mail=read('supabase/functions/ticker-timeout-email/index.ts');
const admin=read('src/scripts/admin.ts');
const pub=read('src/scripts/public.ts');
const cfg=read('supabase/config.toml');

test('LIVE menu pulses conspicuously in desktop, mobile menu and dock only if Supabase confirms live',()=>{
  assert.ok(header.includes('initLiveNavPulse()'));
  assert.ok((header.match(/js-live-nav-link/g)||[]).length>=3);
  assert.ok(nav.includes("from('match_live_state')"));
  assert.ok(nav.includes(".eq('status','live').limit(1)"));
  assert.ok(nav.includes('link.classList.toggle(\'has-live-match\',anyLive)'));
  assert.ok(nav.includes('window.setInterval(()=>void refresh(),30000)'));
  assert.ok(nav.includes("document.visibilityState==='visible'"));
  assert.ok(css.includes('@keyframes tsvLiveMenuPulse'));
  assert.ok(css.includes('.mobile-dock__tab.js-live-nav-link.has-live-match'));
  assert.ok(css.includes('.desktop-nav a.js-live-nav-link.has-live-match'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
});

test('Ticker expires after 24h without inventing a sporting final score',()=>{
  assert.ok(db.includes("status in ('scheduled','live','finished','cancelled','expired')"));
  assert.ok(db.includes("s.started_at<=now()-interval '24 hours'"));
  assert.ok(db.includes("set status='expired',auto_closed_at=now(),finished_at=null"));
  assert.ok(db.includes("new.started_by=new.updated_by"));
  assert.ok(db.includes("new.started_at=now()"));
  assert.ok(admin.includes('Ticker automatisch geschlossen'));
  assert.ok(admin.includes("if (live.status === 'expired')"));
  assert.ok(admin.includes('Ticker bewusst neu starten'));
  assert.ok(pub.includes('Ticker automatisch geschlossen'));
  assert.ok(db.includes("select cron.schedule("));
  assert.ok(db.includes("'tsv-ticker-close-after-24h'"));
  assert.ok(db.includes("'* * * * *'"));
});

test('Only private one-time scheduled dispatcher may email original ticker starter',()=>{
  assert.ok(db.includes('private.ticker_cron_tokens'));
  assert.ok(db.includes("consume_ticker_cron_token"));
  assert.ok(db.includes('for update skip locked'));
  assert.ok(db.includes('n.sent_at is null'));
  assert.ok(db.includes('unique(match_id,started_at)'));
  assert.ok(db.includes('left join auth.users u on u.id=c.starter_user_id'));
  assert.ok(db.includes('grant execute on function public.claim_ticker_timeout_notice() to service_role'));
  assert.ok(db.includes('revoke all on function public.consume_ticker_cron_token(uuid) from public,anon,authenticated'));
  assert.ok(cfg.includes('[functions.ticker-timeout-email]'));
  assert.ok(cfg.includes('verify_jwt = false'));
  assert.ok(mail.includes("db.rpc('consume_ticker_cron_token'"));
  assert.ok(mail.includes("authorized!==true"));
  assert.ok(mail.includes("db.rpc('claim_ticker_timeout_notice')"));
  assert.ok(mail.includes("db.rpc('complete_ticker_timeout_notice'"));
  assert.ok(!mail.includes('console.log(row)'));
  assert.ok(mail.includes("body:JSON.stringify({raw:message("));
});

test('Gmail reminder uses existing OAuth secrets and TSV branded email without leaking PII',()=>{
  for(const name of ['GMAIL_CLIENT_ID','GMAIL_CLIENT_SECRET','GMAIL_REFRESH_TOKEN']){
    assert.ok(mail.includes("env('"+name+"')"));
  }
  assert.ok(mail.includes("tsvfeldkirchen.tennis@gmail.com"));
  assert.ok(mail.includes('https://gmail.googleapis.com/gmail/v1/users/me/messages/send'));
  assert.ok(mail.includes("background:#e30613"));
  assert.ok(mail.includes("background:#193c2c"));
  assert.ok(mail.includes('noch als LIVE markiert'));
  assert.ok(mail.includes('Die automatische Schließung'));
  assert.ok(mail.includes("admin/?panel=matches"));
  assert.ok(!mail.includes('api.resend.com'));
});
