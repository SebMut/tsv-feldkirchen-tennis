-- STAGING ONLY: add delegated pyramid management and automatic cancellation notices.
-- This file is versioned but MUST NOT be applied to the TSV production Supabase project until release approval.
alter table public.profiles drop constraint if exists profiles_global_permissions_allowed;
alter table public.profiles add constraint profiles_global_permissions_allowed
  check (global_permissions <@ array['events','news','ticker','pyramid']::text[]
    and array_position(global_permissions,null) is null);

-- Preserve stable membership IDs and creation dates when administrators edit roles.
-- Unchanged memberships are not deleted/reinserted; revoked teams are removed.
CREATE OR REPLACE FUNCTION public.admin_apply_user_permissions(target_user uuid, desired_role text, desired_permissions text[], desired_memberships jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_role text;
  membership_count integer;
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' then
    raise exception 'Only the administrative service may manage user roles' using errcode='42501';
  end if;
  if desired_role not in ('user','super_admin')
    or desired_permissions is null
    or not (desired_permissions <@ array['news','events','ticker','pyramid']::text[])
    or array_position(desired_permissions,null) is not null
    or desired_memberships is null
    or jsonb_typeof(desired_memberships) <> 'array' then
    raise exception 'Invalid permissions payload';
  end if;
  select global_role into current_role from public.profiles
    where id=target_user for update;
  if not found then raise exception 'User profile not found'; end if;
  if current_role='super_admin' and desired_role<>'super_admin'
     and (select count(*) from public.profiles where global_role='super_admin') <= 1 then
    raise exception 'The last SuperAdmin cannot be demoted';
  end if;
  if desired_role='super_admin' and (jsonb_array_length(desired_memberships)<>0 or cardinality(desired_permissions)<>0) then
    raise exception 'SuperAdmin must not have additional scoped assignments';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(desired_memberships) as x(team_id uuid, role text)
    where x.team_id is null or x.role is null
      or x.role not in ('manager','editor','ticker')
      or not exists(select 1 from public.teams t where t.id=x.team_id)
  ) then raise exception 'Invalid team assignment'; end if;
  select count(*) into membership_count from jsonb_to_recordset(desired_memberships)
    as x(team_id uuid,role text);
  if membership_count <> (
    select count(distinct x.team_id) from jsonb_to_recordset(desired_memberships)
      as x(team_id uuid,role text)
  ) then raise exception 'Duplicate team assignments'; end if;

  update public.profiles set global_role=desired_role,
    global_permissions=desired_permissions where id=target_user;
  -- Keep unchanged memberships (and their IDs/timestamps). Delete only revoked teams.
  delete from public.team_memberships tm
    where tm.user_id=target_user
      and (desired_role <> 'user' or not exists(
        select 1 from jsonb_to_recordset(desired_memberships)
          as x(team_id uuid,role text) where x.team_id=tm.team_id
      ));
  if desired_role='user' then
    insert into public.team_memberships as tm(user_id,team_id,role,active)
    select target_user,x.team_id,x.role,true
    from jsonb_to_recordset(desired_memberships) as x(team_id uuid,role text)
    on conflict (user_id,team_id) do update
      set role=excluded.role,active=true
      where tm.role is distinct from excluded.role or not tm.active;
  end if;
end;
$function$;

-- Reuse the established persisted global permission helper; no shadow role system.
create or replace function private.can_manage_pyramid() returns boolean
 language sql stable security definer set search_path = '' as $$
 select private.has_global_permission('pyramid');
$$;
revoke all on function private.can_manage_pyramid() from public,anon;
grant execute on function private.can_manage_pyramid() to authenticated;

drop policy if exists pyramid_ladders_read on public.pyramid_ladders;
create policy pyramid_ladders_read on public.pyramid_ladders for select to authenticated
 using (active or private.can_manage_pyramid());
drop policy if exists pyramid_ladders_admin_insert on public.pyramid_ladders;
create policy pyramid_ladders_admin_insert on public.pyramid_ladders for insert to authenticated
 with check (private.can_manage_pyramid());
