-- Fifteen official BTV Winter 2026/27 fixtures, five for each verified TSV team.
-- Public source: Südbayern Winter group PDFs 2257673, 2257681, 2257828.
-- Preserve all existing summer matches, ticker data, user-added matches, and scores.
do $$
begin
 if (select count(*) from public.team_seasons ts join public.teams t on t.id=ts.team_id
     join public.seasons s on s.id=ts.season_id
     where s.code='winter-2026-2027' and t.slug in ('herren','herren-ii','herren-50')) <> 3
 then raise exception 'Expected exactly the three verified BTV winter team seasons'; end if;
end
$$;

with verified (slug,opponent,is_home,local_start,group_id,result_text) as (
 values
 ('herren','TC Sportpark Deisenhofen II',true,'2026-10-03 16:00',2257673,'6:0'),
 ('herren','ESV München Sportpark',false,'2026-10-24 15:00',2257673,'0:6'),
 ('herren','TV Dürnbach II',true,'2026-11-07 17:00',2257673,null),
 ('herren','SV DJK Taufkirchen',false,'2027-02-13 16:00',2257673,null),
 ('herren','TC Neuhaus',false,'2027-03-06 15:00',2257673,null),
 ('herren-ii','TC Unterföhring II',true,'2026-10-03 17:00',2257681,'0:6'),
 ('herren-ii','TF Markt Schwaben',false,'2026-11-07 16:00',2257681,null),
 ('herren-ii','FC Forstern',false,'2026-11-29 15:00',2257681,null),
 ('herren-ii','TC Aschheim II',false,'2027-01-17 10:00',2257681,null),
 ('herren-ii','TS Jahn München II',true,'2027-02-27 17:00',2257681,null),
 ('herren-50','TC Unterföhring II',false,'2026-10-18 11:00',2257828,'4:1'),
 ('herren-50','TC Rot-Weiß Freising',false,'2026-11-28 10:00',2257828,null),
 ('herren-50','SV Lohhof',false,'2026-12-12 16:00',2257828,null),
 ('herren-50','STC München Süd III',true,'2027-02-13 16:00',2257828,null),
 ('herren-50','TC Ismaning',true,'2027-03-20 16:00',2257828,null)
),
resolved as (
 select ts.id as team_season_id,v.opponent,v.is_home,
   timezone('Europe/Berlin',v.local_start::timestamp) as starts_at,
   'https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid='||v.group_id as external_url,
   v.result_text
 from verified v
 join public.teams t on t.slug=v.slug
 join public.team_seasons ts on ts.team_id=t.id
 join public.seasons s on s.id=ts.season_id and s.code='winter-2026-2027'
)
insert into public.matches
 (team_season_id,opponent,is_home,starts_at,external_url,match_type,
  lineup_format,is_published,btv_imported,btv_result_text)
select team_season_id,opponent,is_home,starts_at,external_url,
  'league','4_2',true,true,result_text
from resolved
on conflict (team_season_id,starts_at,opponent) do nothing;
