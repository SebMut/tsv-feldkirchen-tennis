import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

test('hall finder and homepage promo use TSV Feldkirchen red branding', () => {
  assert.match(css, /\.home-hallfinder-promo\{[^}]*linear-gradient\(120deg,#740008 0%,#ad000b 58%,#e30613 100%\)/);
  assert.match(css, /\.hall-finder-note\{[^}]*linear-gradient\(140deg,#750008,#b5000c 68%,#e30613\)/);
  assert.match(css, /\.hall-day-card>header\{[^}]*linear-gradient\(105deg,#850009,#c3000d 70%,#e30613\)/);
  assert.match(css, /\.hall-finder-hero\{[^}]*rgb\(227 6 19\/.13\)/);
});
