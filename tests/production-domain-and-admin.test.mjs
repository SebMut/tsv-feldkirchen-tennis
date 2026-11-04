import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('United Domains prioritizes Astro HTML and retains WordPress link redirects', () => {
  const apache = read('public/.htaccess');
  assert.ok(apache.includes('DirectoryIndex index.html index.php'));
  assert.ok(apache.includes('RewriteCond %{HTTP_HOST} ^tennis-tsvfeldkirchen\\.de$ [NC]'));
  assert.ok(apache.includes('https://www.tennis-tsvfeldkirchen.de%{REQUEST_URI}'));
  assert.ok(apache.includes('Redirect 301 /herrenmannschaften/ /mannschaften/'));
  assert.ok(apache.includes('Options -Indexes'));
});

test('production SFTP deployment remains explicitly gated and builds the root domain with /admin/', () => {
  const wf = read('.github/workflows/deploy-united-domains.yml');
  assert.ok(wf.includes('workflow_dispatch:'));
  assert.ok(wf.includes('refs/heads/feature/astro-supabase-foundation'));
  assert.ok(wf.includes("inputs.final_approval == 'TSV-FELDKIRCHEN-GO-LIVE'"));
  assert.ok(wf.includes("vars.TSV_GO_LIVE_APPROVED == 'true'"));
  assert.ok(wf.includes('environment: production'));
  assert.ok(wf.includes('npm test'));
  assert.ok(wf.includes('PREVIEW_BASE: /'));
  assert.ok(wf.includes("PUBLIC_PREVIEW_MODE: 'false'"));
  assert.ok(wf.includes('test -f dist/admin/index.html'));
  assert.ok(wf.includes("grep -Fq 'noindex,nofollow' dist/admin/index.html"));
  // Push-triggered diagnostics and releases still require explicit markers.
  assert.ok(wf.includes('on:\n  push:'));
  assert.ok(wf.includes('paths:\n      - .github/workflows/deploy-united-domains.yml'));
  assert.ok(wf.includes("[hosting-preflight]"));
  assert.ok(wf.includes("[hosting-deploy-approved]"));
  assert.ok(wf.includes("vars.TSV_GO_LIVE_APPROVED == 'true'"));
  assert.ok(wf.includes('BatchMode=no'));
});

test('admin authentication and email links resolve to actual site origin', () => {
  const admin=read('src/scripts/admin.ts');
  const advanced=read('src/scripts/admin-advanced.ts');
  const server=read('supabase/functions/admin-users/index.ts');
  assert.ok(admin.includes('location.origin'));
  assert.ok(admin.includes('resetPasswordForEmail(email, { redirectTo })'));
  assert.ok(advanced.includes('location.origin'));
  assert.ok(server.includes('https://www.tennis-tsvfeldkirchen.de'));
  assert.ok(server.includes('https://tennis-tsvfeldkirchen.de'));
  assert.ok(read('src/pages/admin/index.astro').includes('noindex={true}'));
});
