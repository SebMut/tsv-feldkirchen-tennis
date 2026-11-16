import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBtvRosterPdfText, assertPlausibleSeasonRoster } from '../scripts/btv-roster-pdf-parser.mjs';
import { laterSummerRosterTeams, isLaterSummerSeason } from '../scripts/btv-roster-age-classes.mjs';
import { buildSeasonRosterPlan } from '../scripts/btv-roster-supabase-import.mjs';
import { seasonForRun } from '../scripts/btv-roster-season-ready.mjs';

function letters(n) {
  let value = '';
  do { value = String.fromCharCode(65 + (n % 26)) + value; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return value;
}
// Synthetic Sommer 2027 roster: four non-empty age classes, 110 names.
function fixture({ season = 'Sommer 2027', extra = [] } = {}) {
  const blocks = [['Herren', 40], ['Herren 40', 30], ['Knaben 15', 20], ['Bambini 12', 20], ['Damen', 0]];
  const lines = ['TSV Feldkirchen 01012 ' + season];
  let position = 0;
  for (const [heading, length] of blocks) {
    lines.push(heading + ' | Südliga');
    for (let rank = 1; rank <= length; rank++) {
      position++;
      lines.push(rank + ' Muster' + letters(position) + ', Beispiel' + letters(position) + '  GER  12345678');
    }
  }
  return lines.concat(extra).join('\n');
}

test('only summer seasons from 2027 on are accepted', () => {
  assert.equal(isLaterSummerSeason('sommer-2027'), true);
  assert.equal(isLaterSummerSeason('sommer-2030'), true);
  assert.equal(isLaterSummerSeason('sommer-2026'), false);
  assert.equal(isLaterSummerSeason('winter-2027-2028'), false);
});

test('age classes map only to teams that exist for the season', () => {
  assert.deepEqual(laterSummerRosterTeams('Herren', 'sommer-2027', ['herren', 'herren-ii', 'herren-40']), ['herren', 'herren-ii']);
  assert.deepEqual(laterSummerRosterTeams('Damen 30', 'sommer-2027', ['herren']), []);
  assert.deepEqual(laterSummerRosterTeams('Herren', 'sommer-2026', ['herren']), []);
});

test('plausible 2027 roster passes the gate', () => {
  const parsed = assertPlausibleSeasonRoster(parseBtvRosterPdfText(fixture()));
  assert.equal(parsed.diagnostics.parsedRows, 110);
});

test('structural doubts stop the import before the database', () => {
  assert.throws(() => assertPlausibleSeasonRoster(parseBtvRosterPdfText(
    fixture().replace('Knaben 15 |', 'Unbekannt 15 |'))), /UNVERIFIED_NMM_ROSTER/);
  assert.throws(() => assertPlausibleSeasonRoster(parseBtvRosterPdfText(
    'TSV Feldkirchen 01012 Sommer 2027\n1 Muster, Erika  GER\n'.repeat(5))), /UNVERIFIED_NMM_ROSTER/);
  assert.throws(() => assertPlausibleSeasonRoster(parseBtvRosterPdfText(fixture({
    extra: ['1 Kaputt Zeile ohne Komma  GER', '2 Noch, eine1  GER', '3 Weitere, 2x  GER', '4 Viele, 3y  GER'],
  }))), /UNVERIFIED_NMM_ROSTER/);
});

test('plan assigns names only to existing teams and reports skipped classes', () => {
  const parsed = parseBtvRosterPdfText(fixture());
  const plan = buildSeasonRosterPlan(parsed, 'sommer-2027', ['herren', 'herren-ii', 'herren-40', 'knaben-15']);
  assert.equal(plan.players.size, 90);
  assert.deepEqual(plan.skippedClasses, ['Bambini 12']);
  assert.equal(plan.importedClasses, 3);
  assert.equal(plan.pairs.filter(p => p.slug === 'herren').length, 40);
  assert.equal(plan.pairs.filter(p => p.slug === 'herren-ii').length, 40);
  assert.equal(plan.pairs.length, 40 + 40 + 30 + 20);
});

test('no matching team or unsupported season never plans a write', () => {
  const parsed = parseBtvRosterPdfText(fixture());
  assert.throws(() => buildSeasonRosterPlan(parsed, 'sommer-2027', ['damen-50']), /ROSTER_NO_MATCHING_TEAMS/);
  assert.throws(() => buildSeasonRosterPlan(parsed, 'sommer-2026', ['herren']), /ROSTER_SEASON_NOT_SUPPORTED/);
});

test('scheduled runs start with sommer-2027 and follow the calendar year', () => {
  assert.equal(seasonForRun({ eventName: 'schedule', now: Date.parse('2026-11-16T05:37:00Z') }), null);
  assert.equal(seasonForRun({ eventName: 'schedule', now: Date.parse('2027-03-01T05:37:00Z') }), 'sommer-2027');
  assert.equal(seasonForRun({ eventName: 'schedule', now: Date.parse('2028-03-06T05:37:00Z') }), 'sommer-2028');
  assert.equal(seasonForRun({ eventName: 'workflow_dispatch', requestedSeason: 'sommer-2027' }), 'sommer-2027');
});

test('workflow: weekly March to September, writes only on main after the readiness check', () => {
  const wf = readFileSync(new URL('../.github/workflows/btv-roster-private-import.yml', import.meta.url), 'utf8');
  assert.match(wf, /cron: '37 5 \* 3-9 1'/);
  assert.match(wf, /needs\.ready\.outputs\.ready == 'true'/);
  assert.match(wf, /github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(wf, /BTV_ROSTER_SOFT_UNPUBLISHED/);
  const importJob = wf.slice(wf.indexOf('\n  import:'));
  assert.doesNotMatch(importJob, /github\.event_name == 'push'|pull_request/);
  assert.doesNotMatch(wf, /upload-artifact/);
});
