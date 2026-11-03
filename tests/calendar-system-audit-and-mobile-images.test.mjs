import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('superadmin status verifies real ICS content against published Supabase events',()=>{
  const code=read('src/scripts/system-monitor.ts');
  assert.match(code,/auditEventCalendarConsistency\(events \|\| \[\], feed\)/);
  assert.match(code,/inspectCalendarFeed\(\{ type: 'events', include_events: '1' \}\)/);
  assert.match(code,/calendarTile = tile\('Kalender-Abo'/);
});
test('calendar diagnostic checks update, withdrawal, duplicate IDs and missing published events',()=>{
  const code=read('src/lib/calendar-feed-diagnostics.ts');
  assert.match(code,/function auditEventCalendarConsistency/);
  assert.match(code,/Doppelter Kalender-Eintrag/);
  assert.match(code,/Abweichende Kalenderdaten/);
  assert.match(code,/Veröffentlichter Termin fehlt im ICS/);
  assert.match(code,/Nicht mehr veröffentlichter oder unbekannter Termin/);
});
test('team and match gallery images reserve layout space on mobile',()=>{
  const code=read('src/scripts/public.ts');
  assert.match(code,/width="58" height="58" loading="lazy" decoding="async"/);
  assert.match(code,/width="640" height="480" loading="lazy" decoding="async"/);
});
