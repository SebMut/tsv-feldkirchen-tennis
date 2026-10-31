alter table public.matches
  add column if not exists lineup_format text not null default '6_3';

alter table public.matches
  drop constraint if exists matches_lineup_format_check;

alter table public.matches
  add constraint matches_lineup_format_check
  check (lineup_format in ('6_3','4_2'));

create table if not exists public.match_encounters (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  discipline text not null check (discipline in ('singles','doubles')),
  position integer not null check (position between 1 and 6),
  tsv_player_1_id uuid references public.players(id) on delete set null,
  tsv_player_2_id uuid references public.players(id) on delete set null,
  tsv_player_1_name text,
  tsv_player_2_name text,
  opponent_slot_1 integer check (opponent_slot_1 between 1 and 6),
  opponent_slot_2 integer check (opponent_slot_2 between 1 and 6),
  status text not null default 'scheduled' check (status in ('scheduled','live','finished')),
  result_text text,
  winner text check (winner in ('tsv','opponent')),
  sort_order integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(match_id, discipline, position)
);

create index if not exists match_encounters_match_sort_idx
  on public.match_encounters(match_id, sort_order, position);

alter table public.match_encounters enable row level security;

drop policy if exists "match_encounters_public_read" on public.match_encounters;
create policy "match_encounters_public_read"
on public.match_encounters for select to anon
using (
  exists (
    select 1 from public.matches m
    where m.id = match_encounters.match_id
      and m.is_published
  )
);

drop policy if exists "match_encounters_authenticated_read" on public.match_encounters;
create policy "match_encounters_authenticated_read"
on public.match_encounters for select to authenticated
using (
  exists (
    select 1 from public.matches m
    where m.id = match_encounters.match_id
      and m.is_published
  )
  or private.can_tick_match(match_id)
);

drop policy if exists "match_encounters_insert_ticker" on public.match_encounters;
create policy "match_encounters_insert_ticker"
on public.match_encounters for insert to authenticated
with check (private.can_tick_match(match_id));

drop policy if exists "match_encounters_update_ticker" on public.match_encounters;
create policy "match_encounters_update_ticker"
on public.match_encounters for update to authenticated
using (private.can_tick_match(match_id))
with check (private.can_tick_match(match_id));

drop policy if exists "match_encounters_delete_ticker" on public.match_encounters;
create policy "match_encounters_delete_ticker"
on public.match_encounters for delete to authenticated
using (private.can_tick_match(match_id));

grant select on public.match_encounters to anon;
grant select, insert, update, delete on public.match_encounters to authenticated;

create or replace function private.sync_match_live_score_from_encounters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_match uuid := coalesce(new.match_id, old.match_id);
  is_home_game boolean;
  tsv_points integer;
  opponent_points integer;
begin
  select m.is_home into is_home_game
  from public.matches m
  where m.id = target_match;

  select
    count(*) filter (where e.status = 'finished' and e.winner = 'tsv'),
    count(*) filter (where e.status = 'finished' and e.winner = 'opponent')
  into tsv_points, opponent_points
  from public.match_encounters e
  where e.match_id = target_match;

  insert into public.match_live_state(match_id, home_score, away_score, updated_at)
  values (
    target_match,
    case when is_home_game then tsv_points else opponent_points end,
    case when is_home_game then opponent_points else tsv_points end,
    now()
  )
  on conflict (match_id) do update
  set home_score = excluded.home_score,
      away_score = excluded.away_score,
      updated_at = now();

  return coalesce(new, old);
end;
$$;

drop trigger if exists match_encounters_sync_score on public.match_encounters;
create trigger match_encounters_sync_score
after insert or update of status, winner or delete on public.match_encounters
for each row execute function private.sync_match_live_score_from_encounters();

create or replace function public.ensure_match_encounters(target_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fmt text;
  singles_count integer;
  doubles_count integer;
  i integer;
begin
  if not private.can_tick_match(target_match) then
    raise exception 'not allowed';
  end if;

  select m.lineup_format into fmt
  from public.matches m
  where m.id = target_match;

  if fmt is null then
    raise exception 'match not found';
  end if;

  singles_count := case when fmt = '4_2' then 4 else 6 end;
  doubles_count := case when fmt = '4_2' then 2 else 3 end;

  for i in 1..singles_count loop
    insert into public.match_encounters(match_id, discipline, position, opponent_slot_1, sort_order)
    values (target_match, 'singles', i, i, i)
    on conflict (match_id, discipline, position) do nothing;
  end loop;

  for i in 1..doubles_count loop
    insert into public.match_encounters(match_id, discipline, position, sort_order)
    values (target_match, 'doubles', i, 100 + i)
    on conflict (match_id, discipline, position) do nothing;
  end loop;
end;
$$;

create or replace function public.configure_match_encounters(target_match uuid, target_format text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_format not in ('6_3','4_2') then
    raise exception 'invalid format';
  end if;

  if not private.can_tick_match(target_match) then
    raise exception 'not allowed';
  end if;

  update public.matches
  set lineup_format = target_format,
      updated_at = now()
  where id = target_match;

  delete from public.match_encounters where match_id = target_match;
  perform public.ensure_match_encounters(target_match);
end;
$$;

revoke all on function public.ensure_match_encounters(uuid) from public;
revoke all on function public.configure_match_encounters(uuid,text) from public;
grant execute on function public.ensure_match_encounters(uuid) to authenticated;
grant execute on function public.configure_match_encounters(uuid,text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'match_encounters'
     ) then
    alter publication supabase_realtime add table public.match_encounters;
  end if;
end;
$$;