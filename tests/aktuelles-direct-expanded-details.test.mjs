import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const aktuell = read('src/pages/aktuelles/index.astro');
const publicCode = read('src/scripts/public.ts');

test('homepage event and news previews deep-link to the clicked article under Aktuelles', () => {
  assert.match(publicCode, /href: `\/aktuelles\/\?event=\$\{encodeURIComponent\(item\.id\)\}#event-\$\{encodeURIComponent\(item\.id\)\}`/);
  assert.match(publicCode, /href: `\/aktuelles\/\?news=\$\{encodeURIComponent\(item\.id\)\}#news-\$\{encodeURIComponent\(item\.id\)\}`/);
  assert.doesNotMatch(publicCode, /href: item\.rsvp_enabled && item\.slug \? `\/veranstaltung/);
});

test('event card poster, headline and Details open full text without calendar navigation', () => {
  assert.match(aktuell, /<article id="event-\$\{escapeHtml\(event\.id\)\}"/);
  assert.match(aktuell, /const href = `#event-\$\{event\.id\}`/);
  assert.match(aktuell, /data-open-detail aria-label/);
  assert.match(aktuell, /<h3><a href="\$\{href\}" data-open-detail>/);
  assert.match(aktuell, /<a href="\$\{href\}" data-open-detail>Details lesen →<\/a>/);
  assert.match(aktuell, /<details class="content-card__details" data-expanded-details>/);
  assert.match(aktuell, /<div class="content-card__full-text">\$\{fullDescription\}<\/div>/);
  assert.match(aktuell, /white-space:pre-wrap/);
  assert.match(aktuell, /fullDescription = escapeHtml\(String\(event\.description \|\| description\)/);
});

test('optional RSVP navigation stays available only as separate registration button', () => {
  assert.match(aktuell, /const signupHref = event\.rsvp_enabled && event\.slug \? `\/veranstaltung\/\?slug=/);
  assert.match(aktuell, /signupHref \? `<p class="content-card__signup">/);
  assert.match(aktuell, /Zur Anmeldung & Teilnahme →/);
  assert.doesNotMatch(aktuell, /const href = event\.rsvp_enabled/);
});

test('selected article is expanded after asynchronous load and scrolled into view', () => {
  assert.match(aktuell, /await loadNews\(\);/);
  assert.match(aktuell, /const expandCard = \(id: string, scroll = false\) =>/);
  assert.match(aktuell, /details\.open = true;/);
  assert.match(aktuell, /card\.scrollIntoView\(\{behavior:'smooth', block:'start'\}\)/);
  assert.match(aktuell, /const selected = new URLSearchParams\(location\.search\)/);
  assert.match(aktuell, /selected\.get\('event'\)/);
  assert.match(aktuell, /selected\.get\('news'\)/);
  assert.match(aktuell, /window\.addEventListener\('hashchange', openFromUrl\)/);
});

test('news cards also open complete text from their image and headline', () => {
  assert.match(publicCode, /<article id="news-\$\{escapeHtml\(item\.id\)\}"/);
  assert.match(aktuell, /media\.dataset\.openDetail = ''/);
  assert.match(aktuell, /link\.dataset\.openDetail = ''/);
  assert.match(aktuell, /details\.dataset\.expandedDetails = ''/);
  assert.match(aktuell, /card\.classList\.add\('content-card', 'content-card--news'\)/);
});
