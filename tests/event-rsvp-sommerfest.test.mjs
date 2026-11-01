import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('src/pages/veranstaltung/index.astro');
const script=read('src/scripts/event-rsvp.ts');
const adminPage=read('src/pages/admin/index.astro');
const admin=read('src/scripts/event-rsvp-admin.ts');
const init=read('src/scripts/admin.ts');
const publicCode=read('src/scripts/public.ts');
const sql=read('supabase/migrations/20261101190000_event_rsvp_sommerfest.sql');
const css=read('src/styles/global.css');

test('Sommerfest example is visibly marked as a demo until published',()=>{
  assert.ok(page.includes('Sommerfest beim TSV Feldkirchen'));
  assert.ok(page.includes('Beispielansicht'));
  assert.ok(page.includes('Antworten werden hier noch nicht gespeichert'));
  assert.ok(script.includes('if (!event) {'));
  assert.ok(script.includes('diese Demo-Antwort wurde nicht gespeichert'));
  assert.ok(!sql.includes('insert into public.events'));
});

test('three participation choices and count only for yes, self counted',()=>{
  for(const v of ['yes','maybe','no'])assert.ok(page.includes('value="'+v+'"'));
  assert.ok(page.includes('name="party_size" min="1" max="20"'));
  assert.ok(script.includes("countWrap.hidden = choice() !== 'yes'"));
  assert.ok(script.includes("selected === 'yes' ? Number(countInput.value) : 0"));
  assert.ok(script.includes('Math.min(20'));
  assert.ok(page.includes('Inklusive dir selbst'));
});

test('public writes via scoped RPC and retains private edit key on same device',()=>{
  assert.ok(script.includes("supabase.rpc('submit_event_rsvp'"));
  assert.ok(script.includes('p_edit_key: editKey'));
  assert.ok(script.includes('crypto.randomUUID()'));
  assert.ok(script.includes('localStorage.setItem(keyName, editKey)'));
  assert.ok(script.includes(".eq('status', 'published').eq('rsvp_enabled', true)"));
  assert.ok(script.includes(".rpc('event_rsvp_summary'"));
  assert.ok(!script.includes(".from('event_rsvps')"));
});

test('personal answers are not readable by anonymous visitors',()=>{
  assert.ok(sql.includes('alter table public.event_rsvps enable row level security'));
  assert.ok(sql.includes('revoke all on table public.event_rsvps from anon, authenticated'));
  assert.ok(sql.includes('event_rsvps_super_admin_select'));
  assert.ok(sql.includes('private.is_super_admin()'));
  assert.ok(!sql.includes('grant select on public.event_rsvps to anon'));
  assert.ok(sql.includes('edit_key uuid not null'));
  assert.ok(sql.includes('on conflict (event_id, edit_key) do update set'));
  assert.ok(sql.includes("e.status = 'published'"));
  assert.ok(sql.includes('e.rsvp_enabled = true'));
});

test('aggregated count never exposes participant names and supports all choices',()=>{
  assert.ok(sql.includes('public.event_rsvp_summary'));
  assert.ok(sql.includes("count(*) filter (where attendance = 'yes')"));
  assert.ok(sql.includes("count(*) filter (where attendance = 'maybe')"));
  assert.ok(sql.includes("coalesce(sum(party_size) filter (where attendance = 'yes'), 0)"));
  assert.ok(script.includes('rsvp-stat-people'));
});

test('admins can schedule and publish real events, see private RSVP rows',()=>{
  assert.ok(adminPage.includes('id="panel-rsvp-events" class="admin-panel" data-super-only'));
  assert.ok(adminPage.includes('id="rsvp-admin-start" type="datetime-local" required'));
  assert.ok(adminPage.includes('id="rsvp-admin-status"'));
  assert.ok(adminPage.includes('id="rsvp-admin-list"'));
  assert.ok(admin.includes('if (!access.isSuper) return'));
  assert.ok(admin.includes("supabase.from('events').insert"));
  assert.ok(admin.includes("supabase.from('event_rsvps')"));
  assert.ok(admin.includes('escapeHtml(row.member_name)'));
  assert.ok(init.includes('initEventRsvpAdmin({ isSuper: true, user: state.user })'));
});

test('calendar links published signup events and controls are responsive',()=>{
  assert.ok(publicCode.includes('e.rsvp_enabled ?'));
  assert.ok(publicCode.includes('Teilnahme zusagen oder absagen'));
  assert.ok(css.includes('.rsvp-page__grid{display:grid;grid-template-columns'));
  assert.ok(css.includes('@media(max-width:950px)'));
  assert.ok(css.includes('.rsvp-choice.is-chosen'));
  assert.ok(css.includes('.rsvp-field input:focus-visible'));
});
