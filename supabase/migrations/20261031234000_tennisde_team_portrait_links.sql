-- A verified external team portrait is an optional reference, not a replacement
-- for TSV match venues, live ticker, lineup data or Supabase fixtures.
alter table public.team_seasons
  add column if not exists tennis_de_portrait_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'team_seasons_tennis_de_portrait_url_check'
      and conrelid = 'public.team_seasons'::regclass
  ) then
    alter table public.team_seasons
      add constraint team_seasons_tennis_de_portrait_url_check
      check (
        tennis_de_portrait_url is null or
        tennis_de_portrait_url ~
          '^https://www\.tennis\.de/spielen/spielbetrieb/mannschaftssuche\.html\?verband=btv&verein=01012#teamportrait/[0-9]+$'
      );
  end if;
end $$;

update public.team_seasons ts
set tennis_de_portrait_url =
  'https://www.tennis.de/spielen/spielbetrieb/mannschaftssuche.html?verband=btv&verein=01012#teamportrait/3728614'
from public.teams t, public.seasons s
where ts.team_id = t.id and ts.season_id = s.id
  and t.slug = 'herren' and s.code = 'winter-2026-2027'
  and ts.tennis_de_portrait_url is null;
