import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeSetResult, homeAwaySetScore } from '../src/lib/tennis-score.mjs';

const source = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = source('src/pages/spieltag/live-ticker/index.astro');
const client = source('src/scripts/tv-live-ticker.ts');
const styles = source('src/styles/tv-live-ticker.css');
const overview = source('src/pages/spieltag/index.astro');

test('standalone TV route uses screenshot-inspired live heading, real TSV logo and fullscreen action', () => {
  assert.match(page, /Jetzt live dabei/);
  assert.match(page, /LIVE · TSV FELDKIRCHEN TENNIS/);
  assert.match(page, /mediaUrl\('branding\/tennis-logo.png'\)/);
  assert.match(page, /id="tv-ticker-board"/);
  assert.match(page, /id="tv-ticker-count"/);
  assert.match(page, /id="tv-ticker-fullscreen"/);
  assert.match(overview, /href="\/spieltag\/live-ticker\/"/);
  assert.ok(!page.includes('MainLayout'), 'TV fullscreen must not show site header/footer/dock');
});

test('TV only reads real published matches, active live states and original encounter data', () => {
  assert.match(client, /from\('match_live_state'\)/);
  assert.match(client, /\.eq\('status', 'live'\)/);
  assert.match(client, /from\('matches'\)/);
  assert.match(client, /\.eq\('is_published', true\)/);
  assert.match(client, /from\('match_encounters'\)/);
  assert.match(client, /from\('team_seasons'\)/);
  assert.match(client, /from\('teams'\)/);
  assert.match(client, /match\.is_home \? club : String\(match\.opponent/);
  assert.match(client, /match\.is_home \? String\(match\.opponent/);
  assert.match(client, /Number\(state\.home_score \?\? 0\)/);
  assert.match(client, /Number\(state\.away_score \?\? 0\)/);
  assert.match(client, /encounter\.status === 'live' \|\| encounter\.status === 'finished'/);
  assert.match(client, /summarizeSetResult\(encounter\.result_text\)/);
  assert.match(client, /homeAwaySetScore\(result, !!match\.is_home\)/);
  assert.doesNotMatch(client, /insert\(|\.update\(|\.delete\(/);
});

test('TV polls every 30 seconds and preserves last good scoreboard when offline', () => {
  assert.match(client, /const REFRESH_MS = 30_000/);
  assert.match(client, /window\.setInterval\(tick, 1000\)/);
  assert.match(client, /Date\.now\(\) >= nextPollAt/);
  assert.match(client, /timing\.poll_seconds \* 1000/);
  assert.match(page, /id="tv-ticker-countdown"/);
  assert.match(client, /if \(inFlight\) return;/);
  assert.match(client, /if \(!lastSuccessful\)/);
  assert.match(client, /sync\.classList\.add\('tv-ticker__sync--error'\)/);
  assert.match(client, /sync\.classList\.remove\('tv-ticker__sync--error'\)/);
  assert.match(client, /Live-Spiele erscheinen hier automatisch/);
});

test('three encounters side by side at TV width, two at medium and one on small screens', () => {
  assert.match(styles, /\.tv-ticker__grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:1350px\)\{\.tv-ticker__grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:850px\)/);
  assert.match(styles, /\.tv-ticker__grid\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(styles, /\.tv-ticker__score-values/);
  assert.match(styles, /\.tv-ticker__sets/);
  assert.match(styles, /\.tv-ticker__game\.is-live:before/);
  assert.match(styles, /\.tv-ticker__game\.is-won/);
  assert.match(styles, /\.tv-ticker__game\.is-lost/);
  assert.match(client, /tv-ticker__player-logo/);
  assert.match(client, /renderEncounter\(match, e, timing, now\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
});

test('set rendering always follows the stored TSV perspective even for away games', () => {
  const result = summarizeSetResult('6:3 4:6 10:7');
  assert.equal(result.winner, 'tsv');
  assert.deepEqual(homeAwaySetScore(result, true), {homeSets:2,awaySets:1});
  assert.deepEqual(homeAwaySetScore(result, false), {homeSets:1,awaySets:2});
});

test('TV finished-score recap, victory duration and super-admin values are configurable', async () => {
  const {readTvTiming,recapIsActive,withinHighlight} = await import('../src/lib/tv-ticker-timing.mjs');
  const normal=readTvTiming(null);
  assert.equal(normal.poll_seconds,30);
  assert.equal(normal.recap_every_seconds,300);
  assert.equal(normal.recap_duration_seconds,30);
  assert.equal(normal.highlight_seconds,300);
  assert.equal(recapIsActive(normal,300000,0),true);
  assert.equal(recapIsActive(normal,329999,0),true);
  assert.equal(recapIsActive(normal,330000,0),false);
  assert.equal(withinHighlight(new Date(0).toISOString(),normal,299999),true);
  assert.equal(withinHighlight(new Date(0).toISOString(),normal,300000),false);
  const quick=readTvTiming({poll_seconds:5,recap_every_seconds:20,recap_duration_seconds:5,highlight_seconds:5});
  assert.equal(recapIsActive(quick,20000,0),true);
  assert.equal(recapIsActive(quick,26000,0),false);
  assert.equal(readTvTiming({poll_seconds:-1,recap_every_seconds:10,recap_duration_seconds:99}).poll_seconds,30);
  const admin=source('src/pages/admin/index.astro');
  const controller=source('src/scripts/admin-advanced.ts');
  for(const id of ['setting-tv-poll','setting-tv-recap-every','setting-tv-recap-for','setting-tv-highlight'])assert.ok(admin.includes(id));
  assert.match(controller,/\.eq\('key', 'tv_ticker_timing'\)/);
  assert.match(client,/recapIsActive\(timing, now, startedAt\)/);
  assert.match(client,/withinHighlight\(e\.finished_at, timing, now\)/);
  assert.match(client,/e\.status === \(showRecap \? 'finished' : 'live'\)/);
});

test('compact notebook and smartphone layouts preserve branding, live results and touch controls', () => {
  const livePage = source('src/pages/live/index.astro');
  assert.match(styles, /@media \(max-width: 1600px\)/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /\.tv-ticker__score \{ grid-template-columns: minmax\(0,1fr\) 48px; min-height: 69px; \}/);
  assert.match(styles, /\.tv-ticker__set \{ grid-template-rows: 16px minmax\(24px,1fr\) minmax\(24px,1fr\)/);
  assert.match(styles, /\.tv-ticker__player-logo \{ width: 17px; height: 17px; \}/);
  assert.match(styles, /\.tv-ticker__tools a,\.tv-ticker__tools button \{ padding: 4px 7px; min-height: 32px/);
  assert.match(livePage, /@media \(min-width: 601px\) and \(max-width: 1600px\)/);
  assert.match(livePage, /\.live-scorecenter \.live-scoreboard\)\{grid-template-columns:minmax\(0,1fr\) 68px minmax\(0,1fr\)/);
  assert.match(livePage, /\.live-scorecenter \.live-encounter-side--tsv img\)\{display:block;width:16px;height:16px/);
  assert.match(styles, /\.tv-ticker__tb-point/);
  assert.match(livePage, /live-set-scores/);
});

test('TV finished recap and live presentation are mutually exclusive', () => {
  assert.match(client, /const status = showRecap \? 'finished' : 'live';/);
  assert.match(client, /m\.encounters\.some\(e => e\.status === status\)/);
  assert.match(client, /e\.status === \(showRecap \? 'finished' : 'live'\)/);
  assert.match(client, /dataset\.viewMode = showRecap \? 'finished' : 'live'/);
  assert.match(client, /viewTitle\.textContent = showRecap \? 'Beendete Partien' : 'Jetzt live dabei'/);
  assert.match(client, /Nur beendete Partien/);
  assert.match(client, /Nur laufende Partien/);
  assert.doesNotMatch(client, /e\.status === 'finished' && \(showRecap \|\| withinHighlight/);
  assert.match(page, /id="tv-ticker-view-title"/);
  assert.match(page, /id="tv-ticker-view-label"/);
});

test('TV timings have an independent save action that checks real stored values', () => {
  const admin=source('src/pages/admin/index.astro');
  const controller=source('src/scripts/admin-advanced.ts');
  assert.match(admin, /id="save-tv-timing"[^>]*type="button"/);
  assert.match(admin, /id="tv-timing-feedback"/);
  assert.match(controller, /async function saveTvTimeSettings\(base: BaseState\)/);
  assert.match(controller, /const input = readTvTimeForm\(\)/);
  assert.match(controller, /from\('site_settings'\)[\s\S]*?\.update\(\{ value: input\.value, updated_by: base\.user\.id \}\)/);
  assert.match(controller, /\.select\('key,value'\)\.maybeSingle\(\)/);
  assert.match(controller, /\.select\('value'\)\.eq\('key', 'tv_ticker_timing'\)\.maybeSingle\(\)/);
  assert.match(controller, /\['#setting-tv-poll', 'Datenabfrage', 5, 600\]/);
  assert.match(controller, /Rückblick-Dauer/);
  assert.match(controller, /muss kürzer als der Rückblick-Abstand/);
  assert.match(controller, /button\.addEventListener\('click', \(\) => void saveTvTimeSettings\(base\)\)/);
  const generalSave=controller.split('async function saveSettings(')[1]?.split('async function loadPlacements(')[0];
  assert.ok(generalSave);
  assert.doesNotMatch(generalSave, /tv_ticker_timing|readTvTimeForm|setting-tv-poll/,
    'Unrelated site settings may not overwrite TV-specific changes');
});

test('manual view tabs override automatic cycle without mixing live and finished results', () => {
  assert.match(page, /data-tv-view="auto" aria-pressed="true"/);
  assert.match(page, /data-tv-view="live" aria-pressed="false"/);
  assert.match(page, /data-tv-view="finished" aria-pressed="false"/);
  assert.match(page, /role="group" aria-label="Partienansicht"/);
  assert.match(client, /viewOverride: 'live' \| 'finished' \| null = null/);
  assert.match(client, /viewOverride === 'finished' \|\| \(viewOverride === null && scheduledRecap\)/);
  assert.match(client, /button\.setAttribute\('aria-pressed', String\(selected\)\)/);
  assert.match(client, /renderBoard\(true\)/);
  assert.match(styles, /\.tv-ticker__view-switch button\[aria-pressed="true"\]/);
  assert.match(styles, /--tv-set-head:14px;--tv-set-player:22px/);
  assert.match(styles, /\.tv-ticker__score\{min-height:52px/);
});

test('TV timers bind immediately and update only the existing setting, with readback', () => {
  const bootstrap=source('src/scripts/admin.ts');
  const controller=source('src/scripts/admin-advanced.ts');
  assert.match(bootstrap, /bindTvTimingControls\(state\);/);
  assert.ok(bootstrap.indexOf('bindTvTimingControls(state);') < bootstrap.indexOf('await Promise.all([refreshDashboard()'));
  assert.match(controller, /button\.dataset\.tvTimingBound = 'true'/);
  assert.match(controller, /\.eq\('key', 'tv_ticker_timing'\)[\s\S]*?\.select\('key,value'\)\.maybeSingle\(\)/);
  assert.doesNotMatch(controller.split('async function saveTvTimeSettings(')[1].split('async function saveSettings(')[0], /\.upsert\(/);
  assert.match(controller, /Die TV-Zeiten konnten nicht aus Supabase zurückgelesen werden/);
});
