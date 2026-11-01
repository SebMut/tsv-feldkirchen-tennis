import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const markup = source('src/pages/admin/index.astro');
const behavior = source('src/scripts/admin.ts');
const css = source('src/styles/global.css');

test('admin uses task-based navigation without removing existing panels', () => {
  for (const group of ['start', 'spielbetrieb', 'inhalte', 'verwaltung']) {
    assert.match(markup, new RegExp('data-admin-nav-group="' + group + '"'));
  }
  for (const panel of [
    'dashboard', 'teams', 'players', 'matches', 'news', 'btv-import',
    'manual-results', 'official-rubbers', 'audit', 'galleries', 'seasons',
    'facility', 'content', 'settings', 'users', 'account',
  ]) {
    assert.match(markup, new RegExp('data-panel="' + panel + '"'));
    assert.match(markup, new RegExp('id="panel-' + panel + '"'));
  }
  assert.match(behavior, /button\.classList\.contains\('hidden'\)/);
  assert.match(behavior, /target\.classList\.contains\('hidden'\)/);
  assert.match(behavior, /setAttribute\('aria-current', 'page'\)/);
});

test('small screens get role-aware section picker and flexible layout', () => {
  assert.match(markup, /id="admin-panel-select"/);
  assert.match(behavior, /visibleButtons\.length === 0/);
  assert.match(behavior, /picker\.addEventListener\('change'/);
  assert.match(css, /\.admin-mobile-picker\{display:grid/);
  assert.match(css, /\.admin-nav\.card\{display:none\}/);
  assert.match(css, /\.admin-shell\{grid-template-columns:minmax\(0,1fr\)/);
});

test('dashboard search, status filter and summaries keep ticker shortcuts', () => {
  for (const id of [
    'dashboard-team-search', 'dashboard-team-filter', 'dashboard-team-count',
    'dashboard-team-empty', 'admin-stat-teams', 'admin-stat-upcoming', 'admin-stat-live',
  ]) {
    assert.ok(markup.includes('id="' + id + '"'));
  }
  assert.match(behavior, /function applyDashboardTeamFilters\(\)/);
  assert.match(behavior, /\[data-dashboard-team-card\]/);
  assert.match(behavior, /data-has-next="\$\{next/);
  assert.match(behavior, /data-is-live="\$\{nextLive/);
  assert.match(behavior, /applyDashboardTeamFilters\(\);/);
  assert.match(markup, /data-admin-jump="matches" data-ticker-only/);
  assert.match(markup, /data-admin-jump="players" data-editor-only/);
  assert.match(markup, /data-admin-jump="manual-results" data-super-only/);
  assert.match(behavior, /const openMatch = async \(matchId: string\)/);
});

test('admin styles have focus support and respect reduced motion', () => {
  assert.match(css, /\.admin-panel :is\(input,select,textarea,button,a\):focus-visible/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(markup, /href=\{import\.meta\.env\.BASE_URL\}/);
});
