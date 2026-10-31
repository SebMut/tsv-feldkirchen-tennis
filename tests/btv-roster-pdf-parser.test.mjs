import test from 'node:test';
import assert from 'node:assert/strict';
import { AGE_CLASSES } from '../scripts/btv-roster-age-classes.mjs';
import { parseBtvRosterPdfText, assertCompleteSummerRoster, assertVerifiedSummerSnapshot } from '../scripts/btv-roster-pdf-parser.mjs';

function fixture() {
  const rows = [];
  for (const [ageClass, teams] of Object.entries(AGE_CLASSES)) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams.length > 1 ? ' ' + ['I','II','III'][i] : '';
      rows.push(ageClass + team + ' | Gruppe');
      for (const [rank, first] of ['Alpha','Beta','Gamma','Delta'].entries()) {
        rows.push((rank + 1) + ' Beispiel, ' + first + '  GER  12345678');
      }
    }
  }
  return 'TSV Feldkirchen 01012 Sommer 2026\n' + rows.join('\n');
}

test('all 20 team headings and twelve age classes match', () => {
  const parsed = assertCompleteSummerRoster(parseBtvRosterPdfText(fixture()));
  assert.equal(parsed.diagnostics.classCount, 12);
  assert.equal(parsed.diagnostics.headingCount, 20);
  assert.equal(parsed.diagnostics.numberedRows, 80);
  assert.equal(parsed.diagnostics.parsedRows, 80);
  assert.equal(parsed.diagnostics.malformedRows, 0);
  assert.equal(parsed.rows['Bambini 12'].length, 4);
});

test('only person name column is retained', () => {
  const parsed = parseBtvRosterPdfText(fixture());
  assert.deepEqual(parsed.rows['Herren'], ['Alpha Beispiel','Beta Beispiel','Gamma Beispiel','Delta Beispiel']);
});

test('incomplete or unrecognized reports are rejected', () => {
  assert.throws(() => assertCompleteSummerRoster(parseBtvRosterPdfText('unvollständiges Dokument')),
    /PDF_ROSTER_LAYOUT_INCOMPLETE|PDF_TEXT_MISSING/);
  assert.throws(() => assertCompleteSummerRoster(parseBtvRosterPdfText(fixture().replace('Mädchen 15 |', 'Unbekannt |'))),
    /PDF_ROSTER_LAYOUT_INCOMPLETE/);
});


test('verified snapshot accepts only the ten confirmed squad sections and 173 rows', () => {
  const groups = [
    'Herren II', 'Herren 40', 'Herren 40 II', 'Damen 40',
    'Junioren 18', 'Knaben 15', 'Knaben 15 II',
    'Bambini 12', 'Bambini 12 II', 'Bambini 12 III',
  ];
  const report = ['TSV Feldkirchen (01012), Sommer 2026'];
  groups.forEach((name, i) => {
    report.push(name + ' | Südligagruppe');
    const size = i < 3 ? 18 : 17;
    for (let n = 1; n <= size; n++) {
      report.push(n + ' Muster, Alpha  GER  12345678');
    }
  });
  const parsed = assertVerifiedSummerSnapshot(parseBtvRosterPdfText(report.join('\n')));
  assert.equal(parsed.diagnostics.numberedRows, 173);
  assert.equal(parsed.diagnostics.classCount, 6);
  assert.equal(parsed.diagnostics.headingCount, 10);
  assert.throws(() => assertVerifiedSummerSnapshot(parseBtvRosterPdfText(fixture())),
    /UNVERIFIED_NMM_SNAPSHOT/);
});
