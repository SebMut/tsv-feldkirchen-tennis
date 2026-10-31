import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../scripts/btv-roster-discovery.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/btv-roster-discovery.yml', import.meta.url), 'utf8');

test('probe accepts only the BTV and nuLiga HTTPS hosts', () => {
  assert.match(code, /ALLOWED_HOSTS = new Set/);
  assert.match(code, /'tende-id.liga.nu'/);
  assert.match(code, /url\.protocol === 'https:' && ALLOWED_HOSTS\.has\(url\.hostname\)/);
  assert.match(code, /await context\.route\('\*\*\/\*'/);
  assert.match(code, /route\.abort\(\)/);
});

test('probe confirms TSV club and club number before navigating to Downloads', () => {
  assert.match(code, /const CLUB =/);
  assert.match(code, /01012/);
  assert.match(code, /confirmClub\(context\)/);
  assert.match(code, /TSV_SCOPE_NOT_CONFIRMED/);
  assert.match(code, /openDownloads\(clubPage\)/);
});

test('read-only operation does not download data or record secrets', () => {
  assert.match(code, /acceptDownloads: false/);
  assert.match(code, /BTV_ROSTER_TRANSFER=NONE/);
  assert.doesNotMatch(code, /(?:screenshot|storageState|saveAs|writeFile|createClient)\s*\(/i);
  assert.doesNotMatch(code, /console\.(?:log|warn|error)\([^)]*(?:USERNAME|PASSWORD|text|body)/);
  assert.match(code, /UNEXPECTED_PDF_LINK/);
});

test('user-controlled Secrets can run only on trusted main, never on pull requests', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.event_name != 'pull_request'/);
  assert.match(workflow, /github\.repository == 'SebMut\/tsv-feldkirchen-tennis'/);
  assert.match(workflow, /secrets\.BTV_LOGIN_USERNAME/);
  assert.match(workflow, /secrets\.BTV_LOGIN_PASSWORD/);
  assert.doesNotMatch(workflow, /cron:|schedule:/);
});

test('does not write PDFs, credentials or people data to a GitHub artifact', () => {
  assert.doesNotMatch(workflow, /uses:.*upload-artifact|git push|supabase/i);
  assert.match(code, /BTV_NMM_DOWNLOAD=AVAILABLE/);
  assert.match(code, /BTV_SUMMER_2026_LISTED=/);
  assert.match(code, /BTV_WINTER_2026_27_LISTED=/);
});
