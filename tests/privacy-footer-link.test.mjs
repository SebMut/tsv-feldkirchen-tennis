import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const footer=read('src/components/SiteFooter.astro');
const page=read('src/pages/datenschutz/index.astro');
const layout=read('src/layouts/MainLayout.astro');

test('global Datenschutz footer link points to the Tennis site, not to the main club',()=>{
  assert.match(footer,/<a href="\/datenschutz\/">Datenschutz<\/a>/);
  assert.doesNotMatch(footer,/PRIVACY_URL|href=\{PRIVACY_URL\}|>Datenschutz ↗/);
  assert.ok(page.includes('Veranstaltungsanmeldungen'));
  assert.ok(page.includes('Cloudflare Turnstile'));
});

test('the primary internal link respects preview deployment base path',()=>{
  assert.match(layout,/rewriteLinks\(\)/);
  assert.match(layout,/basePrefix \+ href/);
  // The external link remains as a clearly named additional resource on
  // the actual Tennis privacy page, not the global footer.
  assert.match(page,/Datenschutzerklärung des Hauptvereins lesen/);
  assert.match(page,/https:\/\/tsvfeldkirchen\.de\/datenschutz-dsgvo/);
});

test('other footer legal links and established functions stay unchanged',()=>{
  assert.match(footer,/<a href=\{IMPRESSUM_URL\} target="_blank"/);
  assert.match(footer,/<a href=\{STATUTES_URL\} target="_blank"/);
  assert.match(footer,/<a href=\{COURTBOOKING_URL\} target="_blank"/);
  assert.match(footer,/<a href="\/kontakt\/">Kontakt<\/a>/);
});

test('footer credits SmartWerk.art with the supplied linked logo',()=>{
  assert.match(footer,/Entwickelt und gehostet von/);
  assert.match(footer,/href="https:\/\/smartwerk\.art\/"/);
  assert.match(footer,/src="\/images\/smartwerk-art-logo\.png"/);
  assert.match(footer,/alt="SmartWerk\.art 3D Druck"/);
});
