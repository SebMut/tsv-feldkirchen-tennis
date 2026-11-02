import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/admin/index.astro', import.meta.url), 'utf8');

test('invitation explains each global permission and its scope', () => {
  for (const permission of ['events', 'news', 'ticker']) {
    assert.match(page, new RegExp('data-invite-permission value="' + permission + '"'));
  }
  for (const phrase of ['Veranstaltungen für den gesamten Verein', 'News für den gesamten Verein',
    'bestehende Begegnungen aller Mannschaften', 'Verknüpfte Kalendertermine benötigen zusätzlich']) {
    assert.ok(page.includes(phrase), phrase);
  }
});

test('invitation explains manager, editor and limited team ticker without overstating manager privileges', () => {
  for (const phrase of ['Mannschaftsrollen erklärt', 'Manager', 'Editor', 'Nur Liveticker',
    'gleichen Mannschafts-Bearbeitungsrechte wie Editor', 'nur für die ausgewählte Mannschaft']) {
    assert.ok(page.includes(phrase), phrase);
  }
  assert.match(page, /id="invite-teams"/);
  assert.match(page, /id="invite-global-role"/);
});

test('superadmin and standard account explanations remain accessible', () => {
  assert.match(page, /id="invite-superadmin-info"/);
  assert.match(page, /SuperAdmin – Vollzugriff/);
  assert.match(page, /Standard-Nutzer:.*Nur|Standard-Nutzer:/);
  assert.match(page, /Ohne eine Auswahl besteht kein Redaktions- oder Liveticker-Zugriff/);
});
