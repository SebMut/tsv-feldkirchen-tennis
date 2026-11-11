import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/styles/global.css',import.meta.url),'utf8');
const hall=readFileSync(new URL('../src/scripts/hall-finder.ts',import.meta.url),'utf8');

test('mobile hall date headers stay in document flow instead of covering first venue',()=>{
 const mobile=css.slice(css.indexOf('/* Hallenfinder 2026: time-first comparison layout */'));
 assert.match(mobile,/@media\(max-width:760px\)[^\n]*\.hall-day-card>header\{position:static;top:auto;z-index:auto/);
 assert.doesNotMatch(mobile,/\.hall-day-card>header\{position:sticky/);
 assert.doesNotMatch(mobile,/\.hall-day-card>header\{top:62px\}/);
});
test('loading, success and fallback all retain their venue blocks after the date header',()=>{
 for(const fn of ['loadingCard','fallbackCard','liveCard']){
  const block=hall.slice(hall.indexOf('function '+fn+'('),hall.indexOf('function ',hall.indexOf('function '+fn+'(')+10)>0?hall.indexOf('function ',hall.indexOf('function '+fn+'(')+10):undefined);
  assert.ok(block.includes('hall-day-card'),'no day card in '+fn);
  assert.ok(block.includes('hall-day-card__venues'),'no venues in '+fn);
  assert.ok(block.indexOf('hall-day-card__venues')>block.indexOf('<header>'),'venue must follow day heading in '+fn);
 }
});
