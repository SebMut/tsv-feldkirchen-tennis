import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const functionSource = read('supabase/functions/calendar-feed/index.ts');
const publicScript = read('src/scripts/public.ts');
const client = read('src/lib/supabase.ts');
const page = read('src/pages/termine/index.astro');

// Exercise the actual Edge Function's pure iCalendar serializer without Deno or network.
const pure = functionSource.slice(functionSource.indexOf('function esc('), functionSource.indexOf('Deno.serve('));
const executable = ts.transpileModule(pure, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const { block, subscriptionEvents } = runInNewContext(executable + '\n({block,subscriptionEvents})', { Date, TextEncoder, Math });

const sommerfestFixture = {
  id: 'event-42635ab5-31bb-4461-81eb-e29a7fec0193',
  title: 'Sommerfest',
  start: '2027-08-17T15:00:00+00:00',
  end: '2027-08-18T01:30:00+00:00',
  created: '2026-11-01T10:00:00+00:00',
  updated: '2026-11-03T02:31:02.670Z',
};

test('overnight event publishes an exact UTC DTSTART and DTEND (local 17:00–03:30)', () => {
  const ics = block(sommerfestFixture);
  assert.match(ics, /DTSTART:20270817T150000Z/);
  assert.match(ics, /DTEND:20270818T013000Z/);
  assert.match(ics, /UID:event-42635ab5-31bb-4461-81eb-e29a7fec0193@tennis-tsvfeldkirchen\.de/);
});

test('calendar subscriptions have stable revisions between fetches and update when event changes', () => {
  const original = block(sommerfestFixture);
  const repeated = block(sommerfestFixture);
  assert.equal(original, repeated, 'Polling must not generate new DTSTAMP for unchanged events');
  assert.match(original, /DTSTAMP:20261103T023102Z/);
  assert.match(original, /LAST-MODIFIED:20261103T023102Z/);
  assert.match(original, /SEQUENCE:\d+/);
  const changed = block({ ...sommerfestFixture, updated: '2026-11-03T02:35:00.000Z', end: '2027-08-18T02:00:00Z' });
  assert.notEqual(changed, original);
  assert.match(changed, /DTEND:20270818T020000Z/);
  assert.match(changed, /LAST-MODIFIED:20261103T023500Z/);
});

test('iCalendar content lines fold to max 75 UTF-8 octets, preserving accented text', () => {
  const ics = block({ ...sommerfestFixture, description: 'Sommerfest – München 🎾 '.repeat(30) });
  for (const line of ics.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, 'ICS line too long: ' + Buffer.byteLength(line, 'utf8'));
  }
  assert.ok(ics.includes('\r\n '), 'Long description was not folded');
  assert.equal(ics.replace(/\r\n /g, '').includes('DESCRIPTION:Sommerfest – München 🎾 '), true);
});

test('feed fetches latest updated_at for events and matches, advertises refresh and disables stale intermediary caches', () => {
  assert.match(functionSource, /created_at,updated_at/);
  assert.match(functionSource, /updated:e\.updated_at,created:e\.created_at/);
  assert.match(functionSource, /updated:m\.updated_at,created:m\.created_at/);
  assert.match(functionSource, /REFRESH-INTERVAL;VALUE=DURATION:PT1H/);
  assert.match(functionSource, /X-PUBLISHED-TTL:PT1H/);
  assert.match(functionSource, /no-cache, max-age=0, must-revalidate/);
  assert.doesNotMatch(functionSource, /stamp\(new Date\(\)\.toISOString\(\)\)/);
});

test('webcal subscriptions and Google HTTPS link are distinct from one-time ICS download', () => {
  assert.match(client, /calendarSubscriptionUrl/);
  assert.match(client, /\.replace\(\/\^https:\/, 'webcal:'\)/);
  assert.match(publicScript, /calendarSubscriptionUrl\(params\)/);
  assert.match(publicScript, /calendarSubscriptionUrl\(\{ type: 'events' \}\)/);
  assert.match(publicScript, /data-calendar-copy/);
  assert.match(publicScript, /navigator\.clipboard\.writeText/);
  assert.match(publicScript, /calendarSubscriptionUrl\(\{team: slug\}\)/);
  assert.match(page, /id="calendar-subscription-status"/);
  assert.match(page, /einmaliger Import/);
});

test('favorite-team ICS includes club-wide events when checked, excludes them when unchecked', () => {
  const items = [
    { team_id: null, id: 'sommerfest' },
    { team_id: 'team-a', id: 'team-event' },
    { team_id: 'team-b', id: 'other-team-event' },
  ];
  const teamIds = new Set(['team-a']);
  const eventIds = selection => Array.from(selection, item => item.id).join(',');
  assert.equal(eventIds(subscriptionEvents(items, 'herren', null, '1', teamIds)),
    'sommerfest,team-event,other-team-event', 'checked must add all club events');
  assert.equal(eventIds(subscriptionEvents(items, 'herren', null, '0', teamIds)), '',
    'unchecked must exclude every event');
  assert.equal(eventIds(subscriptionEvents(items, 'herren', null, null, teamIds)), 'team-event',
    'existing favourite-team ICS URLs must keep the old event filter');
  assert.equal(eventIds(subscriptionEvents(items, null, null, null, teamIds)),
    'sommerfest,team-event,other-team-event', 'old unfiltered subscriptions remain unchanged');
});

test('calendar checkbox controls view, subscription link and persists across page visits', () => {
  assert.match(page, /id="calendar-include-events" type="checkbox" checked/);
  assert.match(page, /calendar-include-events-toggle/);
  assert.match(publicScript, /tsv-tennis-calendar-include-events/);
  assert.match(publicScript, /includeEvents\.checked = localStorage\.getItem\(eventsKey\) !== 'false'/);
  assert.match(publicScript, /!includeEvents\?\.checked \? \[\] : events/);
  assert.match(publicScript, /params\.include_events = includeEvents\?\.checked \? '1' : '0'/);
  assert.match(publicScript, /localStorage\.setItem\(eventsKey, String\(includeEvents\.checked\)\)/);
  assert.match(functionSource, /includeEvents = url\.searchParams\.get\("include_events"\)/);
});
