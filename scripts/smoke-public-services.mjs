const calendarBase = 'https://eaurnufdochjapfzqwvm.supabase.co/functions/v1/calendar-feed';

async function calendar(params, expected) {
  const url = new URL(calendarBase);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { 'user-agent': 'TSV-Feldkirchen-Smoke/1.0' } });
  if (!response.ok) throw new Error(`Calendar ${url} returned ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/calendar')) throw new Error(`Unexpected calendar content type: ${type}`);
  const body = await response.text();
  if (!body.startsWith('BEGIN:VCALENDAR') || !body.includes('END:VCALENDAR')) {
    throw new Error('Invalid ICS wrapper');
  }
  const count = (body.match(/BEGIN:VEVENT/g) || []).length;
  if (count !== expected) throw new Error(`Expected ${expected} events for ${url}, got ${count}`);
  console.log(`OK calendar ${url.search}: ${count} events`);
}

await calendar({ type: 'matches' }, 124);
await calendar({ type: 'matches', team: 'herren' }, 7);

const courtbooking = await fetch('https://tsvfeldkirchen.courtbooking.de/', {
  redirect: 'manual',
  headers: { 'user-agent': 'TSV-Feldkirchen-Smoke/1.0' },
});
if (courtbooking.status < 200 || courtbooking.status >= 400) {
  throw new Error(`Courtbooking returned ${courtbooking.status}`);
}
console.log(`OK Courtbooking: HTTP ${courtbooking.status}`);
