import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const admin = read('src/scripts/admin.ts');
const editing = read('src/scripts/admin-advanced.ts');
const edge = read('supabase/functions/admin-users/index.ts');
const migration = read('supabase/migrations/20261102195500_preserve_team_memberships_on_role_save.sql');

test('editing roles is one verified database transaction instead of separate role and membership operations', () => {
  assert.match(editing, /action: 'save_permissions'/);
  assert.doesNotMatch(editing, /action: 'set_role'/);
  assert.doesNotMatch(editing, /action: 'memberships'/);
  assert.match(edge, /admin\.rpc\("admin_apply_user_permissions"/);
  assert.match(edge, /select\("global_role,global_permissions"\)/);
  assert.match(edge, /select\("team_id,role,active"\)/);
  assert.match(edge, /saved\.global_role === globalRole/);
  assert.match(edge, /normalize\(actualMembers\) === normalize\(wantedMemberships\)/);
  assert.match(edge, /ok:true,verified:true/);
  assert.match(editing, /result\.data\?\.verified !== true/);
});

test("failed role edits retain the user selections for retry instead of silently discarding them", () => {
  const section = editing.slice(editing.indexOf("action: 'save_permissions'"), editing.indexOf("reportStatus('Alle Rechte und Mannschaftsrollen wurden gespeichert"));
  assert.match(section, /return; \/\/ Keep unsaved selections visible/);
  assert.doesNotMatch(section, /loadAdvancedUsers\(base\)/);
  assert.match(editing, /saveButton\.disabled = true/);
  assert.match(editing, /saveButton\.disabled = false/);
});

test('new team assignments default to ticker, not team or roster editor', () => {
  assert.match(admin, /<option value="ticker" selected>Nur Liveticker \(Standard\)<\/option>/);
  assert.doesNotMatch(admin, /<option value="editor" selected>Editor<\/option>/);
  assert.match(editing, /!membership \|\| membership\.role === 'ticker'/);
  assert.doesNotMatch(editing, /!membership \|\| membership\.role === 'editor'/);
  assert.match(editing, /membership\?\.role === 'manager'/);
  assert.match(editing, /membership\?\.role === 'editor'/);
});

test('updating existing team roles preserves membership IDs and original timestamps', () => {
  assert.match(migration, /create or replace function public\.admin_apply_user_permissions/i);
  assert.match(migration, /delete from public\.team_memberships tm/);
  assert.match(migration, /not exists\(/);
  assert.match(migration, /on conflict \(user_id,team_id\) do update/);
  assert.match(migration, /where tm\.role is distinct from excluded\.role or not tm\.active/);
  assert.doesNotMatch(migration, /delete from public\.team_memberships where user_id=target_user;/);
});
