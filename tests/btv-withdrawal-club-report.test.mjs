import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  officialClubGroupReportUrl,parseClubReportColumn,
  parseClubGroupReport,groupNumbersFromColumns,columnsFromLayoutText
} from '../scripts/btv-withdrawal-club-report.mjs';
import {matchWithdrawalToFixture} from '../scripts/btv-withdrawal-source.mjs';

// Synthetic slices follow the documented BTV "Gruppeneinteilung" PDF layout.
// Competitors/ranking are public; no individual player data is processed.
const columns=[
  ['Herren 40 Südliga 3 Gr. 315','Stand 31.03.2026',
   '1 TSV Feldkirchen II (01012)','2 VfB Forstinning zurückgezogen/gesperrt am',
   "  '01.06.2026' (02410)"].join('\n'),
  ['Knaben 15 Südliga 3 Gr. 565','Stand 31.03.2026',
   '1 TSV Feldkirchen (01012)','2 TC Moosburg zurückgezogen am',
   "  '12.06.2026' (02451)",'Legende','z...Mannschaft zurückgezogen'].join('\n'),
  ['Herren 50 Südliga 4 (4er) Gr. 396','Stand 31.03.2026',
   '1 TC Höhenkirchen (02158)','2 TSV Feldkirchen II (01012)'].join('\n')
];
test('one official TSV club report covers all the independently named groups',()=>{
  const u=officialClubGroupReportUrl('sommer-2026');
  assert.ok(u);
  const p=new URL(u);
  assert.equal(p.origin,'https://btv.liga.nu');
  assert.equal(p.searchParams.get('club'),'23391');
  assert.equal(p.searchParams.get('season'),'18105');
  assert.equal(p.searchParams.get('dokument'),'ResultReportFOP');
  assert.equal(p.searchParams.get('type'),'group');
  assert.equal(officialClubGroupReportUrl('sommer-2027'),null); // no invented season IDs
  assert.deepEqual(groupNumbersFromColumns(columns).sort((a,b)=>a-b),[315,396,565]);
});
test('parse withdrawals across every club group, not only a hand-picked opponent',()=>{
  const actual=parseClubGroupReport(columns,{seasonCode:'sommer-2026'});
  assert.deepEqual(actual.map(a=>a.group),[315,565]);
  assert.deepEqual(actual.map(a=>a.team),['vfb forstinning','tc moosburg']);
  assert.equal(actual[1].clubCode,'02451');
  assert.equal(actual[1].withdrawnOn,'2026-06-12');
  const date=new Date('2026-06-19T13:00:00Z');
  assert.equal(Number.isNaN(date.valueOf()),false);
  const moosburg={is_home:true,opponent:'TC Moosburg',starts_at:date.toISOString(),btv_result_text:null};
  assert.equal(matchWithdrawalToFixture(actual[1],moosburg,'Knaben 15'),'away');
  assert.equal(matchWithdrawalToFixture(actual[1],{...moosburg,starts_at:'2026-06-01T13:00:00Z'},'Knaben 15'),null);
});
test('ignore legend-only z, undated claims and non-current competitions',()=>{
  assert.deepEqual(parseClubReportColumn('Legende\nz...Mannschaft zurückgezogen'),[]);
  assert.deepEqual(parseClubReportColumn('Knaben 15 Südliga 3 Gr. 565\n7 TC Moosburg zurückgezogen am\n(02451)'),[]);
  assert.deepEqual(parseClubReportColumn('Knaben 15 Südliga 3 Gr. 565\n7 TC Moosburg zurückgezogen am\n31.02.2026 (02451)'),[]);
  assert.throws(()=>parseClubGroupReport(columns,{seasonCode:'winter-2026-2027'}),/INVALID_SEASON/);
  assert.throws(()=>parseClubGroupReport(columns,{seasonCode:'sommer-2026',club:'Other'}),/WRONG_CLUB/);
});
test('deduplicates repeated rankings and rejects conflicting dates',()=>{
  const same=parseClubGroupReport([columns[1],columns[1]],{seasonCode:'sommer-2026'});
  assert.equal(same.length,1);
  const different=columns[1].replace('12.06.2026','14.06.2026');
  assert.throws(()=>parseClubGroupReport([columns[1],different],{seasonCode:'sommer-2026'}),/CONFLICT/);
});
test('main workflow checks whole TSV club report, then only still missing groups',()=>{
  const script=readFileSync(new URL('../scripts/btv-withdrawal-sync.mjs',import.meta.url),'utf8');
  assert.match(script,/fetchClubGroupReport\(seasonCode\)/);
  assert.match(script,/report\?\.groupsSeen\.includes\(groupNumber\)/);
  assert.match(script,/report\.entries\.filter\(e=>e\.group===groupNumber\)/);
  assert.match(script,/BTV_WITHDRAWAL_SIDE_CONFLICT/);
  assert.match(script,/BTV_CLUB_GROUP_UNAVAILABLE/);
  assert.match(script,/verification_status:'official_verified'/);
  assert.match(script,/source_kind:'btv_group_schedule'/);
  assert.doesNotMatch(script,/from\('matches'\)\.update/);
});


test('full official 5-column layout preserves all four withdrawn team rows',()=>{
  const width=82;
  const line=(...cells)=>cells.map(s=>String(s).padEnd(width,' ')).join('');
  const pdfText=[
    'Südbayern | Sommer 2026','TSV Feldkirchen (01012)','Gruppeneinteilung',
    line('Herren 40 Südliga 2 Gr. 315','Herren 50 Südliga 4 Gr. 396',
         'Damen Südliga 5 Gr. 240','Knaben 15 Südliga 2 Gr. 565',
         'Bambini 12 Südliga 5 Gr. 849'),
    line('1 TSV Feldkirchen II (01012)','1 TC Höhenkirchen (02158)',
         '1 TC Oberding (02080)','1 TSV Feldkirchen (01012)',
         '1 TSV Feldkirchen (01012)'),
    line('8 VfB Forstinning zurückgezogen/gesperrt am','7 SV DJK Taufkirchen zurückgezogen/gesperrt am',
         '7 TC Beispiel (02999)','7 TC Moosburg zurückgezogen/gesperrt am',
         '7 TSV Oberpframmern II zurückgezogen/gesperrt am'),
    line("'11.05.2026' (02098)","'10.04.2026' (02351)",'',
         "'07.07.2026' (02451)","'20.06.2026' (02199)")
  ].join('\n');
  const sliced=columnsFromLayoutText(pdfText);
  assert.equal(sliced.length,5);
  assert.deepEqual(groupNumbersFromColumns(sliced).sort((a,b)=>a-b),
    [240,315,396,565,849]);
  const entries=parseClubGroupReport(sliced,{seasonCode:'sommer-2026'});
  assert.deepEqual(entries.map(e=>e.team),[
    'vfb forstinning','sv djk taufkirchen','tc moosburg','tsv oberpframmern ii'
  ]);
  assert.deepEqual(entries.map(e=>e.withdrawnOn),[
    '2026-05-11','2026-04-10','2026-07-07','2026-06-20'
  ]);
});
