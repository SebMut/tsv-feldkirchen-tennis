import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../scripts/btv-meeting-report-audit.mjs',import.meta.url),'utf8');
const wf=readFileSync(new URL('../.github/workflows/btv-meeting-report-audit.yml',import.meta.url),'utf8');

test('only authorized TSV meeting IDs and the official PDF type',()=>{
  assert.match(script,/12696831/);
  assert.match(script,/dokument','MeetingReportFOP'/);
  assert.match(script,/u\.origin!=='https:\/\/btv\.liga\.nu'/);
  assert.match(script,/REPORT_NOT_PDF/);
  assert.match(script,/TSV\\s\+Feldkirchen/);
});
test('no private names or raw PDF blobs may go into public logs',()=>{
  assert.match(script,/BTV_REPORT_RAW_TRANSFER=NONE/);
  assert.doesNotMatch(script,/console\.log\(content\)|console\.log\(validLines\)|console\.log\(bytes\)/);
  assert.doesNotMatch(script,/SUPABASE|writeFileSync\('.*\.json'|upload-artifact/);
});
test('workflow is read-only with no credentials on pull requests',()=>{
  assert.match(wf,/github\.ref == 'refs\/heads\/main'/);
  assert.match(wf,/github\.event_name == 'push'/);
  assert.doesNotMatch(wf,/secrets\.|upload-artifact|schedule:/);
});
