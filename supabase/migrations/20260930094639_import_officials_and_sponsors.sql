insert into public.officials (name,title,email,phone,photo_path,sort_order,published)
values
  ('Stefan Hargasser','Abteilungsleiter · Sportwart','shargasser@gmx.de',null,'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/dummy_ueberuns.png',10,true),
  ('Simon Körber','2. Abteilungsleiter · Internet-/EDV Verantwortlicher · Pressewart','simon.koerber@t-online.de',null,'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/dummy_ueberuns.png',20,true),
  ('Michael Fauth','2. Sportwart · Vergnügungswart','michaelfauth@gmx.de',null,'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/dummy_ueberuns.png',30,true),
  ('Stephan Roth','Schatzmeister','stephan.roth@web.de',null,'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/dummy_ueberuns.png',40,true),
  ('Manfred Hargasser','Schriftführer','manfred.hargasser@postbank.de',null,'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/dummy_ueberuns.png',50,true),
  ('Felix Kellerer','Schiedsrichter Obmann','felix.kellerer@gmx.de',null,'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/dummy_ueberuns.png',60,true),
  ('Felix Fauth','Jugendwart','fejavalix@aol.com',null,'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/dummy_ueberuns.png',70,true),
  ('Sonja Gerberding','2. Jugendwartin','sonja.ann@web.de',null,'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/dummy_ueberuns.png',80,true)
on conflict do nothing;

insert into public.sponsors (name,url,logo_path,description,active,sort_order)
values
  ('Allgeier Engineering','https://www.allgeier-engineering.com','https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/aen.jpg','Unterstützer der Tennisabteilung des TSV Feldkirchen.',true,10),
  ('Hotel Bauer','https://www.hotel-bauer.de','https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/hotelbauer.jpg','Unterstützer der Tennisabteilung des TSV Feldkirchen.',true,20),
  ('HEAD','https://www.head.com/de_DE/','https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/head.png','Unterstützer der Tennisabteilung des TSV Feldkirchen.',true,30),
  ('Keil KTM','https://www.keil-ktm.com/','https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/keil_ktm.png','Unterstützer der Tennisabteilung des TSV Feldkirchen.',true,40),
  ('May Landschaftsbau','https://www.may-landschaftsbau.de/de','https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/landschaftsbau_may.png','Unterstützer der Tennisabteilung des TSV Feldkirchen.',true,50),
  ('Munich Premium Gin','https://www.munichpremiumgin.de/','https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/munig.png','Unterstützer der Tennisabteilung des TSV Feldkirchen.',true,60),
  ('OMV','https://www.omv.de','https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/omv.png','Unterstützer der Tennisabteilung des TSV Feldkirchen.',true,70),
  ('Zehmerbräu','https://www.xn--zehmerbru-22a.de','https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/zehemerbraeu.png','Unterstützer der Tennisabteilung des TSV Feldkirchen.',true,80),
  ('Smartwerk.art','https://www.smartwerk.art','https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/smartwerk_logo.webp','Unterstützer der Tennisabteilung des TSV Feldkirchen.',true,90)
on conflict do nothing;

insert into public.sponsor_placements (sponsor_id,placement,active)
select s.id,'home',true
from public.sponsors s
where not exists (
  select 1 from public.sponsor_placements sp
  where sp.sponsor_id=s.id and sp.placement='home' and sp.team_id is null and sp.match_id is null
);

insert into public.pages (slug,title,body,meta_title,meta_description,published)
values (
  'unterstuetzer',
  'Unterstützer',
  'Ein herzliches Dankeschön an unsere Sponsoren und Unterstützer, die unsere Tennisabteilung tatkräftig fördern. Durch ihr Engagement können wir den Spielbetrieb, die Jugendarbeit und das Vereinsleben beim TSV Feldkirchen bei München aktiv gestalten und weiterentwickeln.',
  'Unterstützer | TSV Feldkirchen Tennis',
  'Sponsoren und Unterstützer der Tennisabteilung des TSV Feldkirchen.',
  true
)
on conflict (slug) do update
set title=excluded.title,body=excluded.body,meta_title=excluded.meta_title,meta_description=excluded.meta_description,published=true,updated_at=now();
