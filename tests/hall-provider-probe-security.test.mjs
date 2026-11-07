import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/hall-provider-probe.yml', 'utf8');
const probe = readFileSync('scripts/probe-hall-providers.mjs', 'utf8');

test('provider probe receives secrets only outside pull requests', () => {
  assert.match(workflow, /environment: hallenfinder/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request:/);
  for (const venue of ['SPORTTRAUM', 'ROTHOF', 'HAAR', 'ASCHHEIM', 'KIRCHHEIM']) {
    assert.match(workflow, new RegExp(`HALL_${venue}`));
  }
});

test('future push runs collect public values without repeating password attempts', () => {
  assert.match(workflow, /HALL_PROBE_ATTEMPT_LOGIN:/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(probe, /const attemptLogin = process\.env\.HALL_PROBE_ATTEMPT_LOGIN === 'true'/);
  assert.match(probe, /if \(attemptLogin\)/);
});

test('provider probe never books, screenshots, traces or logs credential values', () => {
  assert.match(probe, /bookingAttempted: false/);
  assert.doesNotMatch(probe, /screenshot|tracing|storageState|console\.log\([^\n]*(username|password)/i);
  assert.doesNotMatch(workflow, /pull_request_target/);
});

test('provider security challenges are reported without attempting a bypass', () => {
  assert.match(probe, /blocked_by_provider_security/);
  assert.match(probe, /no bypass attempted/i);
  assert.doesNotMatch(probe, /turnstile[^\n]*(click|check)|captcha[^\n]*(solve|token)/i);
});

test('sanitized report is short-lived and contains useful availability fields', () => {
  assert.match(probe, /values: safeAvailability/);
  assert.match(probe, /slot\.av\[data-begin\]/);
  assert.match(workflow, /retention-days: 3/);
  assert.match(workflow, /artifacts\/hall-provider-probe\/report\.json/);
});
