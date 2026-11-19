import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('src/pages/admin/index.astro');
const exportUi=read('src/scripts/rsvp-export-admin.ts');
const manager=read('src/scripts/rsvp-manage-admin.ts');
const shared=read('src/scripts/event-rsvp-admin.ts');
const edge=read('supabase/functions/event-rsvp-email/index.ts');
const sql=read('supabase/migrations/20261119200044_event_rsvp_admin_manage_email.sql');
const css=read('src/styles/admin-rsvp-export.css');

test('existing protected RSVP PDF panel also shows registrants by event',()=>{
  assert.match(page,/id="panel-rsvp-export"/);
  assert.match(exportUi,/data-manage-event/);
  assert.match(exportUi,/data-rsvp-manage-inline/);
  assert.match(exportUi,/data-export-event/);
  assert.match(exportUi,/downloadRsvpPdf\(\{/);
  assert.match(shared,/id,event_id,member_name,member_email/);
  assert.match(manager,/fetchVerifiedEventRsvps\(currentEvent\.id\)/);
  assert.match(manager,/sortRsvpBySurname/);
});

test('admin management includes edit, deletion warning and retryable notification',()=>{
  assert.match(manager,/admin-rsvp-update/);
  assert.match(manager,/admin-rsvp-delete/);
  assert.match(manager,/admin-rsvp-retry/);
  assert.match(manager,/Anmeldung wirklich löschen/);
  assert.match(manager,/Speichern & E-Mail senden/);
  assert.match(manager,/rsvp-manage-retry/);
  assert.match(manager,/admin-rsvp-notifications/);
  assert.match(manager,/rsvp-manage-unsent/);
  assert.match(manager,/data-rsvp-resend/);
  assert.match(manager,/rsvp-manage-dialog/);
  assert.match(manager,/dialog\.showModal\(\)/);
  assert.match(manager,/if\(e\.target===dialog\)dialog\.close\(\)/);
  assert.match(manager,/data-rsvp-close/);
  assert.ok(!manager.includes('service_role'));
});

test('write actions verify Supabase user JWT and existing global events permission on server',()=>{
  assert.match(edge,/db\.auth\.getUser\(match\[1\]\)/);
  assert.match(edge,/global_role!=='super_admin'/);
  assert.match(edge,/global_permissions\?\.includes\('events'\)/);
  assert.match(edge,/admin_change_event_rsvp/);
  assert.match(sql,/revoke all on function public\.admin_change_event_rsvp/);
  assert.match(sql,/grant execute on function public\.admin_change_event_rsvp.*to service_role/s);
  assert.match(sql,/revoke all on table public\.event_rsvp_admin_notifications from public, anon, authenticated/);
  assert.match(sql,/enable row level security/);
  assert.ok(!sql.includes('grant update on public.event_rsvps to authenticated'));
});

test('changes are atomic with pending mail; failed mail may be retried without exposing secrets',()=>{
  assert.match(sql,/for update;/);
  assert.match(sql,/RSVP_CONFLICT/);
  assert.match(sql,/insert into public\.event_rsvp_admin_notifications/);
  assert.match(sql,/mail_status text not null default 'pending'/);
  assert.match(edge,/sendAdminRsvpNotice/);
  assert.match(edge,/\.in\('mail_status',\['pending','failed'\]\)/);
  assert.match(edge,/mail_status:'failed'/);
  assert.match(edge,/mail_status:'sent'/);
  assert.match(edge,/recipient_email:'',before_data:\{\},after_data:null/);
  assert.match(edge,/sendGmail\(notice\.recipient_email,plain,html/);
  assert.match(edge,/admin-rsvp-retry/);
  assert.match(edge,/notice\.recipient_email/);
  assert.ok(!manager.includes('GMAIL_REFRESH_TOKEN'));
});

test('TSV-branded responsive mobile card and dismissable modal',()=>{
  assert.match(css,/#b51224|#af1526|#c21b2d/);
  assert.match(css,/\.rsvp-manage-dialog::backdrop/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/\.rsvp-manage-table tr\{border:/);
  assert.match(css,/\.rsvp-manage-edit-fields\{grid-template-columns:minmax\(0,1fr\)/);
});
