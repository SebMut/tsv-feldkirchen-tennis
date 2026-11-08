import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canChallenge,scoreWinner,pyramidRows} from '../src/lib/pyramid-rules.mjs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const master=read('supabase/migrations/20261108213000_pyramid_master_v1_rules.sql');
const client=read('src/scripts/pyramid.ts');
const admin=read('src/scripts/admin-pyramid.ts');
const page=read('src/pages/forderungspyramide/index.astro');
const adminPage=read('src/pages/admin/index.astro');
const styles=read('src/styles/pyramid.css');
const mail=read('supabase/functions/pyramid-auto-decline-email/index.ts');

test('Master §2 Tannenbaum examples including rank 3 special rule',()=>{
 const examples=[
  [1,[]],[2,[1]],[3,[1,2]],[5,[2,3,4]],
  [8,[5,6,7]],[13,[9,10,11,12]],[15,[11,12,13,14]]
 ];
 for(const [self,expected] of examples){
  const allowed=Array.from({length:self-1},(_,i)=>i+1)
    .filter(target=>canChallenge(self,target));
  assert.deepEqual(allowed,expected,'Rank '+self);
 }
 const rows=pyramidRows(Array.from({length:15},(_,i)=>({position:i+1})));
 assert.deepEqual(rows.map(row=>row.length),[1,2,3,4,5]);
 assert.match(master,/if c.position=5 then/);
 assert.match(master,/elsif c.position=15 then/);
 assert.equal(scoreWinner('6:4, 4:6, 10:8'),1);
 assert.equal(scoreWinner('6:4, 4:6, 9:8'),null);
});

test('Master §3 new players become last ranked on approval, no qualification round',()=>{
 assert.match(master,/coalesce\(max\(position\),0\)\+1/);
 assert.match(master,/values\(req.ladder_id,req.user_id,req.display_name,next_position,true,l.seeded_at is null\)/);
 assert.match(client,/Neue Mitglieder werden nach Freigabe automatisch am Ende/);
 assert.match(adminPage,/kein Qualifikationsspiel/);
});

test('Master §5 14 days play, 3 day scheduling target, previous 7+10 gate removed',()=>{
 assert.match(master,/now\(\)\+interval '14 days'/);
 assert.match(master,/c.created_at\+interval '14 days'/);
 assert.match(master,/p_date>deadline/);
 assert.doesNotMatch(master,/c.created_at\+interval '7 days'/);
 assert.match(page,/möglichst innerhalb von drei Tagen/);
 assert.match(page,/14 Tage/);
 assert.match(adminPage,/14 Tage nach der Forderung/);
});

test('Master §5 seven-day loser/rematch and 48-hour winner protection',()=>{
 assert.match(master,/c.last_loss_at>now\(\)-interval '7 days'/);
 assert.match(master,/d.last_win_at>now\(\)-interval '48 hours'/);
 assert.match(master,/pc.resolved_at>now\(\)-interval '7 days'/);
 assert.match(client,/waitingDays\(me.last_loss_at,7\)/);
 assert.match(client,/waitingDays\(target.last_win_at,2\)/);
 assert.match(client,/waitingDays\(game.resolved_at,7\)/);
});

test('Master §5 one open challenge blocks both players through disputed result',()=>{
 assert.match(master,/pc.status in \('pending','accepted','result_pending','result_disputed'\)/);
 assert.match(master,/for update/);
 assert.match(client,/const openStatuses=\['pending','accepted','result_pending','result_disputed'\]/);
 assert.match(admin,/result_disputed/);
});

