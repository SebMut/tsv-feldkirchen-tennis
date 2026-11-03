import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code=readFileSync(new URL('../src/scripts/editorial-composer.ts',import.meta.url),'utf8');
test('editorial changes are explicitly guarded against leaving and switching entries',()=>{
  assert.match(code,/unsavedHint\.textContent = 'Ungespeicherte Änderungen/);
  assert.match(code,/form\.addEventListener\('input', \(\) => \{ invalidate\(\); markUnsaved\(\); \}\)/);
  assert.match(code,/window\.addEventListener\('beforeunload', \(event\) => \{/);
  assert.match(code,/if \(unsavedChanges && !window\.confirm/);
  assert.match(code,/clearUnsaved\(\)/);
});
test('concurrent content updates check the previously loaded revision',()=>{
  assert.match(code,/\.eq\('updated_at', oldNews\.updated_at\)/);
  assert.match(code,/\.eq\('updated_at', oldEvent\.updated_at\)/);
  assert.match(code,/Der Beitrag wurde zwischenzeitlich geändert/);
  assert.match(code,/Der Termin wurde zwischenzeitlich geändert/);
});
