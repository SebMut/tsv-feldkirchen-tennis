import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sideToTeam, sourceForYear } from '../scripts/btv-schedule.mjs';
import { VERIFIED_GROUPS, winterGroupUrl } from '../scripts/btv-winter-schedule.mjs';

const source = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('summer parser recognizes home and away without inferring the venue', () => {
  const home = sideToTeam('Herren', 'TC Muster');
  const away = sideToTeam('TC Muster', 'Herren');
  assert.equal(home.slug, 'herren');
  assert.equal(home.isHome, true);
  assert.equal(home.opponent, 'TC Muster');
  assert.equal(away.slug, 'herren');
  assert.equal(away.isHome, false);
  assert.equal(away.opponent, 'TC Muster');
});

test('four-player fixture is correctly flagged, ambiguous names fail closed', () => {
  assert.equal(sideToTeam('Damen (4er)', 'TC Muster')?.four, true);
  assert.equal(sideToTeam('Herren', 'Herren II'), null);
  assert.equal(sideToTeam('Unknown A', 'Unknown B'), null);
});

test('never guess a new BTV summer competition ID', () => {
  assert.match(sourceForYear(2026), /season=18105/);
  assert.throws(() => sourceForYear(2027), /not verified\/configured/);
});

test('winter list is verified and limited to three actual groups', () => {
  assert.equal(VERIFIED_GROUPS.length, 3);
  assert.deepEqual(new Set(VERIFIED_GROUPS.map((g) => g.slug)),
    new Set(['herren', 'herren-ii', 'herren-50']));
  for (const group of VERIFIED_GROUPS) {
    assert.ok(winterGroupUrl(group.group).includes('group=' + group.group));
  }
  assert.throws(() => winterGroupUrl(123), /unverified/);
});

test('public match routes use actual venue address and never default to club grounds', () => {
  const code = source('src/scripts/public.ts');
  assert.match(code, /const destination = address \|\| venue/);
  assert.match(code, /google\.com\/maps\/dir\/\?api=1/);
  assert.match(code, /match\.is_home \? 'Heim' : 'Auswärts'/);
});

