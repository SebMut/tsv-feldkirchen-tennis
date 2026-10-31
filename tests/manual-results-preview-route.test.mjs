import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../public/verwaltung/ergebnisse/index.html', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../src/pages/admin/index.astro', import.meta.url), 'utf8');
const adminScript = readFileSync(new URL('../src/scripts/admin.ts', import.meta.url), 'utf8');
const manualScript = readFileSync(new URL('../src/scripts/manual-results-admin.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261031195000_manual_results_superadmin_only.sql', import.meta.url), 'utf8');
const audit = readFileSync(new URL('../scripts/audit-built-site.mjs', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../src/pages/sw.js.ts', import.meta.url), 'utf8');

test('legacy standalone URL redirects to native admin without a second design', () => {
  assert.match(page, /<html lang="de"/);
  assert.match(page, /name="robots" content="noindex,nofollow"/);
  assert.match(page, /\.\.\/\.\.\/admin\/\?panel=manual-results/);
  assert.doesNotMatch(page, /from\(["']manual_match_results["']\)/);
  assert.match(audit, /'\/verwaltung\/ergebnisse\/'/);
  assert.match(audit, /verwaltung\/ergebnisse\/index\.html/);
});

test('manual results UI is a native TSV admin panel restricted to SuperAdmin', () => {
  assert.match(admin, /data-panel="manual-results" data-super-only/);
  assert.match(admin, /id="panel-manual-results" class="admin-panel" data-super-only/);
  assert.match(admin, /id="manual-result-form"/);
  assert.match(admin, /href="\/admin\/\?panel=manual-results"/);
  assert.match(adminScript, /if \(name === 'manual-results' && !state\.isSuper\) return/);
  assert.match(adminScript, /if \(state\.isSuper\) \{\s*initManualResultsPanel\(\)/);
  assert.match(worker, /BASE\+'verwaltung\/'/);
});

test('manual records stay separate from official BTV and require SuperAdmin RLS', () => {
  assert.match(manualScript, /from\('manual_editable_matches'\)/);
  assert.match(manualScript, /from\('manual_match_results'\)/);
  assert.doesNotMatch(manualScript, /\.from\(\s*["']matches["']\s*\)\s*\.\s*(?:update|insert|upsert|delete)\s*\(/);
  const payload = manualScript.match(/const\s+payload\s*=\s*\{([^}]+)\}/)?.[1];
  assert.ok(payload);
  assert.doesNotMatch(payload, /\bbtv_result_text\s*:/);
  assert.match(migration, /CREATE POLICY manual_results_authorized_read[\s\S]*?USING \(private\.is_super_admin\(\)\)/);
  assert.match(migration, /CREATE POLICY manual_results_authorized_insert[\s\S]*?private\.is_super_admin\(\)/);
  assert.match(migration, /CREATE POLICY manual_results_authorized_update[\s\S]*?private\.is_super_admin\(\)/);
  assert.match(migration, /WITH \(security_invoker = true\)/);
  assert.match(migration, /WHERE private\.is_super_admin\(\)/);
});
