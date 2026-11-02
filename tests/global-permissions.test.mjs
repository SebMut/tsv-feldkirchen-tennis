import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const sql = read('supabase/migrations/20261102155000_global_content_permissions.sql');
const edge = read('supabase/functions/admin-users/index.ts');
const admin = read('src/scripts/admin.ts');
const editor = read('src/scripts/admin-advanced.ts');
const page = read('src/pages/admin/index.astro');
const events = read('src/scripts/event-rsvp-admin.ts');

test('three independent global capabilities are selectable for invitations and existing users', () => {
  for (const [id, label] of [['events','Veranstaltungen hinzufügen'],['news','News hinzufügen'],['ticker','Liveticker (alle Mannschaften)']]) {
    assert.ok(page.includes('data-invite-permission value="' + id + '"'));
    assert.ok(editor.includes("['" + id + "','" + label + "']"));
    assert.ok(edge.includes('"' + id + '"'));
  }
  assert.match(admin, /global_permissions:/);
  assert.match(editor, /data-user-permission/);
  assert.match(edge, /allowedGlobalPermissions/);
  assert.match(edge, /readGlobalPermissions\(body\.global_permissions/);
});

test('RLS grants exact global functions independently of team memberships', () => {
  assert.match(sql, /add column if not exists global_permissions text\[\]/);
  assert.match(sql, /profiles_global_permissions_allowed/);
  assert.match(sql, /guard_global_permissions_update/);
  assert.match(sql, /global_permissions = '\{\}'::text\[\]/);
  assert.match(sql, /create policy events_insert/);
  assert.match(sql, /create policy news_insert/);
  assert.match(sql, /private\.has_global_permission\('events'\)/);
  assert.match(sql, /private\.has_global_permission\('news'\)/);
  assert.match(sql, /private\.has_global_permission\('ticker'\)/);
  assert.match(sql, /private\.can_tick_match\(id\)/);
});

test('admin panel respects global permissions while preserving team-specific editing', () => {
  assert.ok(page.includes('data-panel="news" data-editorial-only'));
  assert.ok(page.includes('data-editorial-tab="events" data-events-only'));
  assert.ok(page.includes('data-panel="teams" data-editor-only'));
  assert.match(admin, /const canNews = canEditAny \|\| hasGlobalPermission\('news'\)/);
  assert.match(admin, /const canEvents = hasGlobalPermission\('events'\)/);
  assert.match(admin, /hasGlobalPermission\('ticker'\)/);
  assert.match(admin, /initEventRsvpAdmin\(\{ isSuper: canEvents/);
  assert.match(events, /const relevant = events;/);
});

test('global media write authorization is limited to existing news and events; other paths stay protected', () => {
  assert.match(sql, /if not found then return false; end if;/);
  assert.match(sql, /private\.can_write_media_path/);
  assert.match(sql, /return private\.can_edit_team\(target_team\)/);
  assert.match(admin, /directory:`news\/\$\{newsId\}`/);
});
