-- TSV Feldkirchen Tennis: non-persistent RLS integration rehearsal for Ticker-role interim scores.
-- Target: Supabase eaurnufdochjapfzqwvm only. Requires a trusted SQL admin connection.
-- Uses an existing active ticker membership for a published match with a scheduled
-- encounter. The test changes a row only inside BEGIN...ROLLBACK.
-- Never use COMMIT. Do not run concurrently with a real match.
-- This does NOT log into the web UI; it verifies the database permissions and triggers.
begin;
-- Select the role principal from existing team_memberships without exposing identifiers.
select set_config('request.jwt.claim.sub', (
  select tm.user_id::text from public.team_memberships tm
  join public.team_seasons ts on ts.team_id=tm.team_id
  join public.matches m on m.team_season_id=ts.id
  join public.match_live_state ls on ls.match_id=m.id and ls.status='live'
  join public.match_encounters e on e.match_id=m.id and e.status='scheduled'
  join auth.users u on u.id=tm.user_id
  where tm.role='ticker' and tm.active and m.is_published
  order by e.created_at desc limit 1
),true);
select set_config('qa.encounter_id', (
  select e.id::text from public.team_memberships tm
  join public.team_seasons ts on ts.team_id=tm.team_id
  join public.matches m on m.team_season_id=ts.id
  join public.match_live_state ls on ls.match_id=m.id and ls.status='live'
  join public.match_encounters e on e.match_id=m.id and e.status='scheduled'
  where tm.user_id::text=current_setting('request.jwt.claim.sub')
    and tm.role='ticker' and tm.active
  order by e.created_at desc limit 1
),true);
do $$
begin
  if nullif(current_setting('request.jwt.claim.sub',true),'') is null
  or nullif(current_setting('qa.encounter_id',true),'') is null then
    raise exception 'No active ticker fixture found: cannot run rollback QA safely';
  end if;
end
$$;
set local role authenticated;
-- This is the same patch shape used by the admin client. The row must be returned
-- by the authenticated role's UPDATE and SELECT policies.
with written as (
  update public.match_encounters set
    result_text='1:0',
    status='live',
    winner=null,
    finished_at=null,
    started_at=coalesce(started_at,now()),
    updated_by=auth.uid(),
    updated_at=now()
  where id=current_setting('qa.encounter_id')::uuid
  returning id,result_text,status
)
select count(*)=1 as score_update_succeeded,
       bool_and(result_text='1:0' and status='live') as correct_saved_values
from written;
rollback;

-- Missing authenticated identity must never authorize the same UPDATE.
begin;
select set_config('qa.encounter_id', (
  select e.id::text from public.match_encounters e
  join public.matches m on m.id=e.match_id
  where m.is_published
  order by e.created_at desc limit 1
),true);
set local role authenticated;
with denied as (
  update public.match_encounters set result_text='1:0'
  where id=current_setting('qa.encounter_id')::uuid
  returning id
)
select count(*)=0 as no_identity_write_denied from denied;
rollback;
