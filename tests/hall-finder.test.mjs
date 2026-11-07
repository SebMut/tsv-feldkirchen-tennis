import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/pages/hallenplaetze/index.astro',import.meta.url),'utf8');
const script=readFileSync(new URL('../src/scripts/hall-finder.ts',import.meta.url),'utf8');
const header=readFileSync(new URL('../src/components/SiteHeader.astro',import.meta.url),'utf8');
test('hall finder covers all five requested indoor venues',()=>{for(const name of ['TC Aschheim','SPORTTRAUM','Rothof München','Racket-Park TSV Haar','TC Kirchheim'])assert.match(script,new RegExp(name))});
test('hall finder never claims third-party availability as verified',()=>{assert.match(page,/Verfügbarkeiten ändern sich laufend/);assert.match(page,/verbindliche Anzeige und Buchung erfolgt immer im Kalender/);assert.doesNotMatch(script,/Nichts frei|Platz frei|verfügbar/i)});
test('hall finder has filters, shareable state and official booking links',()=>{for(const field of ['hall-date-from','hall-date-to','hall-time-from','hall-time-to'])assert.match(page,new RegExp(field));assert.match(script,/history\.replaceState/);assert.match(script,/tcaschheim\.ebusy\.de/);assert.match(script,/tckirchheim\.tennisplatz\.info/);assert.match(script,/eversports\.de\/widget\/w\/jmjffr/);assert.match(header,/href="\/hallenplaetze\/"/)});
