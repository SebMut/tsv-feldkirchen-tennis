-- Verified public BTV winter 2026/27 registrations for club 01012.
-- Reference: https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften
-- Official BTV widget: H00 S2 Gr.018; H00 S2 Gr.020; H50 S1 Gr.166.
-- The two H00 entries follow the official listing order for Herren/Herren II.
-- Do not infer or insert any other winter teams or private player names.
with winter as (
  select id from public.seasons
  where code='winter-2026-2027' and season_type='winter'
),
entries (slug, league, group_name) as (
  values
    ('herren', 'Südliga 2', 'Gr. 018'),
    ('herren-ii', 'Südliga 2', 'Gr. 020'),
    ('herren-50', 'Südliga 1', 'Gr. 166')
)
insert into public.team_seasons
  (team_id,season_id,league,group_name,btv_url,is_published)
select t.id,w.id,e.league,e.group_name,
  'https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften',
  true
from entries e
join public.teams t on t.slug=e.slug
cross join winter w
on conflict (team_id,season_id) do nothing;
