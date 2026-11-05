import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const policy=get('src/pages/datenschutz/index.astro');
const analytics=get('src/scripts/site-analytics.ts');
const rsvp=get('src/scripts/event-rsvp.ts');
const mail=get('supabase/functions/event-rsvp-email/index.ts');
const home=get('src/scripts/public.ts');

test('Tennis privacy statement includes controller, rights and actual data processors',()=>{
  for(const phrase of [
    'Olympiastraße 1','office@tsvfeldkirchen.de','Datenschutzerklärung des TSV Feldkirchen',
    'United Domains','Supabase','Cloudflare Turnstile','Google Gmail API',
    'Open-Meteo','Courtbooking','tennis.de / BTV','Kalenderabonnement',
    'Datenübertragbarkeit','Widerspruch','Veranstaltungen','Liveticker',
  ])assert.ok(policy.includes(phrase),'missing privacy section for '+phrase);
});

test('event privacy details reflect actual double opt in and optional participation categories',()=>{
  assert.match(mail,/24 Stunden gültig/);
  assert.match(policy,/24 Stunden gültig/);
  assert.match(mail,/request_fingerprint/);
  assert.match(policy,/Prüfwert aus der IP-Adresse/);
  assert.match(policy,/Jugendaltersklasse/);
  assert.match(policy,/Teilnehmerlisten als PDF/);
  assert.match(rsvp,/turnstile\/v0\/api\.js/);
  assert.match(policy,/Bestätigungs-E-Mail/);
});

test('statistics promise no visitor ID and exclude opted-out browsers',()=>{
  assert.match(analytics,/navigator\.doNotTrack === '1'/);
  assert.match(analytics,/globalPrivacyControl/);
  assert.match(policy,/stündlich zusammengefasste Zähler/);
  assert.match(policy,/keine IP-Adressen, Cookies, Personen- oder Besucherkennungen/);
  assert.match(policy,/Superadministratoren/);
  assert.match(policy,/normal.*Verbindungsprotokolle/);
});

test('no unsupported claim about exact hosting region, deletion days or use of analytics cookies',()=>{
  assert.doesNotMatch(policy,/alle personenbezogenen Daten.*EU|sämtliche Daten.*Deutschland/i);
  assert.doesNotMatch(policy,/Hosting-Protokolle.*(7|14|30) Tage/);
  assert.doesNotMatch(policy,/Google Analytics|Facebook Pixel/);
  assert.match(home,/api\.open-meteo\.com/);
});
