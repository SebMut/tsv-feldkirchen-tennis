import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AGE_CLASSES, YOUTH_CLASSES, YOUTH_TEAM_SLUGS, SUMMER_2026_TEAM_SLUGS,
  WINTER_2026_27_TEAM_SLUGS, canonicalAgeClass, rosterTeams,
  isYouthClass, normalizeRosterNames, planPrivateRosterImport, ageClassFromPdfHeading,
} from '../scripts/btv-roster-age-classes.mjs';

test('all 20 TSV summer teams including 9 youth teams are mapped exactly once', () => {
  assert.equal(SUMMER_2026_TEAM_SLUGS.length, 20);
  assert.equal(new Set(SUMMER_2026_TEAM_SLUGS).size, 20);
  assert.equal(YOUTH_TEAM_SLUGS.length, 9);
  assert.equal(new Set(YOUTH_TEAM_SLUGS).size, 9);
  assert.equal(YOUTH_CLASSES.length, 5);
  assert.deepEqual(rosterTeams('Bambini U12', 'sommer-2026'),
    ['bambini-12', 'bambini-12-ii', 'bambini-12-iii']);
  assert.deepEqual(rosterTeams('Junioren U18', 'sommer-2026'), ['junioren-18', 'junioren-18-ii']);
  assert.deepEqual(rosterTeams('Knaben U15', 'sommer-2026'), ['knaben-15', 'knaben-15-ii']);
  assert.deepEqual(rosterTeams('Mädchen U15', 'sommer-2026'), ['maedchen-15']);
  assert.deepEqual(rosterTeams('Kleinfeld U9', 'sommer-2026'), ['kleinfeld-u9']);
});
test('an age-class roster can be used by multiple same-age teams, without inferring played lineup', () => {
  assert.deepEqual(rosterTeams('Herren', 'sommer-2026'), ['herren', 'herren-ii', 'herren-iii']);
  assert.deepEqual(rosterTeams('Herren 50', 'sommer-2026'), ['herren-50', 'herren-50-ii']);
  assert.deepEqual(rosterTeams('Herren 50', 'winter-2026-2027'), ['herren-50']);
  assert.deepEqual(rosterTeams('Knaben 15', 'winter-2026-2027'), []);
  assert.equal(WINTER_2026_27_TEAM_SLUGS.length, 3);
});
test('unknown categories and competitions fail closed', () => {
  assert.equal(canonicalAgeClass('Juniorinnen 18'), null);
  assert.deepEqual(rosterTeams('Bambini 10', 'sommer-2026'), []);
  assert.deepEqual(rosterTeams('Bambini 12', 'sommer-2027'), []);
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
test('youth import plans are private and require every mapped club team', () => {
  const plan = planPrivateRosterImport({
    seasonCode: 'sommer-2026', ageClass: 'Bambini 12',
    names: ['Spieler Muster'], existingTeams: [...SUMMER_2026_TEAM_SLUGS],
  });
  assert.equal(plan.isYouth, true);
  assert.equal(plan.publicVisible, false);
  assert.equal(plan.teamSlugs.length, 3);
  assert.throws(() => planPrivateRosterImport({
    seasonCode: 'sommer-2026', ageClass: 'Bambini 12',
    names: ['Spieler Muster'], existingTeams: ['bambini-12'],
  }), /TEAM_SEASON_MAPPING_INCOMPLETE/);
});
test('PDF league header detection accepts only known age classes', () => {
  assert.equal(ageClassFromPdfHeading('Herren II | Südliga 2'), 'Herren');
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
  const yaml = readFileSync(new URL('../.github/workflows/btv-roster-pdf-audit.yml', import.meta.url), 'utf8');
  assert.match(js, /canonicalAgeClass/);
  assert.match(js, /NMM_YOUTH_HEADINGS_NOT_FOUND/);
  assert.match(js, /BTV_NMM_PLAYERS_STORED=0/);
  assert.match(js, /TSV/);
  assert.match(js, /readFileSync\(file\)/);
  assert.match(yaml, /secrets\.BTV_LOGIN_USERNAME/);
  assert.match(yaml, /secrets\.BTV_LOGIN_PASSWORD/);
  assert.match(yaml, /github\.ref == 'refs\/heads\/main'/);
  assert.match(yaml, /github\.event_name != 'pull_request'/);
  assert.doesNotMatch(yaml, /upload-artifact|supabase|BTV_SUPABASE_SECRET_KEY/);
});
