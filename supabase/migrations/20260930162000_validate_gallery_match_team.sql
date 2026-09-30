create or replace function private.validate_gallery_match_team()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  match_team_id uuid;
begin
  if new.match_id is null or new.team_id is null then
    return new;
  end if;

  select ts.team_id
    into match_team_id
  from public.matches m
  join public.team_seasons ts on ts.id = m.team_season_id
  where m.id = new.match_id;

  if match_team_id is null then
    raise exception 'Punktspiel nicht gefunden';
  end if;

  if match_team_id <> new.team_id then
    raise exception 'Galerie-Mannschaft und Punktspiel-Mannschaft stimmen nicht überein';
  end if;

  return new;
end;
$$;

drop trigger if exists galleries_validate_match_team on public.galleries;
create trigger galleries_validate_match_team
before insert or update of team_id, match_id
on public.galleries
for each row
execute function private.validate_gallery_match_team();
