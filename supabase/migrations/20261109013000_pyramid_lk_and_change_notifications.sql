-- One-time member LK declaration, later Superadmin maintenance, robust scores,
-- and transactional notifications for both participants on every match change.
alter table public.profiles
  add column if not exists tennis_lk_rating numeric(4,1)
    check (tennis_lk_rating between 1.0 and 25.0),
  add column if not exists tennis_lk_declared_at timestamptz;

create or replace function public.pyramid_declare_my_lk(p_lk numeric)
 returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich' using errcode='42501'; end if;
 if p_lk is null or p_lk<1.0 or p_lk>25.0 then
   raise exception 'LK-Wert muss zwischen 1.0 und 25.0 liegen';
 end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.profiles where id=auth.uid() and tennis_lk_declared_at is not null) then
   raise exception 'Die einmalige LK-Angabe wurde bereits gespeichert. Änderungen sind nur durch den Superadmin möglich';
 end if;
 update public.profiles set tennis_lk_rating=p_lk,tennis_lk_declared_at=now()
 where id=auth.uid();
 update public.pyramid_entries set lk_rating=p_lk where user_id=auth.uid();
end;
$$;
revoke all on function public.pyramid_declare_my_lk(numeric) from public,anon;
grant execute on function public.pyramid_declare_my_lk(numeric) to authenticated;

create or replace function public.pyramid_set_lk(p_entry uuid,p_lk numeric)
 returns void language plpgsql security definer set search_path = '' as $$
declare target_user uuid;
begin
 if not private.is_super_admin() then
   raise exception 'Nur der Superadmin darf bestehende LK-Werte ändern' using errcode='42501';
 end if;
 if p_lk is null or p_lk<1.0 or p_lk>25.0 then
   raise exception 'LK-Wert muss zwischen 1.0 und 25.0 liegen';
 end if;
 select user_id into strict target_user from public.pyramid_entries where id=p_entry for update;
 update public.pyramid_entries set lk_rating=p_lk where user_id=target_user;
 update public.profiles set tennis_lk_rating=p_lk,tennis_lk_declared_at=now()
 where id=target_user;
end;
$$;
revoke all on function public.pyramid_set_lk(uuid,numeric) from public,anon;
grant execute on function public.pyramid_set_lk(uuid,numeric) to authenticated;

create or replace function private.pyramid_valid_winning_score(p_score text) returns boolean
 language plpgsql immutable set search_path = '' as $$
declare v_set text; v_parts text[]; v_a integer; v_b integer;
        v_count integer:=0; v_wins_a integer:=0; v_wins_b integer:=0;
begin
 if p_score is null or p_score !~ '^[0-9]{1,2}:[0-9]{1,2}(, ?[0-9]{1,2}:[0-9]{1,2}){1,2}$' then return false; end if;
 for v_set in select regexp_split_to_table(p_score, ',\s*') loop
   v_count:=v_count+1; v_parts:=string_to_array(v_set,':');
   v_a:=v_parts[1]::integer; v_b:=v_parts[2]::integer;
   if not ((greatest(v_a,v_b)=6 and least(v_a,v_b)<=4)
     or (greatest(v_a,v_b)=7 and least(v_a,v_b) in (5,6))
     or (v_count=3 and greatest(v_a,v_b)>=10 and abs(v_a-v_b)>=2)) then return false; end if;
   if v_a>v_b then v_wins_a:=v_wins_a+1; else v_wins_b:=v_wins_b+1; end if;
 end loop;
 return (v_count=2 and v_wins_a=2 and v_wins_b=0)
    or (v_count=3 and v_wins_a=2 and v_wins_b=1);
end;
$$;
revoke all on function private.pyramid_valid_winning_score(text) from public,anon,authenticated;

create table if not exists private.pyramid_change_notices(
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references public.pyramid_challenges(id) on delete cascade,
 recipient_entry_id uuid not null references public.pyramid_entries(id) on delete cascade,
 event_type text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),sent_at timestamptz,
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),
 claimed_until timestamptz,last_error text
);
revoke all on private.pyramid_change_notices from public,anon,authenticated;
create index if not exists pyramid_change_notice_due_idx on private.pyramid_change_notices(next_attempt_at)
 where sent_at is null;

create or replace function private.pyramid_queue_change_notice() returns trigger
 language plpgsql security definer set search_path = '' as $$
