import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  parseGroupWithdrawals,normalizeBtvTeam,officialGroupPdfUrl,
  groupIdFromBtvUrl,matchWithdrawalToFixture
} from '../scripts/btv-withdrawal-source.mjs';

const officialText=[
  'Südbayern | Sommer 2026',
  'Herren 40 Südliga 2 Gr. 315',
  'Tabelle und Spielplan',
  'Rang Mannschaft Begegnungen Punkte',
  '1 TSV Feldkirchen II (01012) 7 10:4',
  '2 SC Baldham-Vaterstetten II (02035) 7 8:6',
  '7 VfB Forstinning zurückgezogen/gesperrt am',
  "  '09.06.2026' (02098)",
  'Legende',
  'z...Mannschaft zurückgezogen'
].join('\n');

test('only explicit, dated official row can prove a withdrawal',()=>{
  const entries=parseGroupWithdrawals(officialText,{
    seasonCode:'sommer-2026',groupName:'Gr. 315'
  });
  assert.deepEqual(entries,[{
    team:'vfb forstinning',displayName:'VfB Forstinning',
    clubCode:'02098',withdrawnOn:'2026-06-09'
  }]);
});
test('generic z legend and missing dates never mark an opponent withdrawn',()=>{
  const noWithdrawal=officialText.replace(
    /7 VfB Forstinning zurückgezogen\/gesperrt am\n  '09\.06\.2026' \(02098\)/,
    '7 VfB Forstinning (02098) 0:0'
  );
  assert.deepEqual(parseGroupWithdrawals(noWithdrawal,{
    seasonCode:'sommer-2026',groupName:'Gr. 315'
  }),[]);
  const missingDate=officialText.replace("'09.06.2026' (02098)","(02098)");
  assert.deepEqual(parseGroupWithdrawals(missingDate,{
    seasonCode:'sommer-2026',groupName:'Gr. 315'
  }),[]);
});
test('withdrawal maps only to exact opponent after withdrawal date',()=>{
  const entry=parseGroupWithdrawals(officialText,{
    seasonCode:'sommer-2026',groupName:'Gr. 315'
  })[0];
  const match={is_home:true,opponent:'VfB Forstinning',
    starts_at:'2026-07-04T12:00:00Z',btv_result_text:null};
  assert.equal(matchWithdrawalToFixture(entry,match,'Herren 40 II'),'away');
  assert.equal(matchWithdrawalToFixture(entry,{...match,starts_at:'2026-06-03T12:00:00Z'},'Herren 40 II'),null);
  assert.equal(matchWithdrawalToFixture(entry,{...match,btv_result_text:'7:2'},'Herren 40 II'),null);
  assert.equal(matchWithdrawalToFixture(entry,{...match,opponent:'VfB Forstinning II'},'Herren 40 II'),null);
  assert.equal(matchWithdrawalToFixture(entry,{...match,is_home:false},'Herren 40 II'),'home');
});
test('official group URL, identity and season guard are strict',()=>{
  assert.equal(groupIdFromBtvUrl('https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2160998'),2160998);
  assert.equal(groupIdFromBtvUrl('https://evil.test/?groupid=2160998'),null);
  const url=new URL(officialGroupPdfUrl(2160998));
  assert.equal(url.origin,'https://btv.liga.nu');
  assert.equal(url.searchParams.get('group'),'2160998');
  assert.equal(url.searchParams.get('dokument'),'ScheduleReportFOP');
  assert.equal(normalizeBtvTeam('VfB Forstinning (02098)'),'vfb forstinning');
  assert.throws(()=>parseGroupWithdrawals(officialText,{seasonCode:'sommer-2025',groupName:'Gr. 315'}),/MISMATCH/);
  assert.throws(()=>parseGroupWithdrawals(officialText,{seasonCode:'sommer-2026',groupName:'Gr. 316'}),/MISMATCH/);
});
test('server-side import has explicit evidence, gated writes and private status',()=>{
  const code=readFileSync(new URL('../scripts/btv-withdrawal-sync.mjs',import.meta.url),'utf8');
  const sql=readFileSync(new URL('../scripts/sql/match-withdrawal-flags.sql',import.meta.url),'utf8');
  assert.match(code,/BTV_WITHDRAWALS_MAIN_BRANCH_ONLY/);
  assert.match(code,/BTV_WITHDRAWALS_WRITE_FLAG_REQUIRED/);
  assert.match(code,/BTV_BLOCKED_OR_RATE_LIMITED/);
  assert.match(code,/verification_status:'official_verified'/);
  assert.match(code,/source_kind:'btv_group_schedule'/);
  assert.doesNotMatch(code,/\.from\('matches'\)\.update|\.from\('match_live_state'\)\.update/);
  assert.match(sql,/row level security/i);
  assert.match(sql,/private\.is_super_admin\(\)/);
});
