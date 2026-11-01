import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('src/pages/veranstaltung/index.astro');
const form = read('src/scripts/event-rsvp.ts');
const adminPage = read('src/pages/admin/index.astro');
const admin = read('src/scripts/event-rsvp-admin.ts');
const sql = read('supabase/migrations/20261101214000_sommerfest_2024_invitation_fields.sql');
const css = read('src/styles/global.css');

test('invitation retains content structure from 2024 without announcing expired dates', () => {
  assert.ok(page.includes('Liebe Tennisfreunde'));
  assert.ok(page.includes('Punktspielsaison'));
  assert.ok(page.includes('Eltern, Partner und Freunde'));
  assert.ok(page.includes('Speis und Trank'));
  assert.ok(page.includes('Kuchen oder Nachspeise'));
  assert.ok(page.includes('Salat oder Vorspeise'));
  assert.ok(page.includes('Jugendvereinsmeisterschaften'));
  assert.ok(page.includes('Wird noch bekannt gegeben'));
  assert.ok(!page.includes('20.07.2024'));
  assert.ok(!page.includes('15.07.2024'));
  assert.ok(adminPage.includes('Originalvorlage 2024'));
  assert.ok(adminPage.includes('Damalige Unkostenbeiträge'));
  assert.ok(adminPage.includes('Diese Angaben sind ausschließlich ein Beispiel aus 2024'));
});

test('membership survey has adult and child counts and independent youth signups', () => {
  assert.ok(page.includes('id="rsvp-adults-count"'));
  assert.ok(page.includes('id="rsvp-children-count"'));
  assert.ok(page.includes('id="rsvp-dessert"'));
  assert.ok(page.includes('id="rsvp-salad"'));
  assert.ok(page.includes('id="rsvp-help-setup"'));
  assert.ok(page.includes('id="rsvp-help-cleanup"'));
  assert.ok(page.includes('id="rsvp-youth-rows"'));
  assert.ok(page.includes('id="rsvp-add-youth"'));
  assert.ok(page.includes('Zustimmung der Erziehungsberechtigten'));
  for (const category of ['u10-mixed','u12-m','u15-m','u18-m','u18-w']) assert.ok(form.includes(category));
  assert.ok(form.includes('Die Einteilung kann sich je nach Anmeldungen ändern') || page.includes('Die Einteilung kann sich je nach Anmeldungen ändern'));
  assert.ok(form.includes('if (name.length < 2 || name.length > 100'));
});

test('validation and backend ensure sensible responses and no public PII', () => {
  assert.ok(sql.includes('add column if not exists adults_count integer'));
  assert.ok(sql.includes('add column if not exists children_count integer'));
  assert.ok(sql.includes('dessert_contribution'));
  assert.ok(sql.includes('salad_contribution'));
  assert.ok(sql.includes('help_setup boolean'));
  assert.ok(sql.includes('help_cleanup boolean'));
  assert.ok(sql.includes('youth_registrations jsonb'));
  assert.ok(sql.includes('party_size = adults_count + children_count'));
  assert.ok(sql.includes('v_group > 20'));
  assert.ok(sql.includes("p_attendance='yes' and v_group < 1"));
  assert.ok(sql.includes('jsonb_array_length(v_youth) > 12'));
  assert.ok(sql.includes('youth_registrations=excluded.youth_registrations'));
  assert.ok(sql.includes('and (e.rsvp_deadline is null or e.rsvp_deadline >= now())'));
  assert.ok(form.includes("supabase.rpc('submit_event_rsvp'"));
  assert.ok(!form.includes(".from('event_rsvps')"));
  assert.ok(sql.includes('grant execute on function public.submit_event_rsvp'));
});

test('the invitation details and RSVP deadline are editable and optional', () => {
  for (const id of ['rsvp-admin-deadline','rsvp-admin-fees','rsvp-admin-setup',
    'rsvp-admin-cleanup','rsvp-admin-youth-note']) assert.ok(adminPage.includes('id="'+id+'"'),id);
  assert.ok(admin.includes('rsvp_deadline: deadline ? new Date(deadline).toISOString() : null'));
  assert.ok(admin.includes('rsvp_details: {'));
  assert.ok(form.includes('event.rsvp_details'));
  assert.ok(form.includes("byId<HTMLElement>('rsvp-fees-note')"));
  assert.ok(form.includes("byId<HTMLElement>('rsvp-youth-note')"));
  assert.ok(form.includes('event.rsvp_deadline'));
  assert.ok(form.includes("byId<HTMLElement>('rsvp-source-note')?.classList.add('hidden')"));
});

test('admins get buffet, helpers and youth individual records without public list', () => {
  assert.ok(admin.includes('adults_count,children_count,dessert_contribution,salad_contribution,help_setup,help_cleanup,youth_registrations'));
  assert.ok(admin.includes('Aufbau'));
  assert.ok(admin.includes('Abbau'));
  assert.ok(admin.includes('Jugendmeisterschaften'));
  assert.ok(admin.includes('escapeHtml(String(entry.name'));
  assert.ok(admin.includes('escapeHtml(row.member_name)'));
  assert.ok(page.includes('nur für die Vereinsorganisation bestimmt'));
});

test('responsive invitation maintains legible form inputs', () => {
  assert.ok(css.includes('.rsvp-party-grid'));
  assert.ok(css.includes('.rsvp-youth-row'));
  assert.ok(css.includes('@media(max-width:760px)'));
  assert.ok(css.includes('.rsvp-invitation-details__list'));
});
