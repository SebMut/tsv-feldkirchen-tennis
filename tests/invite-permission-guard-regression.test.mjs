import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261104130500_fix_service_role_global_permissions_trigger.sql',import.meta.url),'utf8');
test('user invitations may update permissions with server service role without exposing private schema',()=>{
  assert.match(sql,/create or replace function private\.guard_global_permissions_update\(\)/);
  assert.match(sql,/if current_user = 'service_role' then\s+return new;/);
  assert.match(sql,/if not private\.is_super_admin\(\) then/);
  assert.doesNotMatch(sql,/grant usage on schema private to service_role/i);
  assert.match(sql,/revoke all on function private\.guard_global_permissions_update\(\) from public, anon, authenticated;/);
});
