import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ui = src('src/scripts/admin-advanced.ts');
const css = src('src/styles/global.css');
const server = src('supabase/functions/admin-users/index.ts');

test('each user card shows loaded and saved rights above editable controls', () => {
  const card = ui.slice(ui.indexOf('return `<article class="card flat user-admin-card"'),ui.indexOf('</article>`;'));
  assert.ok(card.indexOf('${renderStoredUserPermissions(user, base)}')>=0);
  assert.ok(card.indexOf('${renderStoredUserPermissions(user, base)}')<card.indexOf('data-user-permission'));
  assert.match(ui,/function renderStoredUserPermissions\(user: Row, base: BaseState\)/);
  assert.match(ui,/Aktuell vergebene Berechtigungen/);
  assert.match(ui,/In Supabase gespeichert/);
  assert.match(ui,/Änderungen unten werden erst nach/);
  assert.match(ui,/await loadAdvancedUsers\(base\)/);
});

test('summary identifies super admin, global grants, active team roles and empty access', () => {
  for (const label of ['SuperAdmin','News erstellen und bearbeiten','Veranstaltungen verwalten',
      'Liveticker aller Mannschaften','Manager','Editor','Nur Liveticker','Keine zusätzlichen globalen Rechte',
      'Keiner Mannschaft zugeordnet','Mannschaft, Kader und Liveticker']) {
    assert.ok(ui.includes(label),label);
  }
  assert.match(ui,/membership\.active && \['manager','editor','ticker'\]\.includes\(membership\.role\)/);
  assert.match(ui,/const explicitGlobals = new Set<string>/);
  assert.match(ui,/const isSuper = user\.global_role === 'super_admin'/);
  assert.match(ui,/escapeHtml\(teamName\(base, membership\.team_id\)/);
  assert.match(server,/team_memberships: membershipMap\.get\(profile\.id\) \?\? \[\]/);
  assert.match(css,/\.user-rights-summary__teams\{display:flex;flex-wrap:wrap/);
  assert.match(css,/@media\(max-width:600px\)\{\s*\.user-rights-summary/);
});