drop policy if exists pyramid_ladders_admin_update on public.pyramid_ladders;
create policy pyramid_ladders_admin_update on public.pyramid_ladders for update to authenticated
 using (private.can_manage_pyramid()) with check (private.can_manage_pyramid());
create or replace function private.can_view_pyramid(p_ladder_id uuid) returns boolean
 language sql stable security definer set search_path = '' as $$
 select private.can_manage_pyramid() or exists (
   select 1 from public.pyramid_entries e
   where e.ladder_id=p_ladder_id and e.user_id=(select auth.uid())
 );
$$;
drop policy if exists pyramid_requests_read on public.pyramid_requests;
create policy pyramid_requests_read on public.pyramid_requests for select to authenticated
 using (user_id=(select auth.uid()) or private.can_manage_pyramid());

-- All management functions are guarded inside PostgreSQL, not just by a hidden UI.
create or replace function public.pyramid_approve_join(p_request uuid)
 returns uuid language plpgsql security definer set search_path = '' as $$
declare req public.pyramid_requests%rowtype; new_id uuid; next_position integer;
begin
 if not private.can_manage_pyramid() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 select * into strict req from public.pyramid_requests where id=p_request;
 perform 1 from public.pyramid_ladders where id=req.ladder_id for update;
 select * into strict req from public.pyramid_requests where id=p_request for update;
 if req.status<>'pending' then raise exception 'Diese Anfrage ist bereits bearbeitet'; end if;
 select coalesce(max(position),0)+1 into next_position
   from public.pyramid_entries where ladder_id=req.ladder_id;
 insert into public.pyramid_entries(ladder_id,user_id,display_name,position)
 values(req.ladder_id,req.user_id,req.display_name,next_position) returning id into new_id;
 update public.pyramid_requests set status='approved',reviewed_at=now() where id=req.id;
 return new_id;
end;
$$;
create or replace function public.pyramid_move_entry(p_entry uuid,p_delta integer)
 returns void language plpgsql security definer set search_path = '' as $$
declare e public.pyramid_entries%rowtype; swap_id uuid;
begin
 if not private.can_manage_pyramid() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 if p_delta not in (-1,1) then raise exception 'Nur ein Rang je Schritt möglich'; end if;
 select * into strict e from public.pyramid_entries where id=p_entry;
 perform 1 from public.pyramid_ladders where id=e.ladder_id for update;
 select * into strict e from public.pyramid_entries where id=p_entry for update;
 if exists(select 1 from public.pyramid_challenges where ladder_id=e.ladder_id
   and status in ('pending','accepted')) then
   raise exception 'Bei offenen Forderungen können Plätze nicht manuell geändert werden';
 end if;
 select id into swap_id from public.pyramid_entries where ladder_id=e.ladder_id
   and position=e.position+p_delta;
 if swap_id is null then raise exception 'Kein Nachbarplatz vorhanden'; end if;
 update public.pyramid_entries set position=case when id=e.id then e.position+p_delta
   else e.position end where id in (e.id,swap_id);