test('mobile ticker preserves unsaved input and has accessible details', () => {
  const js = source('src/scripts/admin.ts');
  const html = source('src/pages/admin/index.astro');
  const css = source('src/styles/global.css');
  assert.match(js, /const pendingMatchDrafts = new Map/);
  assert.match(js, /trackMatchDrafts\(target\)/);
  assert.match(js, /beforeunload/);
  assert.match(js, /<details class="encounter-card/);
  assert.match(html, /id="matches-admin-game"/);
  assert.match(css, /@media\(max-width:375px\)/);
  assert.match(css, /min-height:52px/);
});

test('mobile ticker must not double publish and keeps four- and six-player formats', () => {
  const js = source('src/scripts/admin.ts');
  assert.match(js, /if \(publishButton\.disabled\) return/);
  assert.match(js, /publishButton\.disabled = true/);
  assert.match(js, /if \(button\.disabled\) return/);
  assert.match(js, /window\.confirm\('Den ganzen Spieltag wirklich beenden\?'\)/);
  assert.match(js, /match\.lineup_format === '4_2'/);
  assert.match(js, /'6_3'/);
});

test('an accidentally started live ticker can return to scheduled without deleting results', () => {
  const js = source('src/scripts/admin.ts');
  assert.match(js, /data-live-action="reset"/);
  assert.match(js, /Aufstellungen und gespeicherte Ergebnisse bleiben erhalten/);
  assert.match(js, /status: 'scheduled', started_at: null, finished_at: null/);
  assert.doesNotMatch(js, /action === 'reset'[\s\S]{0,300}match_encounters[^\n]*delete/);
});

test('the roster bulk import requires authorization and starts private', () => {
  const js = source('src/scripts/admin.ts');
  const html = source('src/pages/admin/index.astro');
  assert.match(js, /canEditTeamId\(ts\.team_id\)/);
  assert.match(js, /!verified\?\.checked/);
  assert.match(js, /Keine öffentliche Freigabe erfolgt/);
  assert.match(html, /id="roster-bulk-verified"/);
  assert.match(html, /öffentliche Freigabe erfolgt bei jeder Person separat/);
});

test('team administration separates summer, winter and future seasons', () => {
  const js = source('src/scripts/admin.ts');
  const html = source('src/pages/admin/index.astro');
  assert.match(html, /Mannschaft \/ Saison/);
  assert.match(js, /renderAdminTeamSeasonFilter\(\)/);
  assert.match(js, /state\.teamSeasons\.find\(\(row\) => row\.id === select\.value\)/);
  assert.match(js, /team_image_path: path/);
  assert.match(js, /Sommer \$\{String\(season\.code\)/);
  assert.match(html, /data-team-season="sommer-2026"/);
  assert.match(html, /data-team-season="winter-2026-2027"/);
  assert.match(html, /data-team-season="sommer-2027"/);
  assert.match(js, /ts\.season_id === season\?\.id/);
});

test('roster administration separates summer, winter and future seasons', () => {
  const html = source('src/pages/admin/index.astro');
  const admin = source('src/scripts/admin.ts');

  assert.match(html, /data-roster-season="sommer-2026"/);
  assert.match(html, /data-roster-season="winter-2026-2027"/);
  assert.match(html, /data-roster-season="sommer-2027"/);
  assert.match(admin, /rosterSeasonFilterCode/);
  assert.match(admin, /renderAdminRosterSeasonFilter/);
  assert.match(admin, /\['herren', 'herren-ii', 'herren-50'\]/);
});

test('team pages always show their navigation level', () => {
  const overview = source('src/pages/mannschaften/index.astro');
  const detail = source('src/pages/mannschaften/[slug].astro');
  const component = source('src/components/Breadcrumbs.astro');

  assert.match(overview, /label: 'Startseite'/);
  assert.match(overview, /label: 'Mannschaften'/);
  assert.match(detail, /label: 'Mannschaften', href: '\/mannschaften\/'/);
  assert.match(detail, /label: 'Herren', key: 'herren'/);
  assert.match(detail, /label: 'Damen', key: 'damen'/);
  assert.match(detail, /label: 'Junioren', key: 'junioren'/);
  assert.match(detail, /mannschaften\/\?category=\$\{teamGroup\.key\}/);
  assert.match(detail, /label: teamName/);
  const publicJs = source('src/scripts/public.ts');
  assert.match(publicJs, /params\.get\('category'\) \|\| params\.get\('gruppe'\)/);
  assert.match(publicJs, /seasonForGroup\(activeCategory\)/);
  assert.match(publicJs, /url\.searchParams\.set\('season', currentSeasonCode\)/);
  assert.match(source('src/scripts/public.ts'), /\{ id: 'junioren', name: 'Junioren' \}/);
  assert.match(source('src/scripts/public.ts'), /groupForTeam\(team\) === activeCategory/);
  assert.match(component, /aria-current="page"/);
  assert.match(component, /aria-label="Brotkrümelnavigation"/);
});

test('season management controls the initial Mannschaften season', () => {
  const admin = source('src/scripts/admin-advanced.ts');
  const publicJs = source('src/scripts/public.ts');
  assert.match(admin, /update\(\{ is_current: true, archived_at: null \}\)/);
  assert.match(publicJs, /const managedCurrentSeason = seasonCodes\.map\(code => seasonByCode\.get\(code\)\)/);
  assert.match(publicJs, /s\?\.is_current && !s\.archived_at/);
  assert.match(publicJs, /const defaultSeason = managedCurrentSeason \|\| byCurrentDate/);
  // Aufruf per ?season=... bleibt wichtiger als die initiale Voreinstellung.
  assert.match(publicJs, /activeCode = requestedCode \|\| \(activeCategory \? seasonForGroup\(activeCategory\)/);
});

test('public team navigation labels summer correctly and follows managed active season', () => {
  const html = source('src/pages/mannschaften/index.astro');
  const publicJs = source('src/scripts/public.ts');
  assert.match(html, /<strong>Sommer 2026<\/strong>/);
  assert.doesNotMatch(html, /<strong>Saison 2026<\/strong>/);
  assert.match(publicJs, /const publishedSeasons = reference\.seasons\.filter/);
  assert.match(publicJs, /const seasonCodes = \[\.\.\.new Set\(/);
  assert.match(publicJs, /const defaultSeason = managedCurrentSeason \|\| byCurrentDate/);
  assert.match(publicJs, /const requestedCode = seasonCodes\.includes/);
  assert.match(publicJs, /activeCode = requestedCode \|\|/);
  assert.match(source('src/pages/sw.js.ts'), /tsv-tennis-public-v2/);
});

test('training page stays compact with school photos, logo and linked training types', () => {
  const training = source('src/pages/training/index.astro');
  assert.match(training, /Tennisschule Alex Braun/);
  assert.match(training, /logo-weiss_1pt_original-1\.png/);
  assert.match(training, /startseite_4\.jpg/);
  assert.match(training, /startseite_2\.jpg/);
  assert.match(training, /background:#f28323/);
  assert.match(training, /const schoolImages = 'https:\/\/www\.tennisschule-alexbraun\.de\/wp-content\/uploads'/);
  assert.match(training, /img\.addEventListener\('error', retry\)/);
  assert.match(training, /img\.complete && img\.naturalWidth === 0/);
  assert.doesNotMatch(training, /knownPhoto/);
  assert.match(training, /img\.hidden = true/);
  assert.match(training, /angebote_1\.jpg/);
  assert.match(training, /angebote_4\.jpg/);
  assert.match(training, /angebote_2\.jpg/);
  assert.match(training, /startseite_4\.jpg/);
  assert.match(training, /referrerpolicy="no-referrer"/);
  for (const offer of ['Sommertraining', 'Wintertraining', 'Einzeltraining', 'Gruppentraining', 'Mannschaftstraining', 'Tenniscamps']) {
    assert.ok(training.includes(offer), offer + ' fehlt');
  }
  assert.match(training, /<ul class="training-simple__list">/);
  assert.match(training, /tennisschule-alexbraun\.de\/angebote\//);
  assert.match(training, /Trainingsangebote &amp; Anmeldung/);
  assert.doesNotMatch(training, /data-managed-page="training"/);
  assert.doesNotMatch(training, /Weitere organisatorische Informationen/);
  assert.doesNotMatch(training, /loadManagedPage\('training'\)/);
  assert.match(training, /@media\(max-width:600px\)/);
  assert.doesNotMatch(training, /iframe/);
});

test('news optionally creates one linked calendar appointment', () => {
  const js = source('src/scripts/admin.ts');
  const html = source('src/pages/admin/index.astro');
  assert.match(html, /id="news-event-start" type="datetime-local"/);
  assert.doesNotMatch(html, /id="panel-events"/);
  assert.match(js, /external_url:`news:\$\{newsId\}`/);
  assert.match(js, /if\(eventStart\)/);
  assert.match(js, /else if\(linked\.data\)/);
});

test('only the BTV cron supports both seasons and remains write-protected', () => {
  const yaml = source('.github/workflows/btv-club-sync.yml');
  assert.match(yaml, /cron: '17 \*\/6 \* \* \*'/);
  assert.match(yaml, /BTV_SEASON_CODE: winter-2026-2027/);
  assert.match(yaml, /vars\.BTV_IMPORT_ENABLED == 'true'/);
  assert.match(yaml, /secrets\.BTV_SUPABASE_SECRET_KEY/);
});

test('actual production deployment still needs explicit separate approval', () => {
  const yaml = source('.github/workflows/deploy-united-domains.yml');
  assert.match(yaml, /inputs\.final_approval == 'TSV-FELDKIRCHEN-GO-LIVE'/);
  assert.match(yaml, /vars\.TSV_GO_LIVE_APPROVED == 'true'/);
});
