import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const apache = readFileSync(new URL('../public/.htaccess', import.meta.url), 'utf8');

// Mirrors the Apache patterns (per-directory context: no leading slash).
const rule = (re) => {
  const m = apache.match(re);
  assert.ok(m, `rule missing: ${re}`);
  return new RegExp(m[1]);
};
const gone = rule(/^RewriteRule (\^\[A-Za-z0-9-\]\*-\[0-9\]\{5,8\}\/\?\$) - \[G,L\]$/m);
const datedTrial = rule(/^RewriteRule (\^20\S*schnupper\S*) \/training\/ \[R=301,L,NE\]$/m);
const dated = rule(/^RewriteRule (\^20\[0-9\]\{2\}\S*) \/aktuelles\/ \[R=301,L,NE\]$/m);
const feed = rule(/^RewriteRule (\S*feed\S*) \/aktuelles\/ \[R=301,L,NE\]$/m);
const lk = rule(/^RewriteRule (\S*lk-rechner\S*) \/mannschaften\/ \[R=301,L,NE\]$/m);

test('Spam product URLs from the old WordPress install answer 410 Gone', () => {
  for (const p of [
    'Kit-Make-14-Pints-At-Home-Beginner-Friendly-566659',
    'Fly-Mask-For-Horses-Black-844086',
    '-535336',
    'Temperature-Controller-Premium-Edition-1129168',
  ]) assert.match(p, gone, p);
  assert.match(apache, /RewriteCond %\{REQUEST_FILENAME\} !-f\nRewriteCond %\{REQUEST_FILENAME\} !-d\nRewriteRule \^\[A-Za-z0-9-\]/);
});

test('410 rule never hits real site routes or assets', () => {
  for (const p of [
    '', 'mannschaften/', 'mannschaften/herren-40/', 'training/', 'mitglied-werden/', 'termine/',
    'hallenplaetze/', 'spieltag/live-ticker/', 'sitemap.xml', 'robots.txt', 'icon-192.png',
    'icon-512.png', 'sw.js', 'manifest.webmanifest', 'forderungspyramide/so-funktionierts/',
  ]) assert.doesNotMatch(p, gone, p);
});

test('Old dated posts, feeds and the youth LK calculator get 301 redirects', () => {
  assert.match('2025/02/19/schnuppertag-am-05-04-2025-ab-10-uhr/', datedTrial);
  assert.match('2025/02/19/anderer-beitrag/', dated);
  assert.match('2024/', dated);
  for (const p of ['feed/', 'feed', 'comments/feed/', 'aufbau-der-plaetze/feed/']) assert.match(p, feed, p);
  for (const p of ['jugend-lk-rechner-maennlich/', 'jugend-lk-rechner-weiblich/', 'lk-rechner/']) assert.match(p, lk, p);
  for (const p of ['aktuelles/', 'mannschaften/', 'training/']) {
    assert.doesNotMatch(p, dated, p);
    assert.doesNotMatch(p, feed, p);
    assert.doesNotMatch(p, lk, p);
  }
});
