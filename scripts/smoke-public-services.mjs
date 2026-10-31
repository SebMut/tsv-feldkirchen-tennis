// Phase 7: public, non-mutating service checks. Counts are deliberately not hard-coded:
 // published matches change with the season and during editorial updates.
const base = 'https://eaurnufdochjapfzqwvm.supabase.co/functions/v1/calendar-feed';

async function calendar(params, { min = 0, exact = null } = {}) {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: { 'user-agent': 'TSV-Feldkirchen-Smoke/2.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Calendar ${url.search} returned HTTP ${response.status}`);
  if (!(response.headers.get('content-type') || '').includes('text/calendar')) {
    throw new Error(`Unexpected calendar content type: ${response.headers.get('content-type')}`);
  }
  const text = await response.text();
  if (!text.startsWith('BEGIN:VCALENDAR\r\n') || !text.includes('\r\nEND:VCALENDAR')) {
    throw new Error('Invalid ICS wrapper for ' + url.search);
  }
  const lines = text.split(/\r?\n/);
  const count = lines.filter(line => line === 'BEGIN:VEVENT').length;
  const ends = lines.filter(line => line === 'END:VEVENT').length;
  const uids = lines.filter(line => line.startsWith('UID:')).map(line => line.slice(4));
  if (count !== ends || count !== uids.length || new Set(uids).size !== uids.length) {
    throw new Error('Invalid or duplicate event IDs for ' + url.search);
  }
  if (count < min || (exact !== null && count !== exact)) {
    throw new Error(`Unexpected event count ${count} for ${url.search} (min=${min}, exact=${exact})`);
  }
  console.log(`OK calendar ${url.search || '?type=all'}: ${count} valid appointments`);
  return count;
}

const allMatches = await calendar({ type: 'matches' }, { min: 1 });
await calendar({ type: 'events' });
const exampleTeams = ['herren', 'damen', 'junioren-18'];
for (const team of exampleTeams) {
  const count = await calendar({ type: 'matches', team }, { min: 1 });
  if (count > allMatches) throw new Error(`Team feed ${team} exceeds all matches`);
}
await calendar({ type: 'matches', team: 'test-not-a-real-tsv-team' }, { exact: 0 });

const courtbooking = await fetch('https://tsvfeldkirchen.courtbooking.de/', {
  redirect: 'manual',
  headers: { 'user-agent': 'TSV-Feldkirchen-Smoke/2.0' },
  signal: AbortSignal.timeout(20000),
});
if (courtbooking.status < 200 || courtbooking.status >= 400) {
  throw new Error(`Courtbooking returned HTTP ${courtbooking.status}`);
}
console.log(`OK Courtbooking connection: HTTP ${courtbooking.status}`);
