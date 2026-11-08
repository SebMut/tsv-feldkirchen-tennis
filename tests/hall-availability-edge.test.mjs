import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const edge=readFileSync(new URL('../supabase/functions/hall-availability/index.ts',import.meta.url),'utf8');
const config=readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8');

test('public hall endpoint limits searches to seven days and does not expose credentials',()=>{
 assert.match(config,/\[functions\.hall-availability\][\s\S]*verify_jwt = false/);
 assert.match(edge,/days < 1 \|\| days > 7/);
 assert.doesNotMatch(edge,/HALL_.*(?:PASSWORD|USERNAME|EMAIL)|service_role/i);
 assert.match(edge,/"Cache-Control": "no-store, max-age=0"/);
 assert.match(edge,/Access-Control-Allow-Headers[^\n]+cache-control/);
});

test('Aschheim uses only explicitly bookable slots and never invents prices',()=>{
 assert.match(edge,/slot-label\\s\+bookable/);
 assert.match(edge,/>\\s\*Buchen\\s\*</);
 assert.match(edge,/occupancyResponse/);
 assert.match(edge,/occupancy\?\.reservations/);
 assert.match(edge,/minutes\(reservation\.fromTime!\) < minutes\(end\)/);
 assert.match(edge,/availableCourts/);
 assert.doesNotMatch(edge,/venueId: "aschheim"[\s\S]{0,300}price:/);
});

test('Kirchheim prices are read from provider price classes and bound to available slots',()=>{
 assert.match(edge,/class="price\\s\+price/);
 assert.match(edge,/class="slot\\s\+av/);
 assert.match(edge,/priceClass && prices\[priceClass\]/);
 assert.match(edge,/court: "Platz " \+ \(\(courtIndex % 2\) \+ 7\)/);
 assert.match(edge,/class="slot\\s\+av/);
 assert.match(edge,/berlinNoonEpoch\(dates\[0\]\)/);
});

test('Sporttraum and Haar use the public Eversports tennis calendar and only free priced cells',()=>{
 assert.match(edge,/6yi8rm/);assert.match(edge,/hwhk63/);
 assert.match(edge,/data-state="free"/);
 assert.match(edge,/data-price/);
 assert.match(edge,/fetchEversports\("sporttraum"/);assert.match(edge,/fetchEversports\("haar"/);
 assert.doesNotMatch(edge,/rothof/i);
});
