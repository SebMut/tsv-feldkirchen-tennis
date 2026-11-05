import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../src/pages/admin/index.astro',import.meta.url),'utf8');
const code=readFileSync(new URL('../src/scripts/admin.ts',import.meta.url),'utf8');
const advanced=readFileSync(new URL('../src/scripts/admin-advanced.ts',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/admin-users/index.ts',import.meta.url),'utf8');
const inline=page.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline,'Early, synchronous callback capture must exist');

function simulate(hash,search=''){
  const storage=new Map();
  vm.runInNewContext(inline,{URLSearchParams,location:{hash,search},sessionStorage:{
    setItem:(k,v)=>storage.set(k,v),
    getItem:k=>storage.get(k)||null,
  }});
  return storage;
}

test('password setup intent survives Supabase JS consumption of one-time URL hash',()=>{
  assert.equal(simulate('#type=invite&access_token=fake-token').get('tsv-admin-password-flow'),'invite');
  assert.equal(simulate('#access_token=fake-token&type=recovery').get('tsv-admin-password-flow'),'recovery');
  assert.equal(simulate('','?type=recovery&code=fake-code').get('tsv-admin-password-flow'),'recovery');
  assert.equal(simulate('#type=invite').size,0,'an unverified URL parameter alone must not mark the browser as in recovery');
  assert.equal(simulate('#type=signup&access_token=fake-token').size,0);
  assert.doesNotMatch(inline,/sessionStorage\.setItem\([^)]*(access_token|refresh_token)/);
  assert.match(code,/sessionStorage\.getItem\('tsv-admin-password-flow'\)/);
  assert.match(code,/if \(requiresPasswordSetup\) showPasswordSetup\(data\.session\.user\)/);
  assert.match(code,/event === 'PASSWORD_RECOVERY'/);
  assert.match(code,/event === 'SIGNED_IN' && requiresPasswordSetup/);
});

test('password setup clears pending flow only after password update succeeds',()=>{
  const update=code.indexOf('await supabase.auth.updateUser({ password })',code.indexOf("export async function initAdmin"));
  const clear=code.indexOf('clearPasswordFlow();',update);
  const start=code.indexOf('await startApp(data.user)',update);
  assert.ok(update>=0 && clear>update && start>clear);
  assert.match(code,/else if \(requiresPasswordSetup\)[\s\S]*?clearPasswordFlow\(\)/);
  assert.match(page,/id="password-setup-form"/);
  assert.match(page,/minlength="12"/);
});

test('SuperAdmins can resend password links to confirmed users without deleting roles',()=>{
  const card=advanced.match(/<div class="actions" style="margin-top:12px">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(card?.includes('data-send-access'));
  assert.ok(!card?.includes("user.last_sign_in_at ? ''"),'Do not hide the password reset button merely because a one-time link was opened');
  assert.match(advanced,/Neuen Passwort-Link senden/);
  assert.match(advanced,/Bitte erst den Posteingang prüfen/);
  assert.match(edge,/if \(action === "send_access_mail"\)/);
  assert.match(edge,/admin\.auth\.resetPasswordForEmail\(profile\.email/);
  assert.match(edge,/PRODUCTION_ADMIN_URL/);
  assert.doesNotMatch(advanced,/Zugangs-Mail wurde gesendet\./);
});

test('rate limits and duplicate mail link warnings appear in both recovery routes',()=>{
  assert.match(code,/rate limit\|too many\|security purposes/);
  assert.match(code,/Spamordner/);
  assert.match(code,/nur einmal öffnen/);
  assert.match(page,/Passwort vergessen\?/);
  assert.match(edge,/code: "email_rate_limit"/);
});
