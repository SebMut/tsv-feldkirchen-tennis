import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('src/pages/admin/index.astro');
const composer = read('src/scripts/editorial-composer.ts');
const admin = read('src/scripts/admin.ts');
const events = read('src/scripts/event-rsvp-admin.ts');
const css = read('src/styles/global.css');

test('one visible contribution form offers independent calendar, signup and tournament options', () => {
  assert.match(page, /<h2>Neuen Beitrag erstellen<\/h2>/);
  assert.match(page, /id="editorial-compose-form"/);
  for (const id of ['editorial-compose-event','editorial-compose-rsvp','editorial-compose-tournaments',
      'editorial-compose-youth','editorial-compose-women','editorial-compose-men','editorial-compose-start',
      'editorial-compose-deadline','editorial-compose-image']) {
    assert.ok(page.includes('id="' + id + '"'), id);
  }
  assert.ok(page.includes('id="editorial-compose-event-fields"'));
  assert.ok(page.includes('id="editorial-compose-rsvp-fields"'));
  assert.ok(page.includes('id="editorial-compose-tournament-fields"'));
  assert.ok(page.includes('id="editorial-advanced-details"'));
  assert.ok(page.includes('id="news-form"') && page.includes('id="rsvp-admin-event-form"'));
});

test('a preview uses public content-card markup on desktop and phone and gates publishing', () => {
  assert.ok(page.includes('id="editorial-compose-desktop"'));
  assert.ok(page.includes('id="editorial-compose-mobile"'));
  assert.ok(page.includes('id="editorial-compose-publish" class="button" type="button" disabled'));
  assert.ok(composer.includes('previewRevision !== revision'));
  assert.ok(composer.includes('form.addEventListener(\'input\', invalidate)'));
  assert.ok(composer.includes('preview.hidden = true'));
  assert.ok(composer.includes('content-card content-card--event'));
  assert.ok(composer.includes('content-card content-card--news'));
  assert.ok(css.includes('.editorial-compose__phone'));
  assert.ok(css.includes('.editorial-compose__screen--mobile .content-card__body'));
});

test('unified publishing reuses existing tables, authorized roles, images and calendar relation', () => {
  assert.ok(admin.includes('initEditorialComposer({ canNews, canEvents, user: state.user })'));
  assert.ok(composer.includes('if (!access.canNews) input(\'event\').checked = true'));
  assert.ok(composer.includes('if (!access.canEvents) throw Error'));
  assert.ok(composer.includes("supabase.from('news')"));
  assert.ok(composer.includes("supabase.from('events')"));
  assert.ok(composer.includes("external_url: newsId ? 'news:' + newsId : null"));
  assert.ok(composer.includes("slug: newsId ? 'news-' + newsId"));
  assert.ok(composer.includes('replaceMediaImage('));
  assert.ok(composer.includes("directory: table + '/' + id"));
  assert.ok(composer.includes("status: oldNews?.status || 'draft'"));
  assert.ok(composer.includes("status: oldEvent?.status || 'draft'"));
  assert.ok(composer.includes("published_at: oldNews?.published_at || null"));
  assert.ok(composer.includes("status: 'archived', rsvp_enabled: false"));
  assert.ok(composer.includes('oldEvent?.team_id || null'));
});

test('linked events remain usable for response PDF without duplicate standalone entries', () => {
  assert.ok(events.includes("events.filter(e => !String(e.external_url || '').startsWith('news:'))"));
  assert.ok(events.includes('const linkedRsvps = events.filter'));
  assert.ok(events.includes('Mit Beiträgen verknüpfte Anmeldungen / PDF'));
  assert.ok(events.includes('tsv:editorial-content-changed'));
});

test('event short text persists separately from the invitation body, reloads into the editor, and renders in previews and public cards', () => {
  const migration = read('supabase/migrations/20261102223000_events_editorial_excerpt.sql');
  const aktuelles = read('src/pages/aktuelles/index.astro');
  const legacyNewsEditor = read('src/scripts/admin.ts');
  assert.match(migration, /alter table public\.events add column if not exists excerpt text;/);
  assert.match(migration, /where slug = 'platzabbau-2026-11-07'/);
  assert.ok(composer.includes("input('excerpt').value = String(entry.news?.excerpt || entry.event?.excerpt || '')"));
  assert.ok(composer.includes("excerpt: val('excerpt') || null, description: val('body')"));
  assert.ok(composer.includes("escapeHtml(plain(val('excerpt') || val('body')))"));
  assert.ok(aktuelles.includes("plainText(event.excerpt || event.description)"));
  assert.ok(aktuelles.includes("event.description || description"));
  assert.ok(legacyNewsEditor.includes("excerpt:editorialInput('news-excerpt')?.value.trim()||null,description:body"));
});
