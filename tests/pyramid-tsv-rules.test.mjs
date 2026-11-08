import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canChallenge,canQualifyAgainst,scoreWinner} from '../src/lib/pyramid-rules.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const foundation=read('supabase/migrations/20261108200000_pyramid_pdf_rules_completion.sql');
const rules=read('supabase/migrations/20261108201500_pyramid_tsv_club_rules.sql');
const page=read('src/pages/forderungspyramide/index.astro');
const client=read('src/scripts/pyramid.ts');
const admin=read('src/scripts/admin-pyramid.ts');
const adminPage=read('src/pages/admin/index.astro');
const worker=read('supabase/functions/pyramid-auto-decline-email/index.ts');

test('TSV rank geometry and free entry challenge range are independent',()=>{
 const ranked=Array.from({length:21},(_,i)=>({position:i+1,qualified:true}));
 ranked.push({position:22,qualified:false});
 for(const p of [1,2,3,11,18,19,20,21])
  assert.equal(canQualifyAgainst(p,ranked),true,'TSV free entry target '+p);
 assert.equal(canQualifyAgainst(22,ranked),false);
 assert.equal(canChallenge(18,12),false);
 assert.equal(canChallenge(18,13),true);
 assert.equal(canChallenge(15,10),false);
});

test('TSV season remains per ladder, can join any time, and initial order uses LK',()=>{
 assert.match(foundation,/qualified=true,provisional=false/);
 assert.match(foundation,/l.seeded_at is null,true/);
 assert.match(foundation,/create or replace function public.pyramid_sort_seed_by_lk/);
 assert.match(foundation,/lk_rating asc nulls last/);
 assert.match(foundation,/private.pyramid_issue_challenge/);
 assert.match(rules,/if not c.qualified then[\s\S]*allowed:=d.qualified/);
 assert.match(client,/pyramid_request_join/);
 assert.match(admin,/pyramid_set_lk/);
 assert.match(admin,/pyramid_sort_seed_by_lk/);
});

test('TSV limits entry in an active match to one listing, pending or accepted, for both',()=>{
 assert.match(rules,/pc.status in \('pending','accepted'\)/);
 assert.match(rules,/pc.challenger_id in \(c.id,d.id\) or pc.defender_id in \(c.id,d.id\)/);
 assert.match(rules,/Einer der Spieler steht bereits in der Forderungsliste/);
 assert.match(client,/function canSendChallenge/);
 assert.match(client,/\['pending','accepted'\].includes\(game.status\)/);
});

test('TSV winner and loser restrictions are different from the source PDF',()=>{
 assert.match(rules,/c.last_loss_at>now\(\)-interval '3 days'/);
 assert.match(rules,/d.last_win_at>now\(\)-interval '3 days'/);
 assert.match(rules,/pc.resolved_at>now\(\)-interval '14 days'/);
 assert.match(rules,/pc.challenger_id=c.id and pc.defender_id=d.id/);
 assert.match(rules,/set last_win_at=now\(\) where id=p_winner/);
 assert.match(rules,/set last_loss_at=now\(\) where id=loser/);
 assert.match(page,/Siegerschutz und Wartefrist des Verlierers/);
 assert.match(client,/waitingDays\(target.last_win_at,3\)/);
 assert.match(client,/waitingDays\(me.last_loss_at,3\)/);
 assert.match(client,/waitingDays\(game.resolved_at,14\)/);
});

test('TSV seven-day scheduling, ten-day play deadline and no automatic forfeit',()=>{
 assert.match(rules,/cron.unschedule\('tsv-pyramid-acceptance-expiry'\)/);
 assert.match(rules,/create or replace function public.pyramid_schedule_match/);
 assert.match(rules,/c.created_at\+interval '7 days'/);
 assert.match(rules,/p_date>now\(\)\+interval '10 days'/);
 assert.match(rules,/scheduled_at=now\(\)/);
 assert.match(page,/id="pyramid-schedule-dialog"/);
 assert.match(page,/id="pyramid-schedule-date"/);
 assert.match(adminPage,/id="pyramid-admin-schedule-form"/);
 assert.match(client,/pyramid_schedule_match/);
 assert.match(admin,/pyramid_schedule_match/);
});

