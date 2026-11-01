import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const publicScript = source('src/scripts/public.ts');
const css = source('src/styles/global.css');
const spieltag = source('src/pages/spieltag/index.astro');

test('primary Live-Ticker route presents a prominent entry point to the new detailed view', () => {
  assert.match(spieltag, /id="live-center"/);
  assert.match(publicScript, /ticker-overview-feature__score/);
  assert.match(publicScript, /Live-Ergebnisse &amp; alle Sätze ansehen/);
  assert.match(publicScript, /const detailHref = `\/live\/\?match=\$\{encodeURIComponent\(featuredLive\.id\)\}`/);
  assert.match(publicScript, /class="ticker-overview-feature__action" href="\$\{detailHref\}"/);
});

test('live team standings on the overview are real data, not sample values', () => {
  assert.match(publicScript, /currentLiveState = scoreRows\.find\(s => s\.match_id === featuredLive\.id\)/);
  assert.match(publicScript, /Number\(currentLiveState\?\.home_score \?\? 0\)/);
  assert.match(publicScript, /Number\(currentLiveState\?\.away_score \?\? 0\)/);
  assert.match(publicScript, /featuredLive\.is_home \? clubLabel : featuredLive\.opponent/);
  assert.match(publicScript, /featuredLive\.is_home \? featuredLive\.opponent : clubLabel/);
  assert.match(publicScript, /matchContext\(featuredLive, reference\)/);
});

test('no fixture means no made-up live entry and multiple live matches stay navigable', () => {
  assert.match(publicScript, /if \(liveMatches\.length\)/);
  assert.match(publicScript, /liveCenter\.classList\.add\('hidden'\)/);
  assert.match(publicScript, /liveMatches\.slice\(1\)\.map\(m => matchRow\(m, reference, scoreRows\)\)/);
  assert.match(publicScript, /Weitere laufende Punktspiele/);
});

test('featured live entry is mobile friendly and keyboard accessible', () => {
  assert.match(css, /\.ticker-overview-feature__score\{/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /\.ticker-overview-feature__action:focus-visible/);
  assert.match(css, /\.ticker-overview-feature__action\{width:100%/);
});