declare event_name text;
begin
 if new.status is distinct from old.status then event_name:='status_'||new.status;
 elsif new.scheduled_for is distinct from old.scheduled_for then event_name:='termin_geaendert';
 elsif new.scheduled_confirmed_at is distinct from old.scheduled_confirmed_at then event_name:='termin_bestaetigt';
 elsif new.proposed_score is distinct from old.proposed_score then event_name:='ergebnis_geaendert';
 else event_name:='spiel_geaendert'; end if;
 insert into private.pyramid_change_notices(challenge_id,recipient_entry_id,event_type,details)
 values
  (new.id,new.challenger_id,event_name,jsonb_build_object('status',new.status,'scheduled_for',new.scheduled_for,'score',coalesce(new.proposed_score,new.score),'reason',coalesce(new.dispute_reason,new.refusal_reason))),
  (new.id,new.defender_id,event_name,jsonb_build_object('status',new.status,'scheduled_for',new.scheduled_for,'score',coalesce(new.proposed_score,new.score),'reason',coalesce(new.dispute_reason,new.refusal_reason)));
 return new;
end;
$$;
drop trigger if exists pyramid_challenge_change_mail on public.pyramid_challenges;
create trigger pyramid_challenge_change_mail after update on public.pyramid_challenges
 for each row when (old.* is distinct from new.*) execute function private.pyramid_queue_change_notice();

create or replace function public.claim_pyramid_change_notification()
 returns table(id uuid,recipient_email text,recipient_name text,opponent_name text,
   ladder_title text,season_label text,event_type text,details jsonb)
 language plpgsql security definer set search_path = '' as $$
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Nur der E-Mail-Service darf senden' using errcode='42501'; end if;
 return query with due as (
  select n.id from private.pyramid_change_notices n where n.sent_at is null and n.attempts<10
   and n.next_attempt_at<=now() and (n.claimed_until is null or n.claimed_until<now())
  order by n.created_at limit 1 for update skip locked
 ), claimed as (
  update private.pyramid_change_notices n set claimed_until=now()+interval '3 minutes',attempts=n.attempts+1
  from due where n.id=due.id returning n.*
 )
 select cl.id,coalesce(nullif(btrim(u.email),''),nullif(btrim(p.email),''))::text,
  recipient.display_name::text,opponent.display_name::text,l.title::text,l.season_label::text,
  cl.event_type::text,cl.details
 from claimed cl join public.pyramid_challenges c on c.id=cl.challenge_id
 join public.pyramid_entries recipient on recipient.id=cl.recipient_entry_id
 join public.pyramid_entries opponent on opponent.id=case when cl.recipient_entry_id=c.challenger_id then c.defender_id else c.challenger_id end
 join public.pyramid_ladders l on l.id=c.ladder_id left join auth.users u on u.id=recipient.user_id
 left join public.profiles p on p.id=recipient.user_id;
end;
$$;
revoke all on function public.claim_pyramid_change_notification() from public,anon,authenticated;
grant execute on function public.claim_pyramid_change_notification() to service_role;

create or replace function public.complete_pyramid_change_notification(p_id uuid,p_sent boolean,p_error text default null)
 returns void language plpgsql security definer set search_path = '' as $$
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Nur der E-Mail-Service darf senden' using errcode='42501'; end if;
 update private.pyramid_change_notices n set sent_at=case when p_sent then now() else null end,
  claimed_until=null,next_attempt_at=case when p_sent then now() else now()+make_interval(mins=>least(60,greatest(1,n.attempts*5))) end,
  last_error=case when p_sent then null else left(coalesce(p_error,'delivery_failed'),120) end
 where n.id=p_id and n.sent_at is null and n.claimed_until>now();
end;
$$;
revoke all on function public.complete_pyramid_change_notification(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.complete_pyramid_change_notification(uuid,boolean,text) to service_role;

create or replace function private.pyramid_dispatch_auto_declines()
 returns void language plpgsql security definer set search_path = '' as $$
declare token_value uuid;
begin
 delete from private.pyramid_cron_tokens where expires_at<now();
 if exists(select 1 from private.pyramid_auto_decline_notices n where n.sent_at is null and n.attempts<10 and n.next_attempt_at<=now() and (n.claimed_until is null or n.claimed_until<now()))
   or exists(select 1 from private.pyramid_change_notices n where n.sent_at is null and n.attempts<10 and n.next_attempt_at<=now() and (n.claimed_until is null or n.claimed_until<now())) then
   token_value:=gen_random_uuid(); insert into private.pyramid_cron_tokens(token,expires_at) values(token_value,now()+interval '2 minutes');
   perform net.http_post(url:='https://eaurnufdochjapfzqwvm.supabase.co/functions/v1/pyramid-auto-decline-email',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('dispatch_token',token_value::text),timeout_milliseconds:=15000);
 end if;
end;
$$;
revoke all on function private.pyramid_dispatch_auto_declines() from public,anon,authenticated;
