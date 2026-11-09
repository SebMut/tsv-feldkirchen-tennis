import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/forderungspyramide/index.astro', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/pyramid.css', import.meta.url), 'utf8');
const pdf = new URL('../public/downloads/forderungspyramide-onepager-tsv-feldkirchen.pdf', import.meta.url);

test('public pyramid page offers the branded onepager as a real PDF download', () => {
  assert.match(page, /class="pyramid-onepager"/);
  assert.match(page, /href="\/downloads\/forderungspyramide-onepager-tsv-feldkirchen\.pdf" download/);
  assert.match(page, /Onepager herunterladen/);
  assert.equal(existsSync(pdf), true);
  assert.ok(statSync(pdf).size > 100_000);
  assert.equal(readFileSync(pdf).subarray(0, 5).toString(), '%PDF-');
});

test('onepager download card is responsive and follows TSV red styling', () => {
  assert.match(css, /\.pyramid-onepager\{[^}]*border-left:5px solid #e30613/);
  assert.match(css, /@media\(max-width:720px\)\{[\s\S]*?\.pyramid-onepager \ .button|@media\(max-width:720px\)\{[\s\S]*?\.pyramid-onepager \.button/);
});
