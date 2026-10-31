import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const helper=readFileSync(new URL('../src/lib/btv-group-url.ts',import.meta.url),'utf8');
const teams=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');
const admin=readFileSync(new URL('../src/scripts/manual-results-admin.ts',import.meta.url),'utf8');

test('BTV link validation accepts only official group pages and precise group IDs',()=>{
  const code=helper.match(/export function officialBtvGroupUrl\(value: unknown\): string \| null \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(code,'validator must be present');
  const factory=new Function('value',code);
  assert.equal(factory('https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2216736'),
    'https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2216736');
  assert.equal(factory('javascript:alert(1)'),null);
  assert.equal(factory('https://evil.example/de/spielbetrieb/tabelle-spielplan.html?groupid=2216736'),null);
  assert.equal(factory('https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=abc'),null);
  assert.equal(factory('https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html'),null);
  assert.equal(factory(null),null);
});

test('public team cards display per-team group URL next to team name',()=>{
  assert.match(teams,/import \{ officialBtvGroupUrl \} from '..\/lib\/btv-group-url'/);
  assert.match(teams,/officialBtvGroupUrl\(ts\.btv_url\)/);
  assert.match(teams,/BTV Tabelle \/ Spielplan/);
  assert.match(teams,/href="\$\{detailUrl\}"/);
  assert.match(teams,/rel="noopener noreferrer"/);
});

test('superadmin results list links group with each match and avoids invalid href',()=>{
  assert.match(admin,/officialBtvGroupUrl\(m\.btv_url\)/);
  assert.match(admin,/link\.textContent = 'BTV-Tabelle ' \+ m\.team_name/);
  assert.match(admin,/link\.rel = 'noopener noreferrer'/);
  assert.match(admin,/Offizieller Gruppenlink noch nicht bestätigt/);
});
