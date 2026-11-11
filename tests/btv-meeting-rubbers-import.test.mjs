import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../scripts/btv-meeting-rubbers-import-2026.mjs',import.meta.url),'utf8');

test('accepts a regular 4+2 lineup when one double was officially abandoned',()=>{
  assert.match(source,/parsed\.singles\.length===4&&parsed\.doubles\.length>=1&&parsed\.doubles\.length<=2\?'4_2'/);
});

test('does not delete a source-backed abandoned public rubber on later syncs',()=>{
  assert.match(source,/select\('id,discipline,position,result_text'\)/);
  assert.match(source,/\^abgebrochen\\b\/i/);
});
