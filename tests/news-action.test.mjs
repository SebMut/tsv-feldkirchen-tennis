import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const asModule = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpile(source, {module:ts.ModuleKind.ESNext})).toString('base64');
const ui = asModule(readFileSync(new URL('../src/lib/ui.ts', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/lib/news-action.ts', import.meta.url), 'utf8').replace("'./ui'", JSON.stringify(ui));
const {newsActionUrl, validateNewsAction, renderNewsAction} = await import(asModule(source));
test('news buttons accept internal paths and HTTP(S), rejecting unsafe navigation', () => {
  for (const url of ['/hallenplaetze/', '/forderungspyramide/?tab=ranking', 'https://www.tennis-tsvfeldkirchen.de/hallenplaetze/']) assert.ok(newsActionUrl(url));
  for (const url of ['javascript:alert(1)', '//evil.example', '/\\evil.example', 'data:text/html,x', 'https://user:pass@example.com', 'https://exa mple.com', 'relative-path']) assert.equal(newsActionUrl(url), null, url);
});
test('news button fields are optional together and require a complete valid pair', () => {
  assert.doesNotThrow(() => validateNewsAction('', ''));
  assert.doesNotThrow(() => validateNewsAction('Suchen', '/hallenplaetze/'));
  for (const pair of [['Suchen',''],['','/hallenplaetze/'],['Suchen','javascript:alert(1)'],['x'.repeat(81),'/']]) assert.throws(() => validateNewsAction(...pair));
});
test('button rendering hides absent or unsafe links and escapes editorial text', () => {
  assert.equal(renderNewsAction({}), '');
  assert.equal(renderNewsAction({button_label:'Los',button_url:'javascript:alert(1)'}), '');
  const html = renderNewsAction({button_label:'<img onerror="alert(1)">',button_url:'/hallenplaetze/?a=1&b=2'});
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&amp;b=2'));
  assert.ok(!html.includes('<img'));
});
