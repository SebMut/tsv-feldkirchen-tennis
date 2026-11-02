-- Winter 2026/27: routing address for the sole fixture missing one.
-- BC Attaching club address verified against public club profile / BFV:
-- https://www.bfv.de/vereine/bc-attaching/00ES8GND7400000AVV0AG08LVUPGND5I
-- IMPORTANT: This is the club address, not independently confirmed indoor hall entrance.
-- Leave the original BTV venue name and official home/away designation intact.
update public.matches as m
   set venue_address = 'Am Sportplatz 3, 85356 Freising-Attaching',
       notes = concat_ws(E'\n',nullif(m.notes,''),
         '[Routing] Vereinsadresse BC Attaching; die genaue Tennishalle und den Halleneingang vor der Fahrt bitte beim Gastgeber prüfen.')
where m.id='901e1a1a-6730-4d47-9e03-2f663187ff35'::uuid
  and m.venue_name='BC Attaching'
  and m.opponent='TC Rot-Weiß Freising'
  and m.is_home=false
  and nullif(btrim(m.venue_address),'') is null
  and exists (
    select 1 from public.team_seasons ts join public.seasons s on s.id=ts.season_id
    where ts.id=m.team_season_id and s.code='winter-2026-2027'
  );
