import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUMMER_2026_TEAM_SLUGS } from '../scripts/btv-roster-age-classes.mjs';
import { parseBtvRosterPdfText } from '../scripts/btv-roster-pdf-parser.mjs';
import { buildPrivateRosterPlan } from '../scripts/btv-roster-supabase-import.mjs';

function letters(n) {
  let value = '';
  do {
    value = String.fromCharCode(65 + (n % 26)) + value;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return value;
}
function fixture() {
  const teams = [
    'Herren II', 'Herren 40', 'Herren 40 II', 'Damen 40',
    'Junioren 18', 'Knaben 15', 'Knaben 15 II',
    'Bambini 12', 'Bambini 12 II', 'Bambini 12 III',
  ];
  const lines = ['TSV Feldkirchen 01012 Sommer 2026'];
  let position = 0;
  teams.forEach((team, teamIndex) => {
    lines.push(team + ' | Südliga');
    const length = [49, 27, 27, 0, 23, 13, 12, 7, 7, 8][teamIndex];
    for (let rank = 1; rank <= length; rank++) {
      position++;
      const suffix = letters(position);
      const given = position === 173 ? 'Beispiel7' : 'Beispiel' + suffix;
      lines.push(rank + ' Muster' + suffix + ', ' + given + '  GER  12345678');
    }
  });
  return lines.join('\n');
}

test('private roster plan assigns the five non-empty classes to existing TSV seasons', () => {
  const parsed = parseBtvRosterPdfText(fixture());
  const plan = buildPrivateRosterPlan(parsed, SUMMER_2026_TEAM_SLUGS);
  assert.equal(parsed.diagnostics.numberedRows, 173);
  assert.equal(parsed.diagnostics.parsedRows, 172);
  assert.equal(plan.players.size, 172);
  assert.equal(parsed.diagnostics.classCounts['Damen 40'], 0);
  assert.ok(plan.pairs.length > 300);
  assert.deepEqual(new Set(plan.pairs.map(pair => pair.slug)).size, 12);
  assert.equal(new Set(plan.pairs.map(pair => pair.slug + '|' + pair.nameKey)).size, plan.pairs.length);
});

test('missing team mapping stops before any database access', () => {
  const parsed = parseBtvRosterPdfText(fixture());
  assert.throws(() => buildPrivateRosterPlan(parsed, ['herren']),
    /TEAM_SEASON_MAPPING_INCOMPLETE/);
});

test('new memberships are always private; workflow can never import from PRs', () => {
  const code = readFileSync(new URL('../scripts/btv-roster-supabase-import.mjs', import.meta.url),'utf8');
  const workflow = readFileSync(new URL('../.github/workflows/btv-roster-private-import.yml', import.meta.url),'utf8');
  assert.match(code, /public_visible:false/);
  assert.match(code, /ROSTER_WRITE_NOT_ENABLED/);
  assert.match(code, /eaurnufdochjapfzqwvm/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.event_name == 'push'/);
  assert.match(workflow, /BTV_SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(workflow, /upload-artifact|cron:|schedule:/);
});
