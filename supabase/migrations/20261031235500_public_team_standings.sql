create table if not exists public.team_standings (
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  rank smallint not null check (rank between 1 and 30),
  team_name text not null check (length(btrim(team_name)) between 1 and 100),
  club_code text not null check (club_code ~ '^[0-9]{5}$'),
  standing_text text not null check (length(btrim(standing_text)) between 1 and 160),
  source_url text not null check (source_url like 'https://btv.liga.nu/%'),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  synced_at timestamptz not null default now(),
  primary key (team_season_id, rank)
);

alter table public.team_standings enable row level security;
revoke all on public.team_standings from public;
grant select on public.team_standings to anon, authenticated;
drop policy if exists team_standings_public_read on public.team_standings;
create policy team_standings_public_read on public.team_standings
  for select to anon, authenticated using (true);
