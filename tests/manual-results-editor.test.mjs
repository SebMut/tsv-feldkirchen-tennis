import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../verwaltung/ergebnisse/index.html',import.meta.url),'utf8');
const sql = readFileSync(new URL('../scripts/sql/manual-results-entry-schema.sql',import.meta.url),'utf8');

test('results editor has valid inline JavaScript syntax',()=>{
  const module = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(module,'inline ESM script expected');
  const statements=module.replace(/^\s*import\s+\{[^;]+;\s*/,'');
  assert.doesNotThrow(()=>new Function(statements));
});

test('correct Supabase project and safe, non-privileged browser key',()=>{
  assert.match(html,/eaurnufdochjapfzqwvm\.supabase\.co/);
  assert.match(html,/sb_publishable_/);
  assert.doesNotMatch(html,/sb_secret_|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test('manual entries never write directly to official BTV records',()=>{
  assert.match(html,/from\("manual_match_results"\)/);
  assert.match(html,/from\("manual_editable_matches"\)/);
  // Prüfe tatsächlich verbotene Datenbank-Schreibmethoden, nicht JavaScript-Ternaries.
  // "m.btv_result_text:saved..." ist Teil eines bedingten Anzeigeausdrucks und kein UPDATE.
  assert.doesNotMatch(
    html,
    /\.from\(\s*["']matches["']\s*\)\s*\.\s*(?:update|insert|upsert|delete)\s*\(/
  );
  const payload = html.match(/const\s+payload\s*=\s*\{([^}]+)\}/)?.[1];
  assert.ok(payload, 'manual result write payload must exist');
  assert.doesNotMatch(payload, /\bbtv_result_text\s*:/);
  assert.match(html,/manual_pending|amtlich bestätigt/i);
  assert.match(html,/Heim-Punkte/);
  assert.match(html,/Gast-Punkte/);
  assert.match(html,/0:0/);
});

test('backend separates official and manual results and enforces RLS',()=>{
  assert.match(sql,/CREATE TABLE public\.manual_match_results/i);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql,/private\.can_edit_team_season/);
  assert.match(sql,/WITH \(security_invoker=true\)/i);
  assert.match(sql,/REVOKE ALL ON public\.manual_match_results FROM PUBLIC, anon, authenticated/i);
  assert.match(sql,/GRANT SELECT ON public\.manual_match_results TO authenticated/i);
  assert.doesNotMatch(sql,/GRANT (?:INSERT|UPDATE|DELETE|ALL) ON public\.manual_match_results TO anon/i);
  assert.doesNotMatch(sql,/UPDATE public\.matches/i);
});
