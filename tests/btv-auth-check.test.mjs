import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../scripts/btv-auth-check.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/btv-auth-check.yml', import.meta.url), 'utf8');

test('only exact approved BTV and nuLiga domains may receive browser requests', () => {
  assert.match(script, /ALLOWED_HOSTS = new Set/);
  assert.match(script, /'tende-id.liga.nu'/);
  assert.match(script, /url\.protocol === 'https:' && ALLOWED_HOSTS\.has\(url\.hostname\)/);
  assert.match(script, /route\.abort\(\)/);
});

test('credentials are used only in browser inputs and are never logged', () => {
  assert.match(script, /process\.env\.BTV_LOGIN_USERNAME/);
  assert.match(script, /process\.env\.BTV_LOGIN_PASSWORD/);
  assert.match(script, /await email\.fill\(username\)/);
  assert.match(script, /await pw\.fill\(password\)/);
  assert.doesNotMatch(script, /console\.(?:log|warn|error)\([^)]*(?:username|password)/i);
  assert.doesNotMatch(script, /(?:screenshot|storageState|writeFile|saveAs|download\.saveAs)\s*\(/);
});

test('probe is read-only, without silent retries or bypassing interactive checks', () => {
  assert.match(script, /acceptDownloads: false/);
  assert.match(script, /stop\('LOGIN_NOT_CONFIRMED'\)/);
  assert.match(script, /BTV_DATA_TRANSFER=NONE/);
  assert.doesNotMatch(script, /(?:captcha\\.solve|createClient\\(|retry\\s*\\()/i);
});

test('pull requests run only syntax and safety tests, never the secret-powered job', () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.event_name != 'pull_request'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.repository == 'SebMut\/tsv-feldkirchen-tennis'/);
  assert.match(workflow, /secrets\.BTV_LOGIN_USERNAME/);
  assert.match(workflow, /secrets\.BTV_LOGIN_PASSWORD/);
  assert.doesNotMatch(workflow, /schedule:/);
});

test('no browser recordings, artifacts or person-identifying logs', () => {
  assert.doesNotMatch(workflow, /uses:.*(?:upload-artifact|deploy-pages)|git push|npx playwright codegen/i, 'no file uploads or repository pushes in the workflow');
  assert.doesNotMatch(script, /console\.log\(.*body/);
  assert.match(script, /console\.log\('BTV_AUTH_CHECK=SUCCESS'\)/);
  assert.match(script, /BTV_DOWNLOADS_VISIBLE=/);
});