end;
$$;
create or replace function public.pyramid_finalize_seed(p_ladder uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare l public.pyramid_ladders%rowtype;
begin
 if not private.can_manage_pyramid() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 select * into strict l from public.pyramid_ladders where id=p_ladder for update;
 if l.seeded_at is not null then raise exception 'Startaufstellung ist bereits abgeschlossen'; end if;
 if (select count(*) from public.pyramid_entries where ladder_id=p_ladder)<2 then
   raise exception 'Für eine Startaufstellung werden mindestens zwei Teilnehmer benötigt';
 end if;
 if exists(select 1 from public.pyramid_challenges where ladder_id=p_ladder and status in ('pending','accepted')) then
   raise exception 'Bei offenen Forderungen kann nicht abgeschlossen werden';
 end if;
 update public.pyramid_entries set provisional=false where ladder_id=p_ladder;
 update public.pyramid_ladders set seeded_at=now() where id=p_ladder;
end;
$$;
create or replace function public.pyramid_report_result(p_challenge uuid,p_score text,p_winner uuid default null)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; own_entry uuid; w uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select id into own_entry from public.pyramid_entries where ladder_id=c.ladder_id and user_id=auth.uid();
 w:=coalesce(p_winner,own_entry);
 if c.status<>'accepted' then raise exception 'Das Forderungsspiel ist nicht offen'; end if;
 if not private.can_manage_pyramid() and (w is distinct from own_entry
     or own_entry not in (c.challenger_id,c.defender_id)) then
   raise exception 'Nur der Sieger darf sein Ergebnis melden' using errcode='42501';
 end if;
 if w not in (c.challenger_id,c.defender_id) then raise exception 'Ungültiger Sieger'; end if;
 if p_score is null or char_length(p_score)>80 or not private.pyramid_valid_winning_score(p_score) then
   raise exception 'Ergebnisformat: 6:4, 6:3 oder 6:4, 4:6, 10:8';
 end if;
 perform private.pyramid_finish(c.id,w,'completed',p_score);
end;
$$;

alter table public.pyramid_challenges add column decline_reason text
 check (decline_reason in ('another_match_accepted','player_declined'));

-- Rejection emails: transactional outbox, committed with each automatic decline.
create table private.pyramid_auto_decline_notices(
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null unique references public.pyramid_challenges(id) on delete cascade,
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 claimed_until timestamptz,
 last_error text
);
revoke all on private.pyramid_auto_decline_notices from public,anon,authenticated;
create index pyramid_auto_decline_due_idx on private.pyramid_auto_decline_notices(next_attempt_at)
 where sent_at is null;

create table private.pyramid_cron_tokens(
 token uuid primary key,expires_at timestamptz not null
);
revoke all on private.pyramid_cron_tokens from public,anon,authenticated;

-- All requests are serialized on the ladder row. The first accepted challenge wins.
-- Other unanswered requests aimed at *either engaged participant* are rejected.
-- They cannot be challenged again until this accepted match is completed.
create or replace function public.pyramid_respond(p_challenge uuid,p_accept boolean)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; defender_user uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select user_id into defender_user from public.pyramid_entries where id=c.defender_id;
 if auth.uid() is distinct from defender_user then
   raise exception 'Nur die geforderte Person darf antworten' using errcode='42501';
 end if;
 if c.status<>'pending' or c.accept_deadline<=now() then
   raise exception 'Annahmefrist abgelaufen oder bereits beantwortet';
 end if;
 if p_accept then
   if exists(select 1 from public.pyramid_challenges where id<>c.id and status='accepted'
     and (challenger_id in (c.challenger_id,c.defender_id)
       or defender_id in (c.challenger_id,c.defender_id))) then
     raise exception 'Ein Spieler hat bereits ein angenommenes Forderungsspiel';
   end if;
   update public.pyramid_challenges set status='accepted',
     accepted_at=now(),play_deadline=now()+interval '10 days' where id=c.id;
   with rejected as (
     update public.pyramid_challenges
       set status='declined', resolved_at=now(),decline_reason='another_match_accepted'
     where ladder_id=c.ladder_id and id<>c.id and status='pending'
       and (defender_id in (c.challenger_id,c.defender_id)
         or challenger_id in (c.challenger_id,c.defender_id))
     returning id
   )
   insert into private.pyramid_auto_decline_notices(challenge_id)
   select id from rejected on conflict(challenge_id) do nothing;
 else
   if not exists(select 1 from public.pyramid_challenges where id<>c.id
     and status in ('pending','accepted')
     and (challenger_id=c.defender_id or defender_id=c.defender_id)) then
     raise exception 'Ablehnen ist nur bei einer anderen offenen Forderung erlaubt';
   end if;
   update public.pyramid_challenges set status='declined',resolved_at=now(),decline_reason='player_declined' where id=c.id;
 end if;
end;
$$;

-- Locking in pyramid_challenge already rejects new requests against accepted
-- participants. Keep all decisions server-side; do not rely on disabled buttons.

create or replace function private.pyramid_dispatch_auto_declines()
 returns void language plpgsql security definer set search_path = '' as $$
declare token_value uuid;
begin
 delete from private.pyramid_cron_tokens where expires_at<now();
 if exists(select 1 from private.pyramid_auto_decline_notices n
   where n.sent_at is null and n.attempts<10
    and n.next_attempt_at<=now()
    and (n.claimed_until is null or n.claimed_until<now())) then
   token_value:=gen_random_uuid();
   insert into private.pyramid_cron_tokens(token,expires_at)
   values(token_value,now()+interval '2 minutes');
   perform net.http_post(
     url:='https://eaurnufdochjapfzqwvm.supabase.co/functions/v1/pyramid-auto-decline-email',
     headers:='{"Content-Type":"application/json"}'::jsonb,
     body:=jsonb_build_object('dispatch_token',token_value::text),
     timeout_milliseconds:=15000
   );
 end if;
end;
$$;
revoke all on function private.pyramid_dispatch_auto_declines() from public,anon,authenticated;
create or replace function public.consume_pyramid_cron_token(p_token uuid)
 returns boolean language plpgsql security definer set search_path = '' as $$
declare consumed uuid;
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then
   raise exception 'Nur der E-Mail-Service darf senden' using errcode='42501';
 end if;
 delete from private.pyramid_cron_tokens where token=p_token and expires_at>now()
 returning token into consumed;
 return consumed is not null;
end;
$$;
revoke all on function public.consume_pyramid_cron_token(uuid) from public,anon,authenticated;
grant execute on function public.consume_pyramid_cron_token(uuid) to service_role;

create or replace function public.claim_pyramid_auto_decline_notice()
 returns table(id uuid,recipient_email text,challenger_name text,defender_name text,
   ladder_title text,season_label text)
 language plpgsql security definer set search_path = '' as $$
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then
   raise exception 'Nur der E-Mail-Service darf senden' using errcode='42501';
 end if;
 return query with due as (
  select n.id from private.pyramid_auto_decline_notices n
  where n.sent_at is null and n.attempts<10 and n.next_attempt_at<=now()
    and (n.claimed_until is null or n.claimed_until<now())
  order by n.created_at limit 1 for update skip locked
 ), claimed as (
  update private.pyramid_auto_decline_notices n
     set claimed_until=now()+interval '3 minutes',attempts=n.attempts+1
  from due where n.id=due.id returning n.id,n.challenge_id
 )
 select cl.id,
   coalesce(nullif(btrim(u.email),''),nullif(btrim(p.email),''))::text as recipient_email,
   ch.display_name::text as challenger_name,
   df.display_name::text as defender_name,
   l.title::text as ladder_title,l.season_label::text
 from claimed cl
 join public.pyramid_challenges c on c.id=cl.challenge_id
 join public.pyramid_entries ch on ch.id=c.challenger_id
 join public.pyramid_entries df on df.id=c.defender_id
 join public.pyramid_ladders l on l.id=c.ladder_id
 left join auth.users u on u.id=ch.user_id
 left join public.profiles p on p.id=ch.user_id;
end;
$$;
revoke all on function public.claim_pyramid_auto_decline_notice() from public,anon,authenticated;
grant execute on function public.claim_pyramid_auto_decline_notice() to service_role;

create or replace function public.complete_pyramid_auto_decline_notice(
 p_id uuid,p_sent boolean,p_error text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then
   raise exception 'Nur der E-Mail-Service darf senden' using errcode='42501';
 end if;
 update private.pyramid_auto_decline_notices n
 set sent_at=case when p_sent then now() else null end,
  claimed_until=null,
  next_attempt_at=case when p_sent then now()
    else now()+make_interval(mins=>least(60,greatest(1,n.attempts*5))) end,
  last_error=case when p_sent then null else left(coalesce(p_error,'delivery_failed'),120) end
 where n.id=p_id and n.sent_at is null and n.claimed_until>now();
end;
$$;
revoke all on function public.complete_pyramid_auto_decline_notice(uuid,boolean,text)
 from public,anon,authenticated;
grant execute on function public.complete_pyramid_auto_decline_notice(uuid,boolean,text) to service_role;

select cron.schedule('tsv-pyramid-auto-decline-mail','* * * * *',
 'select private.pyramid_dispatch_auto_declines();');
