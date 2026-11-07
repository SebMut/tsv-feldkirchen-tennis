import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const edge=readFileSync(new URL('../supabase/functions/hall-availability/index.ts',import.meta.url),'utf8');
const config=readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8');

test('public hall endpoint limits searches to seven days and does not expose credentials',()=>{
 assert.match(config,/\[functions\.hall-availability\][\s\S]*verify_jwt = false/);
 assert.match(edge,/days < 1 \|\| days > 7/);
 assert.doesNotMatch(edge,/HALL_.*(?:PASSWORD|USERNAME|EMAIL)|service_role/i);
});

test('Aschheim uses only explicitly bookable slots and never invents prices',()=>{
 assert.match(edge,/slot-label\\s\+bookable/);
 assert.match(edge,/availableCourts/);
 assert.doesNotMatch(edge,/venueId: "aschheim"[\s\S]{0,300}price:/);
});

test('Kirchheim prices are read from provider price classes and bound to available slots',()=>{
 assert.match(edge,/class="price\\s\+price/);
 assert.match(edge,/class="slot\\s\+av/);
 assert.match(edge,/priceClass && prices\[priceClass\]/);
 assert.match(edge,/court: "Platz " \+ \(\(courtIndex % 2\) \+ 7\)/);
});

test('Eversports security barriers are shown honestly without bypassing them',()=>{
 for(const venue of ['sporttraum','rothof','haar'])assert.ok(edge.includes(venue+': { status: "provider_security"'));
 assert.doesNotMatch(edge,/captcha|turnstile|cloudflare/i);
});
