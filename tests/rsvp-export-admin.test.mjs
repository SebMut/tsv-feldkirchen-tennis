import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=get('src/pages/admin/index.astro');
const admin=get('src/scripts/admin.ts');
const exportScript=get('src/scripts/rsvp-export-admin.ts');
const legacy=get('src/scripts/event-rsvp-admin.ts');
const pdf=get('src/scripts/rsvp-report-pdf.ts');
const css=get('src/styles/admin-rsvp-export.css');

test('PDF exports have an independent prominent admin panel and direct deep link',()=>{
  assert.match(html,/data-panel="rsvp-export" data-events-only/);
  assert.match(html,/id="panel-rsvp-export" class="admin-panel" data-events-only/);
  assert.match(html,/data-admin-jump="rsvp-export" data-events-only/);
  assert.match(html,/id="rsvp-export-cards"/);
  assert.match(html,/id="rsvp-export-reload"/);
  assert.match(html,/id="rsvp-export-search"/);
  assert.match(html,/id="rsvp-export-filter"/);
  assert.ok(admin.includes("initRsvpExportAdmin(true)"));
  assert.ok(admin.includes("showPanel(requestedPanel || 'dashboard')"));
  assert.ok(admin.includes("new URLSearchParams(location.search).get('panel')"));
});

test('only global event permission can reveal this panel; RLS remains authoritative',()=>{
  assert.match(admin,/if \(name === 'rsvp-export' && !hasGlobalPermission\('events'\)\) return/);
  assert.match(html,/data-events-only/);
  assert.ok(admin.includes("document.querySelectorAll<HTMLElement>('[data-events-only]')"));
  assert.ok(exportScript.includes("if(!canEvents || initialized"));
  assert.ok(legacy.includes(".not('verified_at','is',null)"));
  assert.ok(exportScript.includes(".not('verified_at','is',null)"));
  assert.ok(!exportScript.includes('service_role'));
  assert.ok(!exportScript.includes('member_email'));
});

test('every event has one PDF button and live verified data is fetched only on click',()=>{
  assert.ok(exportScript.includes("data-export-event="));
  assert.ok(exportScript.includes('fetchVerifiedEventRsvps(event.id)'));
  assert.ok(exportScript.includes('downloadRsvpPdf({'));
  assert.ok(exportScript.includes('if(error)throw error'));
  assert.ok(exportScript.includes('rsvp_details:event.rsvp_details||{}'));
  assert.ok(legacy.includes('export async function fetchVerifiedEventRsvps'));
  assert.ok(legacy.includes('.range(offset, offset + pageSize - 1)'));
  assert.ok(pdf.includes('sortRsvpBySurname(records)'));
});

test('event list includes linked news, archived RSVPs, per-event counts and responsive card layout',()=>{
  assert.ok(exportScript.includes("event.rsvp_enabled || (totals.get(event.id)?.responses||0)>0"));
  assert.ok(exportScript.includes('count.children'));
  assert.ok(exportScript.includes('count.adults'));
  assert.ok(exportScript.includes('count.maybe'));
  assert.ok(exportScript.includes('count.no'));
  assert.ok(exportScript.includes('loadConfirmedCounts()'));
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
});

test('existing hidden legacy PDF export remains intact',()=>{
  assert.match(html,/id="rsvp-admin-pdf"/);
  assert.ok(legacy.includes("pdfButton?.addEventListener('click'"));
  assert.ok(legacy.includes("fetchVerifiedEventRsvps(selectedId)"));
});
