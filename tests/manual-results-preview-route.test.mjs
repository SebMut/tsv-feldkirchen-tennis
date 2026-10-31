import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../public/verwaltung/ergebnisse/index.html', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../src/pages/admin/index.astro', import.meta.url), 'utf8');
const audit = readFileSync(new URL('../scripts/audit-built-site.mjs', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../src/pages/sw.js.ts', import.meta.url), 'utf8');

test('preview source actually contains the result-entry route', () => {
  assert.match(page, /<title>Ergebnisse nachtragen/);
  assert.match(page, /<html lang="de"/);
  assert.match(page, /<meta name="description"/);
  assert.match(page, /<link rel="canonical"/);
  assert.match(page, /<meta name="robots" content="noindex,nofollow"/);
  assert.match(audit, /'\/verwaltung\/ergebnisse\/'/);
  assert.match(audit, /verwaltung\/ergebnisse\/index\.html/);
});

test('admin quickstart links to the real preview route', () => {
  assert.match(admin, /href="\/verwaltung\/ergebnisse\/"/);
  assert.match(worker, /BASE\+'verwaltung\/'/);
});

test('result-entry form uses protected Supabase data without official overwrites', () => {
  assert.match(page, /eaurnufdochjapfzqwvm\.supabase\.co/);
  assert.match(page, /sb_publishable_/);
  assert.doesNotMatch(page, /sb_secret_|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(page, /from\("manual_editable_matches"\)/);
  assert.match(page, /from\("manual_match_results"\)/);
  assert.doesNotMatch(page, /\.from\(\s*["']matches["']\s*\)\s*\.\s*(?:update|insert|upsert|delete)\s*\(/);
  const payload = page.match(/const\s+payload\s*=\s*\{([^}]+)\}/)?.[1];
  assert.ok(payload);
  assert.doesNotMatch(payload, /\bbtv_result_text\s*:/);
  const module = page.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(module);
  const script = module.replace(/^\s*import\s+\{[^;]+;\s*/, '');
  assert.doesNotThrow(() => new Function(script));
});
