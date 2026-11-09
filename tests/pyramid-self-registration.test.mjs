import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const login = read('src/pages/forderungspyramide/index.astro');
const register = read('src/pages/forderungspyramide/registrieren/index.astro');
const script = read('src/scripts/pyramid-registration.ts');
const trigger = read('supabase/migrations/20260930100011_restore_auth_profile_trigger.sql');
const member = read('src/scripts/pyramid.ts');

test('login links to direct account registration instead of password-creation email', () => {
  assert.match(login, /Noch kein Konto\? Jetzt erstellen/);
  assert.match(login, /href="\/forderungspyramide\/registrieren\/"/);
  assert.doesNotMatch(login, /id="pyramid-magic-link"/);
  assert.doesNotMatch(login, /Passwort-Link per E-Mail/);
});

test('registration collects username, email and password with confirmation', () => {
  for (const id of ['pyramid-register-name', 'pyramid-register-email', 'pyramid-register-password', 'pyramid-register-confirm']) {
    assert.match(register, new RegExp(`id="${id}"`));
  }
  assert.match(register, /Das Passwort wird nicht per E-Mail versendet/);
  assert.match(script, /supabase\.auth\.signUp\(\{/);
  assert.match(script, /data: \{ display_name: username \}/);
  assert.match(script, /emailRedirectTo/);
  assert.match(script, /captchaToken/);
  assert.doesNotMatch(script, /resetPasswordForEmail|signInWithOtp|updateUser\(\{\s*password/);
});

test('new auth users receive a standard profile without trusting metadata for roles', () => {
  assert.match(trigger, /new\.raw_user_meta_data ->> 'display_name'/);
  assert.match(trigger, /'user'/);
  assert.doesNotMatch(trigger, /raw_user_meta_data ->> 'global_role'/);
});

test('first login requires choosing a ladder before the LK dialog continues', () => {
  for (const id of ['pyramid-first-join-dialog', 'pyramid-first-join-form',
    'pyramid-first-join-ladder', 'pyramid-first-join-name']) assert.match(login, new RegExp(`id="${id}"`));
  assert.match(member, /function showFirstJoinDialog\(\)/);
  assert.match(member, /pyramid_request_join/);
  assert.match(member, /if\(!showFirstJoinDialog\(\)&&!profile\.data\?\.tennis_lk_declared_at/);
  assert.match(login, /Nach der Genehmigung erhältst du eine E-Mail/);
});
