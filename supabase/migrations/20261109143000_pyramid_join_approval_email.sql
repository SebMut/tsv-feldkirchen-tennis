-- New participants choose a ladder after their first login. Approval remains a
-- server-side Superadmin action and queues a durable confirmation email.
create table if not exists private.pyramid_join_approval_notices (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.pyramid_requests(id) on delete cascade,
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 claimed_until timestamptz,
 last_error text
);
revoke all on private.pyramid_join_approval_notices from public,anon,authenticated;
create index if not exists pyramid_join_approval_due_idx
 on private.pyramid_join_approval_notices(next_attempt_at) where sent_at is null;

create or replace function public.pyramid_approve_join(p_request uuid)
 returns uuid language plpgsql security definer set search_path = '' as $$
declare req public.pyramid_requests%rowtype; l public.pyramid_ladders%rowtype;
        new_id uuid; next_position integer;
begin
 if not private.is_super_admin() then
   raise exception 'Nur der Superadmin darf Teilnahmeanfragen genehmigen' using errcode='42501';
 end if;
 select * into strict req from public.pyramid_requests where id=p_request;
 select * into strict l from public.pyramid_ladders where id=req.ladder_id for update;
 select * into strict req from public.pyramid_requests where id=p_request for update;
 if req.status<>'pending' then raise exception 'Diese Anfrage ist bereits bearbeitet'; end if;
 select coalesce(max(position),0)+1 into next_position
   from public.pyramid_entries where ladder_id=req.ladder_id;
 insert into public.pyramid_entries(ladder_id,user_id,display_name,position,qualified,provisional)
 values(req.ladder_id,req.user_id,req.display_name,next_position,true,l.seeded_at is null)
 returning id into new_id;
 update public.pyramid_requests set status='approved',reviewed_at=now() where id=req.id;
 insert into private.pyramid_join_approval_notices(request_id) values(req.id)
   on conflict(request_id) do nothing;
 return new_id;
end;
$$;

create or replace function public.claim_pyramid_join_approval_notification()
 returns table(id uuid,recipient_email text,recipient_name text,
   ladder_title text,season_label text)
 language plpgsql security definer set search_path = '' as $$
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then
   raise exception 'Nur der E-Mail-Service darf senden' using errcode='42501';
 end if;
 return query with due as (
  select n.id from private.pyramid_join_approval_notices n
  where n.sent_at is null and n.attempts<10 and n.next_attempt_at<=now()
    and (n.claimed_until is null or n.claimed_until<now())
  order by n.created_at limit 1 for update skip locked
 ), claimed as (
  update private.pyramid_join_approval_notices n
     set claimed_until=now()+interval '3 minutes',attempts=n.attempts+1
  from due where n.id=due.id returning n.id,n.request_id
 )
 select cl.id,
   coalesce(nullif(btrim(u.email),''),nullif(btrim(p.email),''))::text,
   r.display_name::text,l.title::text,l.season_label::text
 from claimed cl
 join public.pyramid_requests r on r.id=cl.request_id
 join public.pyramid_ladders l on l.id=r.ladder_id
 left join auth.users u on u.id=r.user_id
 left join public.profiles p on p.id=r.user_id;
end;
$$;
revoke all on function public.claim_pyramid_join_approval_notification()
 from public,anon,authenticated;
grant execute on function public.claim_pyramid_join_approval_notification() to service_role;

create or replace function public.complete_pyramid_join_approval_notification(
 p_id uuid,p_sent boolean,p_error text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then
   raise exception 'Nur der E-Mail-Service darf senden' using errcode='42501';
 end if;
 update private.pyramid_join_approval_notices n
 set sent_at=case when p_sent then now() else null end,
  claimed_until=null,
  next_attempt_at=case when p_sent then now()
    else now()+make_interval(mins=>least(60,greatest(1,n.attempts*5))) end,
  last_error=case when p_sent then null else left(coalesce(p_error,'delivery_failed'),120) end
 where n.id=p_id and n.sent_at is null and n.claimed_until>now();
end;
$$;
revoke all on function public.complete_pyramid_join_approval_notification(uuid,boolean,text)
 from public,anon,authenticated;
grant execute on function public.complete_pyramid_join_approval_notification(uuid,boolean,text)
 to service_role;

create or replace function private.pyramid_dispatch_auto_declines()
 returns void language plpgsql security definer set search_path = '' as $$
declare token_value uuid;
begin
 delete from private.pyramid_cron_tokens where expires_at<now();
 if exists(select 1 from private.pyramid_auto_decline_notices n where n.sent_at is null and n.attempts<10 and n.next_attempt_at<=now() and (n.claimed_until is null or n.claimed_until<now()))
   or exists(select 1 from private.pyramid_change_notices n where n.sent_at is null and n.attempts<10 and n.next_attempt_at<=now() and (n.claimed_until is null or n.claimed_until<now()))
   or exists(select 1 from private.pyramid_join_approval_notices n where n.sent_at is null and n.attempts<10 and n.next_attempt_at<=now() and (n.claimed_until is null or n.claimed_until<now())) then
  token_value:=gen_random_uuid();
  insert into private.pyramid_cron_tokens(token,expires_at) values(token_value,now()+interval '2 minutes');
  perform net.http_post(
   url:='https://eaurnufdochjapfzqwvm.supabase.co/functions/v1/pyramid-auto-decline-email',
   headers:='{"Content-Type":"application/json"}'::jsonb,
   body:=jsonb_build_object('dispatch_token',token_value::text),timeout_milliseconds:=15000
  );
 end if;
end;
$$;
revoke all on function private.pyramid_dispatch_auto_declines() from public,anon,authenticated;
