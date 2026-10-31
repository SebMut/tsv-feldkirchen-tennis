-- The BTV group PDFs state the actual winter tennis hall for each fixture.
-- Season 2026/27 only. Home/away remains exclusively matches.is_home.
-- Never derive the hall from club home/away or assume Feldkirchen has a hall.
-- Address is deliberately omitted where the actual hall entrance is unverified.
do $$
begin
 if (select count(*) from public.matches m
   join public.team_seasons ts on ts.id=m.team_season_id
   join public.seasons s on s.id=ts.season_id
   where s.code='winter-2026-2027') <> 15
 then raise exception 'Expected exactly 15 verified Winter 2026/27 fixtures'; end if;
end $$;

with halls(slug,opponent,local_date,hall,address) as (
 values
 ('herren','TC Sportpark Deisenhofen II','2026-10-03','Tennishalle Riemerling',null),
 ('herren','ESV München Sportpark','2026-10-24','TS Jahn München',null),
 ('herren','TV Dürnbach II','2026-11-07','TSV Haar','Höglweg 7, 85540 Haar'),
 ('herren','SV DJK Taufkirchen','2027-02-13','SV-DJK Taufkirchen – Tennishalle','Birkenstraße 169, 82024 Taufkirchen'),
 ('herren','TC Neuhaus','2027-03-06','TC Neuhaus','Aurachstraße 30, 83727 Schliersee'),
 ('herren-ii','TC Unterföhring II','2026-10-03','TSV Haar','Höglweg 7, 85540 Haar'),
 ('herren-ii','TF Markt Schwaben','2026-11-07','Tennispark Anzing','Parkstraße 63, 85646 Anzing'),
 ('herren-ii','FC Forstern','2026-11-29','Tennispark Anzing','Parkstraße 63, 85646 Anzing'),
 ('herren-ii','TC Aschheim II','2027-01-17','TC Aschheim – Tennishalle','Am Sportpark 1, 85609 Aschheim'),
 ('herren-ii','TS Jahn München II','2027-02-27','TSV Haar','Höglweg 7, 85540 Haar'),
 ('herren-50','TC Unterföhring II','2026-10-18','SV Haimhausen – Tennishalle','Unterer Bründlweg 1, 85778 Haimhausen'),
 ('herren-50','TC Rot-Weiß Freising','2026-11-28','BC Attaching',null),
 ('herren-50','SV Lohhof','2026-12-12','SV Lohhof – Tennishalle','Hartmut-Hermann-Weg 1, 85716 Unterschleißheim'),
 ('herren-50','STC München Süd III','2027-02-13','Sporttraum Kirchheim','Hürderstraße 2a, 85551 Kirchheim bei München'),
 ('herren-50','TC Ismaning','2027-03-20','Sporttraum Kirchheim','Hürderstraße 2a, 85551 Kirchheim bei München')
)
update public.matches m
set venue_name=coalesce(nullif(btrim(m.venue_name),''),h.hall),
    venue_address=coalesce(nullif(btrim(m.venue_address),''),h.address)
from halls h, public.teams t, public.team_seasons ts, public.seasons s
where t.slug=h.slug and ts.team_id=t.id and s.id=ts.season_id
  and s.code='winter-2026-2027' and m.team_season_id=ts.id
  and m.opponent=h.opponent
  and (m.starts_at at time zone 'Europe/Berlin')::date=h.local_date::date
  and (nullif(btrim(m.venue_name),'') is null or
       (h.address is not null and nullif(btrim(m.venue_address),'') is null));