test('Master §3 result submission needs opponent confirmation within 48h before any rank change',()=>{
 assert.match(master,/status='result_pending',proposed_winner_id=winner/);
 assert.match(master,/confirmation_deadline=now\(\)\+interval '48 hours'/);
 assert.match(master,/create or replace function public.pyramid_confirm_result/);
 assert.match(master,/auth.uid\(\) is distinct from reviewer/);
 assert.match(master,/perform private.pyramid_finish\(c.id,c.proposed_winner_id,'completed',c.proposed_score\)/);
 assert.match(master,/if p_state='completed' and c.status not in \('result_pending','result_disputed'\)/);
 assert.match(client,/data-pyramid-confirm/);
 assert.match(client,/data-pyramid-dispute/);
 assert.match(client,/demoConfirmResult/);
 assert.match(mail,/kind==='result_reported'/);
 assert.match(mail,/innerhalb von 48 Stunden/);
});

test('Master §4 winner takes defended rank, challenger loss preserves ranking',()=>{
 assert.match(master,/elsif p_winner=c.challenger_id and cp>dp then/);
 assert.match(master,/position=case when id=c.challenger_id then dp else position\+1 end/);
 assert.match(master,/set last_loss_at=now\(\) where id=loser/);
});

test('Master §5 deadline review: no automatic ranking on 14-day timeout',()=>{
 assert.match(master,/create or replace function public.pyramid_resolve_overdue/);
 for(const action of ["p_action='extend'","p_action='cancel'","p_action='forfeit'"])
  assert.ok(master.includes(action));
 assert.match(admin,/pyramid_resolve_overdue/);
 assert.match(client,/Frist überschritten – Ranglistenwart entscheidet/);
});

test('Master §5 no-show only 15 minutes after scheduled match, adjudicated by manager',()=>{
 assert.match(master,/c.scheduled_for\+interval '15 minutes'/);
 assert.match(master,/create or replace function public.pyramid_request_no_show/);
 assert.match(master,/create or replace function public.pyramid_decide_no_show/);
 assert.match(client,/data-pyramid-noshow/);
 assert.match(admin,/pyramid_decide_no_show/);
});

test('Master §5 weather extension once only and at most seven days',()=>{
 assert.match(master,/p_days<1 or p_days>7/);
 assert.match(master,/c.weather_extended_at is not null/);
 assert.match(master,/created_at\+interval '14 days'\+p_days\*interval '1 day'/);
 assert.match(admin,/pyramid_extend_weather/);
});

test('Master §5 neutralization expires after 28 days with NO automatic rank demotion',()=>{
 assert.match(master,/neutralized_at<=now\(\)-interval '28 days'/);
 assert.match(master,/neutralized_at=null,neutralized_reason=null/);
 const fragment=master.slice(master.indexOf('create or replace function private.pyramid_process_injury_neutrality()'));
 assert.doesNotMatch(fragment,/set position=/);
 assert.match(master,/tsv-pyramid-neutral-expiry/);
 assert.match(page,/maximal 28 Tage/);
 assert.match(client,/neutralNow\(item\)/);
});

test('User request: Urlaub and Verletzung badges bottom-right on phone and desktop',()=>{
 assert.match(styles,/\.pyramid-entry-away\{[\s\S]*?position:absolute;right:5px;bottom:5px/);
 assert.match(styles,/@media\(max-width:720px\)\{[\s\S]*?\.pyramid-entry-away\{[^}]*right:3px/);
 assert.doesNotMatch(styles,/\.pyramid-entry-away\{[^}]*left:/);
 assert.match(client,/friendlyReason\(item.neutralized_reason\)/);
 assert.match(styles,/\.pyramid-entry-avatar\{[\s\S]*?inset:5px auto auto 5px/);
});

test('Master §5 season May 1 to September 30 and admin archives existing ladders',()=>{
 assert.match(master,/2027-09-30/);
 assert.match(page,/1. Mai bis 30. September/);
 assert.match(admin,/pyramid-admin-archive/);
 assert.match(admin,/pyramid-admin-reactivate/);
});

test('Master roles and hidden route remain protected',()=>{
 assert.match(master,/private.can_manage_pyramid\(\)/);
 assert.match(master,/auth.uid\(\) is distinct from reviewer/);
 assert.match(page,/noindex=\{true\}/);
 assert.doesNotMatch(read('src/components/SiteHeader.astro'),/forderungspyramide/);
});