test('TSV justified refusal and no-show require management adjudication',()=>{
 for(const fn of ['pyramid_submit_refusal','pyramid_resolve_refusal','pyramid_record_no_show'])
  assert.match(rules,new RegExp('function public\\.'+fn));
 assert.match(rules,/if not private.can_manage_pyramid\(\)/);
 assert.match(rules,/p_refusal|refusal_reason/);
 assert.match(client,/pyramid_submit_refusal/);
 assert.match(admin,/pyramid_resolve_refusal/);
 assert.match(admin,/pyramid_record_no_show/);
});

test('TSV neutralization is self-service, role protected, and adjusts injury ranks every four weeks',()=>{
 assert.match(rules,/create or replace function public.pyramid_set_neutralized/);
 assert.match(rules,/e.user_id is distinct from auth.uid\(\)/);
 assert.match(rules,/neutralized_reason='injury'/);
 assert.match(rules,/interval '28 days'/);
 assert.match(rules,/tsv-pyramid-neutral-injury/);
 assert.match(page,/id="pyramid-neutral-reason"/);
 assert.match(client,/pyramid_set_neutralized/);
 assert.match(admin,/pyramid_set_neutralized/);
});

test('TSV holidays use the injury 28-day demotion, never before four weeks',()=>{
 const vacation=read('supabase/migrations/20261108203000_pyramid_vacation_and_member_avatars.sql');
 assert.match(vacation,/neutralized_reason in \('injury','vacation'\)/);
 assert.match(vacation,/neutralized_at\+\(\(e.neutral_shift_count\+1\)\*interval '28 days'\)/);
 assert.match(vacation,/create or replace function private\.pyramid_process_injury_neutrality\(\)/);
 assert.match(page,/Urlaub \(bis 4 Wochen ohne Rangverschiebung\)/);
 assert.match(client,/pyramid-entry-away/);
 assert.match(client,/friendlyReason\(item.neutralized_reason\)/);
});
test('Portraits use existing profiles, private RLS-scoped avatar list and central upload',()=>{
 const portrait=read('supabase/migrations/20261108203000_pyramid_vacation_and_member_avatars.sql');
 assert.match(portrait,/create or replace function private\.can_write_media_path/);
 assert.match(portrait,/parts\[2\]=auth.uid\(\)::text/);
 assert.match(portrait,/create or replace function public\.pyramid_set_my_avatar/);
 assert.match(portrait,/create or replace function public\.pyramid_member_avatars/);
 assert.match(portrait,/private\.can_view_pyramid\(p_ladder\)/);
 assert.match(portrait,/update public\.profiles set avatar_path=p_path/);
 assert.match(client,/replaceMediaImage/);
 assert.match(client,/removeMediaImage/);
 assert.match(client,/pyramid_member_avatars/);
 assert.match(client,/mediaUrl\(portrait\)/);
 assert.match(page,/id="pyramid-avatar-file"/);
 assert.match(page,/id="pyramid-avatar-panel"/);
 assert.match(read('src/styles/pyramid.css'),/pyramid-entry-avatar/);
 assert.match(read('src/styles/pyramid.css'),/pyramid-entry-away/);
});
test('Existing email worker serves challenge and rejection messages in club CI',()=>{
 assert.match(foundation,/values\(new_id,'challenge_created'\)/);
 assert.match(foundation,/claim_pyramid_notification/);
 assert.match(worker,/row.kind==='challenge_created'/);
 assert.match(worker,/TSV FELDKIRCHEN TENNIS/);
 assert.match(worker,/pyramid-auto-decline-email|pyramid_notice_delivery_failed/);
});

test('Protected route has no navigation or sitemap entry',()=>{
 const header=read('src/components/SiteHeader.astro');
 const sitemap=read('src/pages/sitemap.xml.ts');
 assert.match(page,/noindex=\{true\}/);
 assert.doesNotMatch(header,/forderungspyramide/);
 assert.doesNotMatch(sitemap,/forderungspyramide/);
});

test('Results are validated as two winning sets and third match tie-break',()=>{
 assert.equal(scoreWinner('6:4, 6:3'),1);
 assert.equal(scoreWinner('6:2, 4:6, 10:8'),1);
 assert.equal(scoreWinner('6:4, 4:6, 9:8'),null);
});
