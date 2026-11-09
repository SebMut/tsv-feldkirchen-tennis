import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canChallenge,canQualifyAgainst,pyramidCell,pyramidRows,scoreWinner,normalizeWinnerScore,dateWithinPeriod} from '../src/lib/pyramid-rules.mjs';
const source=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('pyramid rows are triangular, including non-full bottom rows',()=>{
 assert.deepEqual([1,2,3,4,6,7,10,11,15,16,21].map(p=>pyramidCell(p)?.row),
  [0,1,1,2,2,3,3,4,4,5,5]);
 const rows=pyramidRows(Array.from({length:18},(_,i)=>({position:i+1})));
 assert.equal(rows.length,6);
 assert.deepEqual(rows.map(row=>row.length),[1,2,3,4,5,6]);
 assert.equal(rows.at(-1)?.at(2)?.position,18);
 assert.equal(rows.at(-1)?.at(5),null);
});
test('reference PDF example #18 can challenge #16,17 and #13,14,15 but not #12',()=>{
 for(const defender of [13,14,15,16,17])assert.equal(canChallenge(18,defender),true,String(defender));
 for(const defender of [1,2,10,11,12,18,19])assert.equal(canChallenge(18,defender),false,String(defender));
});
test('reference PDF example #15 can challenge #11 to #14 but not #10',()=>{
 for(const defender of [11,12,13,14])assert.equal(canChallenge(15,defender),true);
 assert.equal(canChallenge(15,10),false);
 assert.equal(canChallenge(3,1),true);
 assert.equal(canChallenge(3,2),true);
});
test('TSV late entrant may qualify against any ranked member, never another entrant',()=>{
 const entries=Array.from({length:15},(_,i)=>({position:i+1,qualified:true}));
 entries.push({position:16,qualified:false});
 for(const eligible of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15])
  assert.equal(canQualifyAgainst(eligible,entries),true,String(eligible));
 for(const forbidden of [16])
  assert.equal(canQualifyAgainst(forbidden,entries),false,String(forbidden));
 assert.equal(canChallenge(18,12),false,'Normal row geometry is distinct from qualification');
});
test('two winning sets or a third-set champion tie-break are required',()=>{
 assert.equal(scoreWinner('6:4, 6:3'),1);
  assert.equal(scoreWinner('6:0, 6:0'),1);
 assert.equal(scoreWinner('4:6, 6:3, 10:8'),1);
  assert.equal(scoreWinner('4:6, 6:3, 6:2'),null);
 assert.equal(scoreWinner('6:7, 6:4, 8:10'),2);
 for(const bad of ['6:6, 6:4','6:4','6:4, 4:6','6:4, 4:6, 9:8','6:4, 6:4, 10:8','abc'])
   assert.equal(scoreWinner(bad),null,bad);
});

test('finished results entered from the second side are normalized to winner perspective',()=>{
  assert.equal(normalizeWinnerScore('6:1, 5:7, 0:10'),'1:6, 7:5, 10:0');
  assert.equal(normalizeWinnerScore('6:4, 6:3'),'6:4, 6:3');
  assert.equal(normalizeWinnerScore('6:4, 4:6'),null);
});
test('saison boundaries follow dates instead of hard-coded summer 2026',()=>{
 assert.equal(dateWithinPeriod('2027-04-01','2027-10-31',new Date(2027,3,1)),true);
 assert.equal(dateWithinPeriod('2027-04-01','2027-10-31',new Date(2027,10,1)),false);
});
test('protected actions stay authenticated while public board reveals only ranks and names',()=>{
 const sql=source('supabase/migrations/20261108153000_forderungspyramide_staging.sql');
 const page=source('src/pages/forderungspyramide/index.astro');
 const js=source('src/scripts/pyramid.ts');
 const registration=source('src/scripts/pyramid-registration.ts');
 const siteNav=source('src/components/SiteHeader.astro');
 const sitemap=source('src/pages/sitemap.xml.ts');
 assert.match(page,/noindex=\{true\}/);
 assert.doesNotMatch(siteNav,/forderungspyramide/);
 assert.doesNotMatch(sitemap,/forderungspyramide/);
 assert.match(js,/supabase\.auth\.signInWithPassword/);
 assert.match(registration,/supabase\.functions\.invoke\('pyramid-access-email'/);
 assert.match(registration,/supabase\.auth\.signUp/);
 assert.match(registration,/captchaToken/);
 assert.match(js,/pyramid_public_standings/);
 assert.match(js,/renderGuestStandings/);
 const publicSql=source('supabase/migrations/20261108190000_pyramid_public_board_and_access_links.sql');
 assert.match(publicSql,/returns table\(/);
 assert.match(publicSql,/ladder_title text, season_label text/);
 assert.match(publicSql,/display_name text/);
 assert.doesNotMatch(publicSql,/avatar_path|neutralized_reason|user_id/);
 assert.match(publicSql,/grant execute on function public\.pyramid_public_standings\(\) to anon,authenticated/);
 assert.match(publicSql,/revoke all on function public\.pyramid_access_link_allow\(text,text\) from public,anon,authenticated/);
 const mail=source('supabase/functions/pyramid-access-email/index.ts');
 assert.match(mail,/auth\.admin\.generateLink/);
 assert.match(mail,/TURNSTILE_SECRET_KEY/);
 assert.match(mail,/GMAIL_REFRESH_TOKEN/);
 assert.match(mail,/pyramid_access_link_allow/);
 assert.match(page,/id="pyramid-public-board"/);
 assert.match(page,/id="pyramid-rules-heading"/);
 assert.match(page,/pyramid-rules-list/);
 assert.match(page,/pyramid-avatar-save-state/);
 assert.match(js,/URL\.createObjectURL\(file\)/);
 assert.match(js,/avatarUpload\?\.requestSubmit\(\)/);
 assert.match(js,/pyramid_request_join/);
 assert.match(js,/pyramid_approve_join/);
 assert.match(js,/pyramid_finalize_seed/);
 assert.match(js,/pyramid_challenge/);
 assert.match(js,/pyramid_respond/);
 assert.match(js,/pyramid_report_result/);
 assert.match(js,/function demoMakeChallenge\(/);
 assert.match(js,/function demoRespond\(/);
 assert.match(js,/function demoReportResult\(/);
 assert.match(js,/function demoInitialize\(/);
 assert.match(js,/location\.search\)\.get\('demo'\)/);
 assert.match(js,/root\.dataset\.demoMode='true'/);
 assert.ok(source('scripts/pyramid-demo-browser-qa.mjs').includes("await checkDevice('mobile'"));

 assert.match(sql,/enable row level security/g);
 assert.match(sql,/private\.is_super_admin\(\)/);
 assert.match(sql,/time zone 'Europe\/Berlin'\)::date not between l\.starts_on and l\.ends_on/);
 assert.match(sql,/interval '14 days'/);
 assert.match(sql,/interval '10 days'/);
 assert.match(sql,/cron\.schedule/);
 assert.match(sql,/create function public\.pyramid_finalize_seed/);
 assert.match(sql,/private\.pyramid_valid_winning_score\(p_score\)/);
 assert.match(sql,/public\.pyramid_challenge\(uuid\), public\.pyramid_respond/);
 assert.doesNotMatch(sql,/grant .* to anon/);
});
