import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const publicScript = read('src/scripts/public.ts');
const adminScript = read('src/scripts/admin.ts');
const stylesheet = read('src/styles/global.css');
const livePage = read('src/pages/live/index.astro');

test('public match view shows progress and clear home/guest score hierarchy', () => {
  assert.match(publicScript, /aria-label="Heim \$\{homeScore\}, Gast \$\{awayScore\}"/);
  assert.match(publicScript, /live-scoreboard__score/);
  assert.match(publicScript, /live-match-progress__track/);
  assert.match(publicScript, /role="progressbar"/);
  assert.match(publicScript, /finishedCount \/ rows\.length/);
  assert.match(publicScript, /match\.is_home \? clubName : match\.opponent/);
  assert.match(livePage, /live-page-refresh/);
});

test('public filter is usable, accessible and re-applies after realtime refresh', () => {
  for (const filter of ['all', 'live', 'finished']) assert.ok(publicScript.includes(`data-live-view="${filter}"`));
  assert.match(publicScript, /applyEncounterView\(\)/);
  assert.match(publicScript, /encounterView: 'all' \| 'live' \| 'finished'/);
  assert.match(publicScript, /button\.setAttribute\('aria-pressed', String\(selected\)\)/);
  assert.match(publicScript, /row\.hidden = !visible/);
  assert.match(publicScript, /group\.hidden = !group\.querySelector/);
  assert.match(publicScript, /live-view-empty/);
  assert.match(stylesheet, /\.live-encounter-row\[hidden\]/);
});

test('admin puts the set score first and retains player editing behind a disclosure', () => {
  const body = adminScript.slice(adminScript.indexOf('const renderEncounter ='), adminScript.indexOf('const filter =', adminScript.indexOf('const renderEncounter =')));
  assert.ok(body.indexOf('class="encounter-result-row"') < body.indexOf('class="encounter-lineup"'));
  assert.match(body, /Aufstellung &amp; Gegner bearbeiten/);
  assert.match(body, /encounter-card__score/);
  assert.match(body, /data-enc-set="\$\{index\}"/);
  assert.match(body, /data-enc-live>Live anzeigen/);
  assert.match(body, /data-enc-reset/);
  assert.match(adminScript, /focusedEncounterId/);
  assert.match(stylesheet, /\.encounter-lineup>summary:focus-visible/);
});

test('dangerous matchday controls and optional ticker message are secondary', () => {
  assert.match(adminScript, /<details class="match-admin-more">/);
  assert.match(adminScript, /data-live-action="finish"/);
  assert.match(adminScript, /data-live-action="reset"/);
  assert.match(adminScript, /window\.confirm\('Den ganzen Spieltag wirklich beenden\?'\)/);
  assert.match(adminScript, /<details class="match-ticker-message match-ticker-message--details">/);
  assert.match(adminScript, /data-publish-ticker/);
  assert.match(adminScript, /data-match-venue-address/);
});

test('public and private responsive layouts remain keyboard friendly', () => {
  assert.match(stylesheet, /@media\(max-width:740px\)/);
  assert.match(stylesheet, /\.live-page-refresh \.live-encounter-matchup\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(stylesheet, /\.live-encounters__filters button:focus-visible/);
  assert.match(stylesheet, /\.match-admin-more>summary:focus-visible/);
  assert.match(stylesheet, /prefers-reduced-motion:reduce/);
});
