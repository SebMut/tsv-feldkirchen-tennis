import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const admin=read('src/pages/admin/index.astro');
const monitor=read('src/scripts/system-monitor.ts');
const edge=read('supabase/functions/admin-users/index.ts');
const sql=read('supabase/migrations/20261103090000_admin_system_integrity.sql');
const browser=read('scripts/browser-qa.mjs');
const lighthouse=read('scripts/lighthouse-audit.mjs');
const backup=read('.github/workflows/backup-restore-drill.yml');

test('system health stays superadmin-only in edge function and SQL',()=>{
  assert.match(admin,/data-panel="operations" data-super-only/);
  assert.match(admin,/id="panel-operations" class="admin-panel" data-super-only/);
  assert.match(edge,/caller\?\.global_role !== "super_admin"/);
  assert.match(edge,/if \(action === "system_health"\)/);
  assert.match(edge,/admin\.rpc\("admin_system_integrity"\)/);
  assert.match(sql,/coalesce\(auth\.jwt\(\)->>'role',''\) <> 'service_role'/);
  assert.match(sql,/revoke all on function public\.admin_system_integrity\(\) from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.admin_system_integrity\(\) to service_role/);
});
test('integrity checks do not mutate storage or BTV data',()=>{
  assert.match(sql,/storage\.objects o on o\.bucket_id='media' and o\.name=r\.path/);
  assert.match(sql,/cron\.job_run_details/);
  assert.match(sql,/cron_failures_24h/);
  assert.doesNotMatch(sql,/\b(delete from|truncate|update public\.|insert into public\.)\b/i);
  assert.match(monitor,/body:\{action:'system_health'\}/);
  assert.match(monitor,/missing_media_count/);
  assert.match(monitor,/btv_last_success/);
});
test('backup check cannot be silently marked successful without real admin confirmation',()=>{
  assert.match(edge,/if \(action === "record_restore_check"\)/);
  assert.match(edge,/body\.confirmed !== true/);
  assert.match(edge,/is_public: false/);
  assert.match(admin,/id="ops-restore-confirmed" type="checkbox" required/);
  assert.match(monitor,/body:\{action:'record_restore_check',confirmed:/);
  assert.match(backup,/TSV_BACKUP_DB_URL/);
  assert.match(backup,/pg_restore/);
  assert.match(backup,/SOURCE_COUNT/);
  assert.match(backup,/RESTORED_COUNT/);
  assert.match(backup,/trap 'rm -f/);
});
test('mobile and accessibility reports run at realistic small widths',()=>{
  assert.match(browser,/name:'small-mobile',viewport:\{width:320,height:640\}/);
  assert.match(browser,/keyboard focus and escape navigation/);
  assert.match(lighthouse,/['"]startseite['"]/);
  assert.match(lighthouse,/['"]aktuelles['"]/);
  assert.match(lighthouse,/['"]spieltag['"]/);
  assert.match(lighthouse,/largest-contentful-paint/);
  assert.match(lighthouse,/cumulative-layout-shift/);
});
