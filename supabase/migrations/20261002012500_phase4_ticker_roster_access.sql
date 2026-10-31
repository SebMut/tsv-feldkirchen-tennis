create or replace function private.can_tick_team_season(target_team_season uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_seasons ts
    where ts.id = target_team_season
      and private.can_tick_team(ts.team_id)
  );
$$;

drop policy if exists "team_players_authenticated_read" on public.team_players;
create policy "team_players_authenticated_read"
on public.team_players for select to authenticated
using (
  public_visible
  or private.can_edit_team_season(team_season_id)
  or private.can_tick_team_season(team_season_id)
);