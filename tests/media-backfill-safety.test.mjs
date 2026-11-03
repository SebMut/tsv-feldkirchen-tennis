import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('superadmin media remediation uses existing central uploader and never removes old shared files',()=>{
  const code=file('src/scripts/media-backfill-admin.ts');
  assert.match(code,/uploadImageToMedia/);
  assert.match(code,/media\.download\(item\.oldPath\)/);
  assert.match(code,/\.eq\(item\.field, item\.oldPath\)/);
  assert.match(code,/uploaded = null; \/\/ Referenced new object must never be removed/);
  assert.doesNotMatch(code,/media\.remove\(\[item\.oldPath\]\)/);
});
test('only operations panel can initiate an authenticated historical image repair',()=>{
  const html=file('src/pages/admin/index.astro');
  const monitor=file('src/scripts/system-monitor.ts');
  assert.match(html,/id="ops-media-analyze"/);
  assert.match(html,/id="ops-media-optimize" disabled/);
  assert.match(monitor,/if \(!isSuper\) return/);
  assert.match(monitor,/initMediaBackfillAdmin\(\)/);
  assert.match(html,/id="panel-operations" class="admin-panel" data-super-only/);
});
