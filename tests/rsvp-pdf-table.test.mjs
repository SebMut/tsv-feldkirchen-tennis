import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const content=readFileSync(new URL('../src/scripts/rsvp-report-pdf.ts',import.meta.url),'utf8');
const js=ts.transpileModule(content,{compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const {buildRsvpPdf,sortRsvpBySurname}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const event={
  title:'Weihnachtsfeier 2026',slug:'weihnachtsfeier-2026',
  starts_at:'2026-12-17T17:00:00+01:00',
  rsvp_details:{show_contributions:true,show_help:true,tournament_youth_enabled:false,tournament_women_enabled:false,tournament_men_enabled:false},
};
const names=['Zora Müller','Ben Adler','Anna Bauer','Ruth von Schilling'];
const data=names.map((name,i)=>({
  member_name:name,attendance:i===3?'maybe':'yes',
  party_size:2,adults_count:1,children_count:1,
  salad_contribution:'Salat und Würstchen '+i,
  dessert_contribution:'Apfelkuchen '+i,
  help_setup:i%2===0,help_cleanup:i%2===1,
}));

test('alphabetical RSVP order uses German surnames (not first names) without mutating input',()=>{
  const original=structuredClone(data);
  assert.deepEqual(sortRsvpBySurname(data).map(r=>r.member_name),[
    'Ben Adler','Anna Bauer','Zora Müller','Ruth von Schilling',
  ]);
  assert.deepEqual(data,original);
});

test('PDF has landscape pages, columns, totals, and chronological independent fields',()=>{
  const pdf=Buffer.from(buildRsvpPdf(event,data)).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.match(pdf,/\/MediaBox \[0 0 842 595\]/);
  assert.match(pdf,/\(Teilnehmer alphabetisch nach Nachnamen\)/);
  assert.ok(pdf.includes('(Essen / Salat)') && pdf.includes('(Aufbau)') && pdf.includes('(Abbau)'));
  assert.ok(pdf.includes('(Erwachsene)'));
  assert.ok(pdf.includes('(Kuchen / Nachtisch)'));
  assert.ok(pdf.indexOf('(Ben Adler)')<pdf.indexOf('(Anna Bauer)'));
  assert.ok(pdf.indexOf('(Anna Bauer)')<pdf.indexOf('(Zora Müller)'));
  assert.ok(pdf.includes('Bestätigte Rückmeldungen: 4'));
  assert.ok(pdf.includes('Teilnehmende Personen: 6'));
  assert.ok(pdf.includes('2. Buffet: Salate, Vorspeisen und Nachspeisen'));
  assert.match(pdf,/xref\n0 \d+/);
  assert.match(pdf,/%%EOF/);
});

test('hidden optional fields are excluded; competitions are still independently enabled',()=>{
  const privateEvent={...event,rsvp_details:{
    show_contributions:false,show_help:false,tournament_youth_enabled:true,
    tournament_women_enabled:true,tournament_men_enabled:false,
  }};
  const pdf=Buffer.from(buildRsvpPdf(privateEvent,[{
    ...data[0],
    youth_registrations:[{name:'Jan Adler',category:'u12-m'}],
    women_registrations:['Frau Bauer'],
    men_registrations:['Herr X'],
  }])).toString('latin1');
  assert.ok(!pdf.includes('(Essen / Salat)'));
  assert.ok(!pdf.includes('(Kuchen / Nachtisch)'));
  assert.ok(!pdf.includes('(Aufbau)'));
  assert.ok(pdf.includes('3. Teilnehmer Jugendvereinsmeisterschaft'));
  assert.ok(pdf.includes('4. Teilnehmer Damenvereinsmeisterschaft'));
  assert.ok(!pdf.includes('5. Teilnehmer Herrenvereinsmeisterschaft'));
  assert.ok(pdf.includes('Jan Adler'));
  assert.ok(pdf.includes('Frau Bauer'));
  assert.ok(!pdf.includes('Herr X'));
});

test('many rows and long contributions wrap into repeated, page-safe headers',()=>{
  const big=Array.from({length:85},(_,i)=>({
    ...data[i%data.length],
    member_name:'Teilnehmer Test '+String(i).padStart(3,'0'),
    salad_contribution:('Kartoffelsalat mit frischen Kräutern, vegetarischer Nudelsalat und Brot; ').repeat(3),
    dessert_contribution:('Hausgemachter Kuchen mit Früchten, Muffins und Keksen. ').repeat(3),
  }));
  const pdf=Buffer.from(buildRsvpPdf(event,big)).toString('latin1');
  const pageCount=(pdf.match(/\/Type \/Page\b/g)||[]).length;
  const headerCount=(pdf.match(/\(Essen \/ Salat\)/g)||[]).length;
  assert.ok(pageCount>3,'should span multiple A4 pages');
  assert.ok(headerCount>1,'column headers must repeat after page breaks');
  assert.ok(headerCount<=pageCount,'header repetition must not duplicate on one page');
  assert.ok(pdf.includes('(Teilnehmer Test 084)'),'last row must not be clipped or lost');
  assert.ok(pdf.includes('(Seite '+pageCount+'/'+pageCount+')'),'last page needs footer');
});

test('PDF name export is admin-only and contains verified rows, not public submissions',()=>{
  const admin=readFileSync(new URL('../src/scripts/event-rsvp-admin.ts',import.meta.url),'utf8');
  assert.ok(admin.includes("if (!access.isSuper) return"));
  assert.ok(admin.includes(".not('verified_at','is',null)"));
  assert.ok(admin.includes("supabase.from('event_rsvps')"));
  assert.ok(admin.includes("downloadRsvpPdf({"));
});
