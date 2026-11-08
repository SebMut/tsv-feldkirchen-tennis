import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ui=read('src/scripts/pyramid.ts');
const page=read('src/pages/forderungspyramide/index.astro');
const mail=read('supabase/functions/pyramid-access-email/index.ts');
const migration=read('supabase/migrations/20261108213000_pyramid_master_v1_rules.sql');
const rules=read('src/lib/pyramid-rules.mjs');

test('one-time email goes straight to the password setup on the club site, not an old redirect URL',()=>{
 assert.match(mail,/const LIVE_URL='https:\/\/www\.tennis-tsvfeldkirchen\.de\/forderungspyramide\/'/);
 assert.match(mail,/type:'magiclink',email,options:\{redirectTo:LIVE_URL\}/);
 assert.match(mail,/properties\.hashed_token/);
 assert.match(mail,/properties\.verification_type/);
 assert.match(mail,/pyramid_token_hash:hashed,pyramid_token_type:verification/);
 assert.match(mail,/const link=LIVE_URL\+'#'\+fragment\.toString\(\)/);
 assert.match(mail,/Passwort einrichten/);
 assert.match(mail,/Passwort festlegen/);
 assert.match(mail,/await send\(email,link\)/);
 assert.doesNotMatch(mail,/const link=generated\.properties\.action_link;/);
});

test('password setup uses official Supabase OTP verification then updateUser; no password exposed to Edge',()=>{
 assert.match(ui,/function consumePasswordSetupLink/);
 assert.match(ui,/history\.replaceState\(history\.state,'',location\.pathname\+location\.search\)/);
 assert.match(ui,/supabase\.auth\.verifyOtp\(\{/);
 assert.match(ui,/type:link\.type,token_hash:link\.token/);
 assert.match(ui,/if\(!data\.user\|\|!data\.session\)/);
 assert.match(ui,/supabase\.auth\.updateUser\(\{password\}\)/);
 assert.match(ui,/password!==confirmation/);
 assert.match(ui,/password\.length<10/);
 assert.match(ui,/if\(passwordSetupMode\)\{/);
 assert.match(ui,/await load\(\);\s*notice\('Passwort erfolgreich eingerichtet/);
 assert.match(page,/id="pyramid-password-setup-form"/);
 assert.match(page,/autocomplete="new-password"/);
 assert.match(page,/pyramid-password-setup-save/);
 assert.match(page,/id="pyramid-password-change"/);
});

test('after authentication the join panel is prominent and new accounts can request any active ladder',()=>{
 const join=page.indexOf('id="pyramid-join-panel"');
 const overview=page.indexOf('id="pyramid-overview"');
 assert.ok(join>=0&&overview>join,'Join panel should come before the board for new accounts');
 assert.match(page,/Jetzt Teilnahme beantragen/);
 assert.match(ui,/renderJoin\(\)/);
 assert.match(ui,/pyramid_request_join/);
 assert.match(ui,/hidden\('pyramid-join-panel',!ladder\|\|!!me\)/);
 assert.match(migration,/create or replace function public\.pyramid_approve_join/);
 assert.match(rules,/function canChallenge/);
});

test('access email is protected by existing Cloudflare and Gmail, while password is never sent to the email service',()=>{
 assert.match(mail,/TURNSTILE_SECRET_KEY/);
 assert.match(mail,/pyramid_access_link_allow/);
 assert.match(mail,/GMAIL_REFRESH_TOKEN/);
 assert.match(mail,/client\.auth\.admin\.generateLink/);
 assert.doesNotMatch(mail,/client\.auth\.admin\.updateUserById/);
 assert.doesNotMatch(mail,/new_password\s*:/);
});
