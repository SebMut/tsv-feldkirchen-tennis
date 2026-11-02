-- TSV Feldkirchen: tickers close 24h after first live activation.
-- Explicitly separate "timeout" from a genuine finished tennis match.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.match_live_state
  add column if not exists started_by uuid references auth.users(id) on delete set null,
  add column if not exists auto_closed_at timestamptz;

alter table public.match_live_state drop constraint if exists match_live_state_status_check;
alter table public.match_live_state add constraint match_live_state_status_check
  check (status in ('scheduled','live','finished','cancelled','expired'));

-- Preserve the best available starter identity for already-running sessions.
update public.match_live_state
set started_by=updated_by
where status='live' and started_by is null and updated_by is not null;

create or replace function private.track_ticker_start()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status='live' and old.status is distinct from 'live' then
    -- Restarting an expired ticker is an explicit NEW 24h session.
    new.started_at=now();
    new.started_by=new.updated_by;
    new.auto_closed_at=null;
    new.finished_at=null;
  elsif new.status='scheduled' and old.status is distinct from 'scheduled' then
    new.started_at=null;
    new.started_by=null;
    new.auto_closed_at=null;
  end if;
  return new;
end;
$$;
revoke all on function private.track_ticker_start() from public;
drop trigger if exists match_live_state_track_start on public.match_live_state;
create trigger match_live_state_track_start
before update on public.match_live_state
for each row execute function private.track_ticker_start();

create table if not exists private.ticker_timeout_notices(
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  started_at timestamptz not null,
  starter_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_until timestamptz,
  last_error text,
  unique(match_id,started_at)
);
revoke all on private.ticker_timeout_notices from public,anon,authenticated;
create index if not exists ticker_timeout_notices_due_idx
  on private.ticker_timeout_notices(next_attempt_at)
  where sent_at is null;

create table if not exists private.ticker_cron_tokens(
  token uuid primary key,
  expires_at timestamptz not null
);
revoke all on private.ticker_cron_tokens from public,anon,authenticated;

-- Short lived unguessable dispatcher tokens are handed only to pg_net.
-- No static API key or OAuth secret is kept in SQL source.
create or replace function private.close_expired_tickers()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  dispatch_token uuid;
begin
  with just_closed as (
    update public.match_live_state s
       set status='expired',auto_closed_at=now(),finished_at=null
     where s.status='live' and s.started_at<=now()-interval '24 hours'
     returning s.match_id,s.started_at,s.started_by
  )
  insert into private.ticker_timeout_notices(match_id,started_at,starter_user_id)
  select match_id,started_at,started_by from just_closed
  where started_by is not null
  on conflict(match_id,started_at) do nothing;

  delete from private.ticker_cron_tokens where expires_at<now();

  if exists(
    select 1 from private.ticker_timeout_notices n
    where n.sent_at is null and n.attempts<10
      and n.next_attempt_at<=now()
      and (n.claimed_until is null or n.claimed_until<now())
  ) then
    dispatch_token:=gen_random_uuid();
    insert into private.ticker_cron_tokens(token,expires_at)
      values(dispatch_token,now()+interval '2 minutes');
    perform net.http_post(
      url:='https://eaurnufdochjapfzqwvm.supabase.co/functions/v1/ticker-timeout-email',
      headers:='{"Content-Type":"application/json"}'::jsonb,
      body:=jsonb_build_object('dispatch_token',dispatch_token::text),
      timeout_milliseconds:=15000
    );
  end if;
end;
$$;
revoke all on function private.close_expired_tickers() from public,anon,authenticated;

create or replace function public.consume_ticker_cron_token(p_token uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_token uuid;
begin
  delete from private.ticker_cron_tokens
  where token=p_token and expires_at>now()
  returning token into v_token;
  return v_token is not null;
end;
$$;
revoke all on function public.consume_ticker_cron_token(uuid) from public,anon,authenticated;
grant execute on function public.consume_ticker_cron_token(uuid) to service_role;

create or replace function public.claim_ticker_timeout_notice()
returns table(id uuid,recipient_email text,match_id uuid,opponent text,
              team_name text,is_home boolean,started_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with next_notice as (
    select n.id
    from private.ticker_timeout_notices n
    where n.sent_at is null and n.attempts<10
      and n.next_attempt_at<=now()
      and (n.claimed_until is null or n.claimed_until<now())
    order by n.created_at
    limit 1 for update skip locked
  ), claimed as (
    update private.ticker_timeout_notices n
      set claimed_until=now()+interval '3 minutes',attempts=n.attempts+1
    from next_notice
    where n.id=next_notice.id
    returning n.id,n.match_id,n.starter_user_id,n.started_at
  )
  select c.id,
         coalesce(nullif(btrim(u.email),''),nullif(btrim(p.email),''))::text as recipient_email,
         c.match_id,
         m.opponent::text,
         t.name::text as team_name,
         m.is_home,
         c.started_at
  from claimed c
  join public.matches m on m.id=c.match_id
  join public.team_seasons ts on ts.id=m.team_season_id
  join public.teams t on t.id=ts.team_id
  left join auth.users u on u.id=c.starter_user_id
  left join public.profiles p on p.id=c.starter_user_id;
end;
$$;
revoke all on function public.claim_ticker_timeout_notice() from public,anon,authenticated;
grant execute on function public.claim_ticker_timeout_notice() to service_role;

create or replace function public.complete_ticker_timeout_notice(
  p_id uuid,p_sent boolean,p_error text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update private.ticker_timeout_notices
  set sent_at=case when p_sent then now() else null end,
      claimed_until=null,
      next_attempt_at=case when p_sent then now()
        else now()+make_interval(mins=>least(60,greatest(1,attempts*5))) end,
      last_error=case when p_sent then null else left(coalesce(p_error,'delivery_failed'),120) end
  where id=p_id and sent_at is null and claimed_until>now();
end;
$$;
revoke all on function public.complete_ticker_timeout_notice(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.complete_ticker_timeout_notice(uuid,boolean,text) to service_role;

-- Idempotent scheduled maintenance. SQL closes tickers even if Gmail is offline;
-- notification delivery is retried through the private outbox.
select cron.schedule(
  'tsv-ticker-close-after-24h',
  '* * * * *',
  'select private.close_expired_tickers();'
);
