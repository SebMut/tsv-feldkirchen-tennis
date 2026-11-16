import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AGE_CLASSES, YOUTH_CLASSES, YOUTH_TEAM_SLUGS, canonicalAgeClass, laterSummerRosterTeams,
  isYouthClass, normalizeRosterNames, ageClassFromPdfHeading,
} from '../scripts/btv-roster-age-classes.mjs';

const ALL_TEAMS = Object.values(AGE_CLASSES).flat();

test('all club teams including 9 youth teams are mapped exactly once', () => {
  assert.equal(ALL_TEAMS.length, 20);
  assert.equal(new Set(ALL_TEAMS).size, 20);
  assert.equal(YOUTH_TEAM_SLUGS.length, 9);
  assert.equal(new Set(YOUTH_TEAM_SLUGS).size, 9);
  assert.equal(YOUTH_CLASSES.length, 5);
  assert.deepEqual(laterSummerRosterTeams('Bambini U12', 'sommer-2027', ALL_TEAMS),
    ['bambini-12', 'bambini-12-ii', 'bambini-12-iii']);
  assert.deepEqual(laterSummerRosterTeams('Junioren U18', 'sommer-2027', ALL_TEAMS), ['junioren-18', 'junioren-18-ii']);
  assert.deepEqual(laterSummerRosterTeams('Mädchen U15', 'sommer-2027', ALL_TEAMS), ['maedchen-15']);
  assert.deepEqual(laterSummerRosterTeams('Kleinfeld U9', 'sommer-2027', ALL_TEAMS), ['kleinfeld-u9']);
});
test('an age-class roster can be used by multiple same-age teams, without inferring played lineup', () => {
  assert.deepEqual(laterSummerRosterTeams('Herren', 'sommer-2027', ALL_TEAMS), ['herren', 'herren-ii', 'herren-iii']);
  assert.deepEqual(laterSummerRosterTeams('Herren 50', 'sommer-2027', ['herren-50']), ['herren-50']);
});
test('unknown categories and competitions fail closed', () => {
  assert.equal(canonicalAgeClass('Juniorinnen 18'), null);
  assert.deepEqual(laterSummerRosterTeams('Bambini 10', 'sommer-2027', ALL_TEAMS), []);
  assert.deepEqual(laterSummerRosterTeams('Herren', 'winter-2026-2027', ALL_TEAMS), []);
  assert.equal(isYouthClass('Junioren 18'), true);
  assert.equal(isYouthClass('Herren 40'), false);
});
test('name input must not accept ranking, birth dates, contact fields or duplicates', () => {
  assert.deepEqual(normalizeRosterNames(['Beispiel Spieler', '  BEISPIEL   SPIELER  ', 'Zweite Person']), [
    'Beispiel Spieler', 'Zweite Person',
  ]);
  for (const value of ['Beispiel 2013', 'Max Beispiel @foo.de', 'Muster 18.5', 'A/B', 'a', '']) {
    assert.throws(() => normalizeRosterNames([value]), /ROSTER_NAME_INVALID/);
  }
});
test('PDF league header detection accepts only known age classes', () => {
  assert.equal(ageClassFromPdfHeading('Herren II | Südliga 2'), 'Herren');
  assert.equal(ageClassFromPdfHeading('Herren I | Südliga 2'), 'Herren');
  assert.equal(ageClassFromPdfHeading('Bambini 12 I (4er) | Südliga'), 'Bambini 12');
  assert.equal(ageClassFromPdfHeading('Kleinfeld U9 I (4er) | Südliga'), 'Kleinfeld U9');
  assert.equal(ageClassFromPdfHeading('Damen (4er) | Südliga 5'), 'Damen');
  assert.equal(ageClassFromPdfHeading('Herren 50 II (4er) | Südliga 4'), 'Herren 50');
  assert.equal(ageClassFromPdfHeading('Bambini 12 III (4er) | Südliga'), 'Bambini 12');
  assert.equal(ageClassFromPdfHeading('Knaben 15 II | Südliga'), 'Knaben 15');
  assert.equal(ageClassFromPdfHeading('Junioren 18 | Südliga'), 'Junioren 18');
  assert.equal(ageClassFromPdfHeading('Mädchen 15 | Südliga'), 'Mädchen 15');
  assert.equal(ageClassFromPdfHeading('Kleinfeld U9 | Südliga'), 'Kleinfeld U9');
  assert.equal(ageClassFromPdfHeading('MF: Beispiel Person'), null);
  assert.equal(ageClassFromPdfHeading('Nicht TSV 16 | Südliga'), null);
});
test('protected PDF audit never uploads minors data to GitHub', () => {
  const js = readFileSync(new URL('../scripts/btv-roster-pdf-audit.mjs', import.meta.url), 'utf8');
  const yaml = readFileSync(new URL('../.github/workflows/btv-roster-private-import.yml', import.meta.url), 'utf8');
  assert.match(js, /ageClassFromPdfHeading/);
  assert.match(js, /NMM_YOUTH_HEADINGS_NOT_FOUND/);
  assert.match(js, /BTV_NMM_PLAYERS_STORED=0/);
  assert.match(js, /TSV/);
  assert.match(js, /readFileSync\(file\)/);
  assert.match(yaml, /secrets\.BTV_LOGIN_USERNAME/);
  assert.match(yaml, /secrets\.BTV_LOGIN_PASSWORD/);
  assert.match(yaml, /github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(yaml, /upload-artifact/);
});
