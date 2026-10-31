-- Three independent tennis competitions; 2027 is the ending year for Winter 2026/27.
-- Keep the pre-existing 2026 season and all linked teams/matches untouched.
alter table public.seasons
  add column if not exists season_type text not null default 'summer',
  add column if not exists code text,
  add column if not exists end_year integer,
  add column if not exists display_order integer not null default 100,
  add column if not exists is_published boolean not null default true;
update public.seasons set
  code = coalesce(code, 'sommer-' || year::text),
  end_year = coalesce(end_year, year),
  display_order = case when year = 2026 then 10 else display_order end
where code is null or end_year is null or (year = 2026 and display_order = 100);
alter table public.seasons alter column code set not null;
alter table public.seasons drop constraint if exists seasons_year_key;
alter table public.seasons drop constraint if exists seasons_year_type_key;
alter table public.seasons add constraint seasons_year_type_key unique (year,season_type);
alter table public.seasons drop constraint if exists seasons_code_key;
alter table public.seasons add constraint seasons_code_key unique (code);
alter table public.seasons drop constraint if exists seasons_type_check;
alter table public.seasons add constraint seasons_type_check check (season_type in ('summer','winter'));
alter table public.seasons drop constraint if exists seasons_end_year_check;
alter table public.seasons add constraint seasons_end_year_check check (end_year between year and year + 1);
insert into public.seasons
  (name,year,end_year,season_type,code,starts_on,ends_on,display_order,is_published,is_current)
values
  ('Winter 2026/2027',2027,2027,'winter','winter-2026-2027','2026-10-01','2027-04-30',20,true,false),
  ('Sommer 2027',2027,2027,'summer','sommer-2027','2027-04-01','2027-09-30',30,true,false)
on conflict (code) do nothing;
-- We deliberately create NO team_seasons or matches: winter entries must be officially verified.
