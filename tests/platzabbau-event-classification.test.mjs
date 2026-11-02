import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261102180000_platzabbau_as_event.sql');
const home = read('src/scripts/public.ts');
const admin = read('src/scripts/event-rsvp-admin.ts');
const eventsPage = read('src/pages/aktuelles/index.astro');

test('07.11 Platzabbau is a standalone event, preserves content and hero image', () => {
  assert.ok(migration.includes("slug = 'platzabbau-2026-11-07'"));
  assert.ok(migration.includes("existing_event.external_url is distinct from"));
  assert.ok(migration.includes("nullif(btrim(original_news.excerpt), '')"));
  assert.ok(migration.includes("nullif(btrim(original_news.body), '')"));
  assert.ok(migration.includes('hero_image_path = coalesce('));
  assert.ok(migration.includes('external_url = null'));
  assert.ok(migration.includes('delete from public.news where id = original_news.id'));
  assert.ok(migration.includes('if not found then'));
});

test('homepage shows real events as events, not news, and prevents linked duplicates', () => {
  assert.ok(home.includes("supabase.from('events').select('id,slug,title,starts_at,hero_image_path,rsvp_enabled,external_url')"));
  assert.ok(home.includes("label: 'Veranstaltung'"));
  assert.ok(home.includes('linkedNewsIds.has(item.id)'));
  assert.ok(home.includes('!upcomingClubEvents.some(event => event.title === item.title)'));
  assert.ok(eventsPage.includes('content-card__badge'));
  assert.ok(eventsPage.includes('Veranstaltung'));
});

test('event administration lists the converted event and retains registrations/PDF', () => {
  assert.ok(admin.includes("events.filter(e => !String(e.external_url || '').startsWith('news:'))"));
  assert.ok(admin.includes('downloadRsvpPdf('));
  assert.ok(admin.includes("supabase.from('events').update(patch)"));
});
