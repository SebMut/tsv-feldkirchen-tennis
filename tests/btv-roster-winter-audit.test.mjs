import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../scripts/btv-roster-winter-audit.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/btv-roster-winter-audit.yml',import.meta.url),'utf8');

test('only verified TSV 01012 winter 2026/27 nMM may pass',()=>{
  assert.match(source,/Winter\\s\\*2026/);
  assert.match(source,/WINTER_NMM_CLUB_OR_SEASON_MISMATCH/);
  assert.match(source,/01012/);
  assert.match(source,/WINTER_NMM_MULTIPLE_LINKS/);
  assert.match(source,/WINTER_NMM_ORIGIN_NOT_ALLOWED/);
  assert.match(source,/ALLOWED_HOSTS.has\\(url.hostname\\)/);
});

test('winter audit never runs a roster importer or a write operation',()=>{
  assert.match(source,/WINTER_IMPORT_NOT_ENABLED/);
  assert.match(source,/BTV_WINTER_NMM_DATA_TRANSFER=NONE/);
  assert.doesNotMatch(source,/importVerifiedPrivateRosters|createClient\\(|SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(source,/upload-artifact|screenshot\\(|storageState\\(|writeFileSync\\(/);
  assert.match(source,/raw.subarray\\(0,4\\).toString\\('ascii'\\) !== '%PDF'/);
});

test('only fixed counts and statuses are logged, never names, PDFs or URLs',()=>{
  assert.match(source,/BTV_WINTER_NMM_PAGES=/);
  assert.match(source,/BTV_WINTER_NMM_NUMBERED_ROWS=/);
  assert.match(source,/console.log\\('BTV_WINTER_NMM_DATA_TRANSFER=NONE'\\)/);
  assert.doesNotMatch(source,/console\\.(?:log|warn|error)\\(\\s*(?:text|raw|href|url|lines)/);
});

test('secrets cannot be used in pull request and no recurring login is scheduled',()=>{
  assert.match(workflow,/github.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/github.event_name != 'pull_request'/);
  assert.match(workflow,/secrets.BTV_LOGIN_USERNAME/);
  assert.match(workflow,/secrets.BTV_LOGIN_PASSWORD/);
  assert.doesNotMatch(workflow,/secrets.BTV_SUPABASE_SECRET_KEY|upload-artifact/);
  assert.doesNotMatch(workflow,/schedule:|cron:/);
});
