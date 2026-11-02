import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const edge=read('supabase/functions/admin-users/index.ts');
const ui=read('src/scripts/admin-advanced.ts');
const css=read('src/styles/global.css');

test('server permission audit accepts only a superadmin caller and reads persisted roles',()=>{
  assert.match(edge,/caller\?\.global_role !== "super_admin"/);
  const block=edge.split('if (action === "audit_permissions") {')[1].split('if (action === "invite")')[0];
  assert.match(block,/select\("id,global_role,global_permissions"\)/);
  assert.match(block,/select\("team_id,role,active"\)/);
  assert.match(block,/\.filter\(m => m\.active\)/);
  assert.match(block,/role === "manager" \|\| role === "editor"/);
  assert.match(block,/globalTicker \|\| role === "manager" \|\| role === "editor" \|\| role === "ticker"/);
  assert.match(block,/checked_at: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(block,/signIn|update\(|insert\(|delete\(|set_role/);
});
test('user matrix has five distinct actions and an explicit read-only server check',()=>{
  for(const label of ['Mannschaft bearbeiten','Kader bearbeiten','Liveticker','News','Veranstaltungen','Rechte testen (Server)'])
    assert.ok(ui.includes(label),label);
  assert.match(ui,/data-user-rights-matrix/);
  assert.match(ui,/role="status" aria-live="polite"/);
  assert.match(ui,/action: 'audit_permissions'/);
  assert.match(ui,/renderPermissionMatrix\(data\.teams\)/);
  assert.match(css,/\.permission-matrix__scroll\{max-width:100%;overflow-x:auto/);
  assert.match(css,/\.user-permission-audit>summary:focus-visible/);
});
