import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const rls = read('supabase/migrations/20261102193000_enforce_exact_role_capabilities.sql');
const rpc = read('supabase/migrations/20261102194500_fix_atomic_permissions_service_claim.sql');
const admin = read('src/scripts/admin.ts');
const manage = read('src/scripts/admin-advanced.ts');
const page = read('src/pages/admin/index.astro');
const edge = read('supabase/functions/admin-users/index.ts');

test('global News and Events writes require the explicit global capability', () => {
  for (const table of ['news', 'events']) {
    for (const operation of ['insert', 'update', 'delete']) {
      assert.ok(rls.includes('create policy ' + table + '_' + operation), table + ' ' + operation);
    }
    const block = rls.slice(rls.indexOf('drop policy if exists ' + table + '_insert'), rls.indexOf('drop policy if exists ' + table + '_authenticated_read'));
    assert.match(block, new RegExp("private\\.has_global_permission\\('" + table + "'\\)"));
    assert.doesNotMatch(block, /can_edit_team/);
    assert.doesNotMatch(block, /can_tick_team/);
  }
  assert.ok(admin.includes("const canNews = hasGlobalPermission('news')"));
  assert.ok(admin.includes("if(!hasGlobalPermission('news'))return status("));
  assert.ok(admin.includes("if(eventStart&&!hasGlobalPermission('events'))"));
  assert.ok(admin.includes("if(!hasGlobalPermission('news')){target.textContent="));
});

test('tickers cannot manage team, roster, gallery, or editorial image storage', () => {
  const galleryStart = rls.indexOf('create or replace function private.can_manage_gallery');
  const galleryEnd = rls.indexOf('drop policy if exists galleries_insert', galleryStart);
  assert.ok(galleryStart >= 0 && galleryEnd > galleryStart);
  assert.doesNotMatch(rls.slice(galleryStart,galleryEnd), /can_tick_match/);
  assert.ok(rls.includes('private.can_edit_team(g.team_id)'));
  assert.ok(rls.includes('private.can_edit_team(match_team)'));
  assert.ok(rls.includes("return private.has_global_permission('events')"));
  assert.ok(rls.includes("return private.has_global_permission('news')"));
  assert.ok(rls.includes("if 'news' = any(parts) then"));
  assert.ok(page.includes('data-panel="teams" data-editor-only'));
  assert.ok(page.includes('data-panel="players" data-editor-only'));
  assert.ok(page.includes('data-panel="matches" data-ticker-only'));
  assert.ok(page.includes('data-admin-jump="news" data-editorial-only'));
});

test('one atomic backend operation assigns both team roles and global checkboxes', () => {
  assert.ok(manage.includes("action: 'save_permissions'"));
  assert.doesNotMatch(manage, /action: 'set_role'/);
  assert.doesNotMatch(manage, /action: 'memberships'/);
  assert.ok(manage.includes("result.data?.ok !== true"));
  assert.ok(manage.includes('saveButton.disabled = true'));
  assert.ok(edge.includes('if (action === "save_permissions")'));
  assert.ok(edge.includes('admin.rpc("admin_apply_user_permissions"'));
  assert.ok(edge.includes('desired_memberships:memberships'));
  assert.ok(rpc.includes("(auth.jwt()->>'role') is distinct from 'service_role'"));
  assert.ok(rls.includes('revoke all on function public.admin_apply_user_permissions'));
  assert.ok(rls.includes('to service_role;'));
  assert.ok(rpc.includes('delete from public.team_memberships where user_id=target_user'));
  assert.ok(rpc.includes('where id=target_user for update'));
});

test('permissions revocations appear in already-open tabs without requiring new login', () => {
  assert.ok(admin.includes('function watchPermissionChanges()'));
  assert.ok(admin.includes("supabase.from('profiles').select('global_role,global_permissions')"));
  assert.ok(admin.includes("supabase.from('team_memberships').select('team_id,role,active,user_id')"));
  assert.ok(admin.includes('window.location.reload()'));
  assert.ok(admin.includes('watchPermissionChanges();'));
});

test('invitation describes global grants separately from team grants', () => {
  assert.ok(page.includes('News und Veranstaltungen benötigen separate globale Rechte'));
  assert.ok(page.includes('Keine Mannschafts-, Kader-, News-, Veranstaltungs- oder Galerieverwaltung'));
  assert.ok(page.includes('Kalendertermine benötigen zusätzlich die globale Veranstaltungsberechtigung'));
  assert.ok(page.includes('data-invite-permission value="ticker"'));
  assert.ok(page.includes('data-invite-permission value="events"'));
  assert.ok(page.includes('data-invite-permission value="news"'));
});
