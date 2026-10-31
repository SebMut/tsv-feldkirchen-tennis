-- Safe-by-default for adult and youth rosters.
-- This changes only future INSERTs; existing publication approvals are unchanged.
alter table public.team_players
  alter column public_visible set default false;
