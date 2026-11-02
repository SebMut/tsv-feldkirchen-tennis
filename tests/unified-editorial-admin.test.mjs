import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('src/pages/admin/index.astro');
const admin = read('src/scripts/admin.ts');
const events = read('src/scripts/event-rsvp-admin.ts');
const publicJs = read('src/scripts/public.ts');

test('there is one top-level administrative section for news and events', () => {
  assert.equal((html.match(/data-panel="news"/g) || []).length, 1);
  assert.equal((html.match(/data-panel="rsvp-events"/g) || []).length, 0);
  assert.equal((html.match(/id="panel-news"/g) || []).length, 1);
  assert.ok(html.includes('Aktuelles &amp; Veranstaltungen'));
  assert.ok(html.includes('role="tablist"'));
  assert.ok(html.includes('data-editorial-tab="news"'));
  assert.ok(html.includes('data-editorial-tab="events"'));
  assert.ok(html.includes('role="tabpanel"'));
});

test('all existing editor and signup controls remain available', () => {
  for (const id of ['news-form','news-admin-list','news-match','news-event-start','news-image',
     'rsvp-admin-event-form','rsvp-admin-select','rsvp-admin-list','rsvp-admin-pdf',
     'rsvp-admin-tournament-youth','rsvp-admin-tournament-women','rsvp-admin-tournament-men']) {
    assert.ok(html.includes('id="' + id + '"'), id);
  }
  assert.ok(admin.includes('initEventRsvpAdmin({ isSuper: canEvents, user: state.user })'));
});

test('one navigation item respects separate global rights, including event-only and news-only users', () => {
  assert.ok(html.includes('data-panel="news" data-editorial-only'));
  assert.ok(html.includes('data-editorial-pane="news"'));
  assert.ok(html.includes('data-editorial-pane="events"'));
  assert.ok(admin.includes('const canNews = hasGlobalPermission(\'news\')'));
  assert.ok(admin.includes('const canEvents = hasGlobalPermission(\'events\')'));
  assert.ok(admin.includes('bindEditorialTabs(canNews, canEvents)'));
  assert.ok(admin.includes('canUseEditorialNews ? \'news\' : \'events\''));
  assert.ok(admin.includes("if (legacyEvents) name = 'news'"));
  assert.ok(admin.includes("button.setAttribute('aria-selected', String(active))"));
});

test('linked news/calendar events are not duplicated in the standalone events editor', () => {
  assert.ok(events.includes("events.filter(e => !String(e.external_url || '').startsWith('news:'))"));
  assert.ok(html.includes('ohne doppelte Einträge'));
  assert.ok(publicJs.includes("related_event_id") || publicJs.includes("external_url"));
});
