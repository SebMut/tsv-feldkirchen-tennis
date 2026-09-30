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
await calendar({ type: 'events' }, 3);

const teamFeeds = {
  'bambini-12': 6,
  'bambini-12-ii': 5,
  'bambini-12-iii': 5,
  damen: 7,
  'damen-30': 4,
  'damen-40': 7,
  'damen-50': 7,
  herren: 7,
  'herren-40': 7,
  'herren-40-ii': 7,
  'herren-50': 6,
  'herren-50-ii': 6,
  'herren-ii': 7,
  'herren-iii': 7,
  'junioren-18': 7,
  'junioren-18-ii': 7,
  'kleinfeld-u9': 5,
  'knaben-15': 6,
  'knaben-15-ii': 6,
  'maedchen-15': 5,
};

for (const [team, expected] of Object.entries(teamFeeds)) {
  await calendar({ type: 'matches', team }, expected);
}

const courtbooking = await fetch('https://tsvfeldkirchen.courtbooking.de/', {
  redirect: 'manual',
  headers: { 'user-agent': 'TSV-Feldkirchen-Smoke/1.0' },
});
if (courtbooking.status < 200 || courtbooking.status >= 400) {
  throw new Error(`Courtbooking returned ${courtbooking.status}`);
}
console.log(`OK Courtbooking: HTTP ${courtbooking.status}`);
