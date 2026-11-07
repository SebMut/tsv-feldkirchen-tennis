import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  credentialGroups,
  credentialStatus,
  summaryMarkdown,
} from '../scripts/check-hall-credentials.mjs';

const workflow = readFileSync('.github/workflows/hall-credentials-check.yml', 'utf8');

test('hall login check is manual and isolated in the hallenfinder environment', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment: hallenfinder/);
  assert.doesNotMatch(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /schedule:/);
});

test('every required hall credential comes from GitHub secrets', () => {
  const fields = credentialGroups.flatMap((group) => group.fields);
  assert.equal(new Set(fields).size, 6);
  for (const field of fields) {
    assert.match(workflow, new RegExp(`${field}: \\$\\{\\{ secrets\\.${field} \\}\\}`));
  }
});

test('credential report never includes secret values', () => {
  const environment = Object.fromEntries(
    credentialGroups.flatMap((group) => group.fields).map((field) => [field, `private-${field}`]),
  );
  const report = summaryMarkdown(credentialStatus(environment));
  for (const value of Object.values(environment)) assert.ok(!report.includes(value));
  assert.equal(credentialStatus(environment).every((entry) => entry.ready), true);
});

test('empty and placeholder credentials are rejected', () => {
  const status = credentialStatus({
    HALL_EVERSPORTS_EMAIL: 'todo',
    HALL_EVERSPORTS_PASSWORD: '',
  });
  assert.equal(status[0].ready, false);
  assert.deepEqual(status[0].missing, ['HALL_EVERSPORTS_EMAIL', 'HALL_EVERSPORTS_PASSWORD']);
});
