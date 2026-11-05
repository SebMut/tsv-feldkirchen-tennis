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


test('TSV corporate identity appears on every PDF page, with readable dark text and red table headers',()=>{
  const rows=Array.from({length:75},(_,i)=>({
    ...data[i%data.length],member_name:'Teilnehmer Muster '+String(i).padStart(3,'0'),
    salad_contribution:'Salat mit frischen Kräutern und selbstgemachtem Brot '.repeat(3),
    dessert_contribution:'Gedeckter Apfelkuchen und weihnachtliche Nachspeisen '.repeat(3),
  }));
  const pdf=Buffer.from(buildRsvpPdf(event,rows)).toString('latin1');
  const pageCount=(pdf.match(/\/Type \/Page\b/g)||[]).length;
  assert.ok(pageCount>1);
  assert.equal((pdf.match(/\(TSV FELDKIRCHEN\)/g)||[]).length,pageCount,'club name in each repeated letterhead');
  assert.equal((pdf.match(/\(TENNIS  \/  VEREINSVERANSTALTUNGEN\)/g)||[]).length,pageCount);
  assert.equal((pdf.match(/\(ANMELDUNGEN & TEILNEHMER\)/g)||[]).length,pageCount);
  assert.ok(pdf.includes('0.890 0.024 0.075 rg'),'TSV red should be used for the title and the table header');
  assert.ok(pdf.includes('0.850 0.941 0.431 rg'),'yellow-green tennis ball in the offline logo fallback');
  assert.equal((pdf.match(/\(Essen \/ Salat\)/g)||[]).length,pageCount,'colored table headings repeat');
  assert.ok(pdf.includes('(TSV Feldkirchen Tennis | Vertraulich - nur fuer die Vereinsorganisation)'));
  assert.match(pdf,/%%EOF/);
});

test('actual Supabase logo is embedded as a PDF image XObject when available',()=>{
  // Browser obtains the JPEG from the already-existing media bucket; the
  // synchronous generator is still deterministic for testing.
  const jpeg=new Uint8Array([0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0,1,0,0,0,0,0,0,0xff,0xd9]);
  const pdf=Buffer.from(buildRsvpPdf(event,data,{width:10,height:10,data:jpeg})).toString('latin1');
  assert.match(pdf,/\/Subtype \/Image \/Width 10 \/Height 10/);
  assert.match(pdf,/\/Filter \/DCTDecode/);
  assert.match(pdf,/\/XObject << \/ClubLogo \d+ 0 R >>/);
  assert.match(pdf,/\/ClubLogo Do Q/);
  assert.ok(!pdf.includes('0.850 0.941 0.431 rg'),'embedded logo replaces fallback');
});
