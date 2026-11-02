import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../src/scripts/live-scorecenter.ts',import.meta.url),'utf8');
test('live score columns show only numbered set headers with accessible labels',()=>{
 assert.match(code,/<small aria-label="Satz \$\{index \+ 1\}">\$\{index \+ 1\}<\/small>/);
 assert.doesNotMatch(code,/<small>Satz \$\{index \+ 1\}<\/small>/);
});
test('live modal traps keyboard focus, exits on Escape and restores focus to trigger',()=>{
 assert.match(code,/lastModalTrigger = card/);
 assert.match(code,/lastModalTrigger\.focus\(\)/);
 assert.match(code,/event\.key === 'Tab'/);
 assert.match(code,/event\.shiftKey && document\.activeElement === first/);
 assert.match(code,/!event\.shiftKey && document\.activeElement === last/);
 assert.match(code,/event\.key === 'Escape'/);
 assert.match(code,/aria-modal="true"/);
});
