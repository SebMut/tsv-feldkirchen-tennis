import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const helper=readFileSync(new URL('../src/lib/btv-group-url.ts',import.meta.url),'utf8');
const teams=readFileSync(new URL('../src/scripts/public.ts',import.meta.url),'utf8');
const admin=readFileSync(new URL('../src/scripts/manual-results-admin.ts',import.meta.url),'utf8');

function officialUrlValidator(){
  const body=helper.match(/export function officialBtvGroupUrl\(value: unknown\): string \| null \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  return new Function('value',body);
}

test('accepts only official BTV group deep links',()=>{
  const url=officialUrlValidator();
  assert.equal(url('https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2216736'),
    'https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2216736');
  assert.equal(url('javascript:alert(1)'),null);
  assert.equal(url('https://evil.example/de/spielbetrieb/tabelle-spielplan.html?groupid=2216736'),null);
  assert.equal(url('https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=abc'),null);
  assert.equal(url(null),null);
});

test('when group verification is missing, use permanent BTV club link, never unverified group ID',()=>{
  const group=officialUrlValidator();
  const constant=helper.match(/export const OFFICIAL_BTV_CLUB_URL\s*=\s*'([^']+)'/)?.[1];
  assert.equal(constant,'https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften');
  const body=helper.match(/export function officialBtvTeamDestination\(verifiedUrl: unknown\): \{href: string; isDirect: boolean\} \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const destination=new Function('verifiedUrl','officialBtvGroupUrl','OFFICIAL_BTV_CLUB_URL',body);
  assert.deepEqual(destination(undefined,group,constant),{href:constant,isDirect:false});
  assert.deepEqual(destination('https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2216734',group,constant),
    {href:'https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2216734',isDirect:true});
});

test('public team cards and individual season view use the verified source table',()=>{
  assert.match(teams,/from\('verified_team_btv_links'\)\.select\('team_season_id,btv_url'\)/);
  assert.match(teams,/officialBtvTeamDestination\(verifiedBtv\.get\(ts\.id\) === ts\.btv_url/);
  assert.match(teams,/officialBtvTeamDestination\(verifiedBtv\.get\(current\?\.id\) === current\?\.btv_url/);
  assert.match(teams,/BTV Tabelle \/ Spielplan/);
  assert.match(teams,/BTV Vereinsübersicht/);
  assert.match(teams,/href="\$\{detailUrl\}"/);
  assert.doesNotMatch(teams,/href="\$\{escapeHtml\(ts\.btv_url\)\}"/);
  assert.doesNotMatch(teams,/href="\$\{escapeHtml\(current\.btv_url\)\}"/);
});

test('superadmin results list shows verified group link or stable official club link',()=>{
  assert.match(admin,/from\('verified_team_btv_links'\)/);
  assert.match(admin,/officialBtvTeamDestination\(verifiedBtv\.get\(m\.team_season_id\) === m\.btv_url/);
  assert.match(admin,/officialBtvTeamDestination\(verifiedBtv\.get\(selected\.team_season_id\) === selected\.btv_url/);
  assert.match(admin,/link\.rel = 'noopener noreferrer'/);
  assert.match(admin,/Gruppenlink ungeprüft/);
  assert.doesNotMatch(admin,/officialBtvGroupUrl\(m\.btv_url\)/);
});
