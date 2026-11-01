import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeSetResult, homeAwaySetScore } from '../src/lib/tennis-score.mjs';

const source = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const publicScript = source('src/scripts/public.ts');
const css = source('src/styles/global.css');
const spieltag = source('src/pages/spieltag/index.astro');

test('Live-Ticker overview displays a match scoreboard and a running-encounter list', () => {
  assert.ok(spieltag.includes('id="live-center"'));
  assert.ok(publicScript.includes('ticker-overview-feature__score'));
  assert.ok(publicScript.includes('ticker-running-encounters__list'));
  assert.ok(publicScript.includes('renderLiveEncounterPreview(match, encounter)'));
  assert.ok(publicScript.includes('Gerade auf dem Platz'));
  assert.ok(publicScript.includes('Live-Ergebnisse &amp; alle Sätze ansehen'));
  assert.match(publicScript, /const detailHref = `\/live\/\?match=\$\{encodeURIComponent\(match\.id\)\}`/);
});

test('fetches only public, live-marked singles and doubles for all active fixtures', () => {
  assert.match(publicScript, /from\('match_encounters'\)[\s\S]*?select\('match_id,discipline,position,status,sort_order,tsv_player_1_name,tsv_player_2_name,opponent_slot_1,opponent_slot_2,result_text'\)/);
  assert.ok(publicScript.includes(".in('match_id', liveMatches.map((match: Row) => match.id))"));
  assert.ok(publicScript.includes(".eq('status', 'live')"));
  assert.ok(publicScript.includes("matchEncounters = activeEncounters.filter((row: Row) => row.match_id === match.id)"));
  assert.ok(publicScript.includes('liveMatches.map((match: Row) => {'));
  assert.doesNotMatch(publicScript, /liveMatches\.slice\(1\)\.map\(m => matchRow\(/);
});

test('home/guest score uses actual match values and preserves venue-independent home flag', () => {
  assert.ok(publicScript.includes('currentLiveState = scoreRows.find((state: Row) => state.match_id === match.id)'));
  assert.ok(publicScript.includes('currentLiveState?.home_score ?? 0'));
  assert.ok(publicScript.includes('currentLiveState?.away_score ?? 0'));
  assert.ok(publicScript.includes("match.is_home ? clubLabel : match.opponent"));
  assert.ok(publicScript.includes("match.is_home ? match.opponent : clubLabel"));
  assert.ok(publicScript.includes('homeAwaySetScore(summary, !!match.is_home)'));
  const lead = summarizeSetResult('6:2');
  assert.deepEqual(homeAwaySetScore(lead, true), { homeSets: 1, awaySets: 0 });
  assert.deepEqual(homeAwaySetScore(lead, false), { homeSets: 0, awaySets: 1 });
});

test('each live encounter clearly shows discipline, players, interim score and sets', () => {
  for (const label of ['Einzel', 'Doppel', 'Satzstand', 'TSV-Spieler noch offen',
    'Doppelgegner noch offen', 'Noch kein Satz eingetragen']) {
    assert.ok(publicScript.includes(label), label);
  }
  assert.ok(publicScript.includes('ticker-running-encounter__player'));
  assert.ok(publicScript.includes('ticker-running-encounter__result'));
  assert.ok(publicScript.includes('escapeHtml(homePlayers)'));
  assert.ok(publicScript.includes('escapeHtml(guestPlayers)'));
  assert.ok(publicScript.includes('escapeHtml(sets.join'));
  assert.ok(publicScript.includes('encounter.result_text'));
  assert.ok(publicScript.includes('summary.scores.filter(Boolean)'));
});

test('no active encounter is explained and failed fetch does not fake scores', () => {
  assert.ok(publicScript.includes('if (liveMatches.length)'));
  assert.ok(publicScript.includes("liveCenter.classList.add('hidden')"));
  assert.ok(publicScript.includes('Noch kein Einzel oder Doppel live geschaltet.'));
  assert.ok(publicScript.includes('Die laufenden Begegnungen sind momentan nicht abrufbar.'));
  assert.ok(publicScript.includes('running.error'));
});

test('overview cards are responsive and link to each match detail', () => {
  assert.ok(css.includes('.ticker-overview-match-list'));
  assert.ok(css.includes('.ticker-running-encounters__list'));
  assert.ok(css.includes('.ticker-running-encounter__line'));
  assert.ok(css.includes('@media(max-width:760px)'));
  assert.ok(css.includes('.ticker-overview-feature__action:focus-visible'));
  assert.ok(css.includes('.ticker-overview-feature__action{width:100%'));
  assert.ok(publicScript.includes('href="${detailHref}"'));
});
