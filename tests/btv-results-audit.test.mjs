import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../scripts/btv-results-audit.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/btv-results-verification.yml',import.meta.url),'utf8');

test('read-only source checks the 15 known winter TSV matches',()=>{
  assert.match(script,/code:'winter-2026-2027', expected:15/);
  assert.match(script,/get:getWinterSchedule/);
  assert.doesNotMatch(script,/sommer-2026|getClubSchedule/);
});
test('do not infer results from old fixture dates or emit private player data',()=>{
  assert.match(script,/const score = f\.score/);
  assert.match(script,/BTV_RESULTS_PUBLISHED=/);
  assert.doesNotMatch(script,/@supabase|\.from\('matches'\)|process\.env\.SUPABASE|secretKey/);
  assert.doesNotMatch(workflow,/secrets\.|BTV_SUPABASE_SECRET_KEY|upload-artifact/);
});
test('GH workflow verifies public official PDFs and never writes database',()=>{
  assert.match(workflow,/node scripts\/btv-results-audit\.mjs/);
  assert.match(workflow,/poppler-utils/);
  assert.match(workflow,/contents: read/);
});
