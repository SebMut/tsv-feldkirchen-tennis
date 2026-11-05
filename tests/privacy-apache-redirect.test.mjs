import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const apache=read('public/.htaccess');
const footer=read('src/components/SiteFooter.astro');
const policy=read('src/pages/datenschutz/index.astro');
const deploy=read('.github/workflows/deploy-united-domains.yml');

test('Apache serves the tennis Datenschutz page without a redirect to the parent club',()=>{
  assert.doesNotMatch(apache,/^\s*Redirect(?:Match)?\s+30[1278]\s+\/?datenschutz\/\s+/mi);
  assert.doesNotMatch(apache,/^\s*RewriteRule\s+\^?datenschutz\/?\$?.*\[R=30[1278]/mi);
  assert.match(apache,/DirectoryIndex index\.html index\.php/);
  assert.match(policy,/Datenschutzerklärung/);
});

test('Footer sends visitors to local policy; external main club policy is secondary only',()=>{
  assert.match(footer,/<a href="\/datenschutz\/">Datenschutz<\/a>/);
  assert.doesNotMatch(footer,/PRIVACY_URL/);
  assert.match(policy,/Datenschutzerklärung des Hauptvereins lesen/);
});

test('Production pipeline prevents reintroduction of redirect and verifies actual hosted policy',()=>{
  assert.match(deploy,/Redirect.*datenschutz/i);
  assert.match(deploy,/\$domain\/datenschutz\/\?policy-check=/);
  assert.match(deploy,/privacy_redirect/);
});
