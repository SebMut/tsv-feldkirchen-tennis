-- Set direct, verified BTV group links for the three winter teams.
-- Do not modify individually maintained BTV links or any summer season.
with links (slug,group_id) as (
 values ('herren',2257673),('herren-ii',2257681),('herren-50',2257828)
),
winter as (select id from public.seasons where code='winter-2026-2027')
update public.team_seasons ts
set btv_url='https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid='||links.group_id
from links,public.teams t,winter w
where ts.team_id=t.id and ts.season_id=w.id
  and t.slug=links.slug
  and (ts.btv_url is null or ts.btv_url='https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften');
