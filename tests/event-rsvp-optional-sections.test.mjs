import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const admin=read('src/pages/admin/index.astro');
const legacy=read('src/scripts/event-rsvp-admin.ts');
const compose=read('src/scripts/editorial-composer.ts');
const page=read('src/pages/veranstaltung/index.astro');
const publicCode=read('src/scripts/event-rsvp.ts');
const edge=read('supabase/functions/event-rsvp-email/index.ts');
const aktuell=read('src/pages/aktuelles/index.astro');
const pdf=read('src/scripts/rsvp-report-pdf.ts');

const flags=[
 ['show-expectations','show_expectations'],
 ['show-volunteer-info','show_volunteer_info'],
 ['show-contributions','show_contributions'],
 ['show-help','show_help'],
];

test('both admin event editors persist each of four toggles into existing RSVP JSON',()=>{
  for(const [id,key] of flags){
    assert.match(admin,new RegExp('id="editorial-compose-'+id+'"'));
    assert.match(admin,new RegExp('id="rsvp-admin-'+id+'"'));
    assert.ok(compose.includes(key+":on('"+id+"')"),'Composer must persist '+key);
    assert.ok(legacy.includes(key+":field('rsvp-admin-"+id+"').checked"),'Legacy editor must persist '+key);
    assert.ok(compose.includes("input(id).checked = details[key] !== false"),'Composer loads existing flags');
    assert.ok(legacy.includes("field('rsvp-admin-'+id).checked = details[key] !== false"),'Legacy loads existing flags');
  }
});

test('public optional RSVP sections are independent and suppressed by event settings',()=>{
  assert.match(page,/id="rsvp-invitation-details"/);
  assert.match(page,/id="rsvp-help-detail"/);
  assert.match(page,/id="rsvp-contributions-section"/);
  assert.match(page,/id="rsvp-help-section"/);
  assert.ok(publicCode.includes("details.show_expectations === false"));
  assert.ok(publicCode.includes("details.show_volunteer_info === false"));
  assert.ok(publicCode.includes("details.show_contributions === false"));
  assert.ok(publicCode.includes("details.show_help === false"));
  assert.ok(publicCode.includes("const contributionsVisible = !byId<HTMLElement>('rsvp-contributions-section')?.hidden;"));
  assert.ok(publicCode.includes("help_setup:helpVisible &&"));
  assert.ok(publicCode.includes("const youthEnabled = details.tournament_youth_enabled !== false"));
});

test('hidden form inputs cannot be forced into a verified RSVP by forged frontend fields',()=>{
  assert.ok(edge.includes("offers.show_contributions===false && (p.dessert || p.salad)"));
  assert.ok(edge.includes("offers.show_help===false && (p.help_setup || p.help_cleanup)"));
  assert.ok(edge.includes("const cf=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify'"));
  assert.ok(edge.indexOf("const cf=await fetch('https://challenges.cloudflare.com/turnstile")<
    edge.indexOf("const offers=event.rsvp_details"));
  assert.match(pdf,/config.show_contributions!==false/);
  assert.match(pdf,/config.show_help!==false/);
});

test('signup CTA appears after short summary, above details in actual event cards and preview',()=>{
  const desc=aktuell.indexOf('<p class="content-card__description">\${escapeHtml(description)}</p>');
  const cta=aktuell.indexOf('<p class="content-card__signup">',desc);
  const detail=aktuell.indexOf('<details class="content-card__details"',desc);
  assert.ok(desc>0&&cta>desc&&detail>cta,'CTA must be visible before opening full text');
  const previewDesc=compose.indexOf('escapeHtml(plain(val(\\'excerpt\\') || val(\\'body\\')))');
  const previewCta=compose.indexOf('content-card__signup',previewDesc);
  const previewDetails=compose.indexOf('content-card__details',previewDesc);
  assert.ok(previewDesc>0&&previewCta>previewDesc&&previewDetails>previewCta);
});

test('Turnstile remains mandatory, retry only resets original provider challenge',()=>{
  assert.match(page,/id="rsvp-turnstile-retry"/);
  assert.match(publicCode,/turnstileToken/);
  assert.match(publicCode,/resetChallenge\(\)/);
  assert.match(publicCode,/cf.turnstile\?\.reset\(turnstileId\)/);
  assert.match(publicCode,/id==='110200'\|\|id==='400021'/);
  assert.match(publicCode,/id==='200500'/);
  assert.ok(!publicCode.includes('skipTurnstile'));
});
