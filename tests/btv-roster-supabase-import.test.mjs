import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('new memberships are always private; import never runs from pushes or PRs', () => {
  const code = readFileSync(new URL('../scripts/btv-roster-supabase-import.mjs', import.meta.url),'utf8');
  const workflow = readFileSync(new URL('../.github/workflows/btv-roster-private-import.yml', import.meta.url),'utf8');
  assert.match(code, /public_visible:false/);
  assert.match(code, /ROSTER_WRITE_NOT_ENABLED/);
  assert.match(code, /eaurnufdochjapfzqwvm/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.doesNotMatch(workflow, /github\.event_name == 'push'/);
  assert.match(workflow, /BTV_SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(workflow, /upload-artifact/);
  // Scheduled weekly runs from March (season from 2027).
  assert.match(workflow, /cron: '37 5 \* 3-9 1'/);
});
