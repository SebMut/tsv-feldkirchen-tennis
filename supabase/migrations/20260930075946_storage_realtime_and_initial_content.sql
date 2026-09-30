-- Applied migration: storage_realtime_and_initial_content
-- Project: eaurnufdochjapfzqwvm

create or replace function private.can_write_media_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[];
  target_team uuid;
begin
  if private.is_super_admin() then return true; end if;
  parts := storage.foldername(object_name);
  if coalesce(parts[1], '') <> 'teams' or parts[2] is null then return false; end if;
  begin target_team := parts[2]::uuid;
  exception when invalid_text_representation then return false;
  end;
  return private.can_edit_team(target_team);
end;
$$;
revoke all on function private.can_write_media_path(text) from public;
grant execute on function private.can_write_media_path(text) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('media','media',true,8388608,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy "media_authenticated_read" on storage.objects for select to authenticated using (bucket_id='media');
create policy "media_authenticated_insert" on storage.objects for insert to authenticated with check (bucket_id='media' and private.can_write_media_path(name));
create policy "media_authenticated_update" on storage.objects for update to authenticated using (bucket_id='media' and private.can_write_media_path(name)) with check (bucket_id='media' and private.can_write_media_path(name));
create policy "media_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id='media' and private.can_write_media_path(name));

create policy "public_can_receive_match_broadcasts"
on realtime.messages for select to anon,authenticated
using (realtime.messages.extension='broadcast' and (select realtime.topic()) like 'match:%:ticker');

create or replace function private.broadcast_match_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare target_match uuid;
begin
  target_match := coalesce(new.match_id,old.match_id);
  perform realtime.broadcast_changes(
    'match:'||target_match::text||':ticker',
    tg_op,tg_op,tg_table_name,tg_table_schema,new,old
  );
  return null;
end;
$$;
revoke all on function private.broadcast_match_change() from public;

create trigger broadcast_live_state_changes
after insert or update or delete on public.match_live_state
for each row execute function private.broadcast_match_change();

create trigger broadcast_ticker_entry_changes
after insert or update or delete on public.live_ticker_entries
for each row execute function private.broadcast_match_change();

insert into public.seasons(name,year,starts_on,ends_on,is_current)
values('Saison 2026',2026,'2026-01-01','2026-12-31',true)
on conflict(year) do update set
  name=excluded.name,starts_on=excluded.starts_on,ends_on=excluded.ends_on,is_current=excluded.is_current;

insert into public.team_categories(slug,name,sort_order) values
('herren','Herren',10),('damen','Damen',20),('jugend','Jugend',30)
on conflict(slug) do update set name=excluded.name,sort_order=excluded.sort_order;

insert into public.teams(slug,name,short_name,category_id,gender,age_group,sort_order)
select v.slug,v.name,v.short_name,c.id,v.gender,v.age_group,v.sort_order
from (values
('herren','Herren','1. Mannschaft','herren','men',null::text,10),
('herren-ii','Herren II','2. Mannschaft','herren','men',null::text,20),
('herren-iii','Herren III','3. Mannschaft','herren','men',null::text,30),
('herren-40','Herren 40','Herren 40','herren','men','40',40),
('herren-40-ii','Herren 40 II','Herren 40 II','herren','men','40',50),
('herren-50','Herren 50','Herren 50','herren','men','50',60),
('herren-50-ii','Herren 50 II','Herren 50 II','herren','men','50',70),
('damen','Damen','Damen','damen','women',null::text,110),
('damen-30','Damen 30','Damen 30','damen','women','30',120),
('damen-40','Damen 40','Damen 40','damen','women','40',130),
('damen-50','Damen 50','Damen 50','damen','women','50',140),
('junioren-18','Junioren 18','Junioren 18','jugend','youth','U18',210),
('junioren-18-ii','Junioren 18 II','Junioren 18 II','jugend','youth','U18',220),
('knaben-15','Knaben 15','Knaben 15','jugend','youth','U15',230),
('knaben-15-ii','Knaben 15 II','Knaben 15 II','jugend','youth','U15',240),
('maedchen-15','Mädchen 15','Mädchen 15','jugend','youth','U15',250),
('bambini-12','Bambini 12','Bambini 12','jugend','youth','U12',260),
('bambini-12-ii','Bambini 12 II','Bambini 12 II','jugend','youth','U12',270),
('bambini-12-iii','Bambini 12 III','Bambini 12 III','jugend','youth','U12',280),
('kleinfeld-u9','Kleinfeld U9','U9','jugend','youth','U9',290)
) as v(slug,name,short_name,category_slug,gender,age_group,sort_order)
join public.team_categories c on c.slug=v.category_slug
on conflict(slug) do update set
  name=excluded.name,short_name=excluded.short_name,category_id=excluded.category_id,
  gender=excluded.gender,age_group=excluded.age_group,sort_order=excluded.sort_order;

insert into public.team_seasons(team_id,season_id,league,group_name,btv_url,is_published)
select t.id,s.id,v.league,v.group_name,v.btv_url,true
from (values
('herren','Landesliga 2','Gr. 021 SU','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2165579'),
('herren-ii','Südliga 2','Gr. 023','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2154741'),
('herren-iii','Südliga 3','Gr. 055','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2154762'),
('herren-40','Landesliga 1','Gr. 039 SU','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2165602'),
('herren-40-ii','Südliga 2','Gr. 315','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2160998'),
('herren-50','Südliga 2','Gr. 369','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2155074'),
('herren-50-ii','Südliga 4 (4er)','Gr. 396','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2155116'),
('damen','Südliga 5 (4er)','Gr. 240','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2154955'),
('damen-30','Südliga 1','Gr. 424','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2159626'),
('damen-40','Landesliga 1','Gr. 095 SU','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2165644'),
('damen-50','Südliga 1 (4er)','Gr. 476','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2155190'),
('junioren-18','Südliga 1','Gr. 493','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2155193'),
('junioren-18-ii','Südliga 3','Gr. 514','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2155235'),
('knaben-15','Südliga 2','Gr. 565','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2180638'),
('knaben-15-ii','Südliga 5','Gr. 646','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2155363'),
('maedchen-15','Südliga 3','Gr. 730','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2155462'),
('bambini-12','Südliga 5','Gr. 849','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2155567'),
('bambini-12-ii','Südliga 5','Gr. 852','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2155581'),
('bambini-12-iii','Südliga 5','Gr. 850','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2180636'),
('kleinfeld-u9','Südliga 2','Gr. 965','https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2162214')
) as v(team_slug,league,group_name,btv_url)
join public.teams t on t.slug=v.team_slug
join public.seasons s on s.year=2026
on conflict(team_id,season_id) do update set
  league=excluded.league,group_name=excluded.group_name,btv_url=excluded.btv_url,is_published=excluded.is_published;

insert into public.site_settings(key,value,is_public) values
('club_name','"TSV Feldkirchen Tennis"'::jsonb,true),
('address','{"street":"Olympiastrasse 1","postal_code":"85622","city":"Feldkirchen","country":"Deutschland"}'::jsonb,true),
('phone','"+49 (0) 89 903 64 60"'::jsonb,true),
('email','"tennis@tsvfeldkirchen.de"'::jsonb,true),
('member_count','329'::jsonb,true),
('team_count','20'::jsonb,true),
('court_count','8'::jsonb,true),
('courtbooking_url','"https://tsvfeldkirchen.courtbooking.de/"'::jsonb,true),
('tennis_school_url','"https://www.tennisschule-alexbraun.de/"'::jsonb,true),
('social_links','{}'::jsonb,true)
on conflict(key) do update set value=excluded.value,is_public=excluded.is_public,updated_at=now();

insert into public.facility_status(id,status,message)
values(true,'open','Anlagenstatus wird vom Verein gepflegt.')
on conflict(id) do nothing;

insert into public.courts(name,sort_order)
select 'Platz '||n::text,n from generate_series(1,8) n
on conflict(name) do update set sort_order=excluded.sort_order;

insert into public.pages(slug,title,body,meta_title,meta_description,published) values
('mitglied-werden','Mitglied werden',
 E'Die Mitgliedschaft in der Tennisabteilung setzt eine Mitgliedschaft im Hauptverein voraus.\n\nHauptverein:\nErwachsene: 50,00 € pro Jahr\nKinder und Jugendliche bis 18 Jahre: 20,00 € pro Jahr\n\nTennisabteilung:\nErwachsene Erstzahler: 190,00 € pro Jahr\nErwachsene Zweitzahler: 140,00 € pro Jahr\nStudenten/Auszubildende ab 18 Jahren: 120,00 € pro Jahr\nJugendliche bis 18 Jahre: 90,00 € pro Jahr\nKinder bis 14 Jahre: 65,00 € pro Jahr',
 'Mitglied werden | TSV Feldkirchen Tennis','Informationen zu Mitgliedschaft und Beiträgen der Tennisabteilung des TSV Feldkirchen.',true),
('training','Training',
 E'Das Training wird gemeinsam mit der Tennisschule Alex Braun organisiert. Aktuelle Trainingsangebote und Anmeldung sind über die Tennisschule erreichbar.',
 'Training | TSV Feldkirchen Tennis','Training und Tennisschule beim TSV Feldkirchen Tennis.',true),
('kontakt','Kontakt',
 E'Abteilung Tennis\nOlympiastrasse 1\n85622 Feldkirchen\n\nTelefon: +49 (0) 89 903 64 60\nE-Mail: tennis@tsvfeldkirchen.de',
 'Kontakt | TSV Feldkirchen Tennis','Kontakt zur Tennisabteilung des TSV Feldkirchen.',true),
('impressum','Impressum',
 E'Das rechtliche Impressum wird vom Hauptverein bereitgestellt. Die neue Website verlinkt auf die aktuelle Impressumsseite des TSV Feldkirchen.',
 'Impressum | TSV Feldkirchen Tennis','Impressum der Tennisabteilung des TSV Feldkirchen.',true),
('datenschutz','Datenschutz',
 E'Die Datenschutzerklärung wird vom Hauptverein bereitgestellt. Die neue Website verlinkt auf die aktuelle Datenschutzerklärung des TSV Feldkirchen.',
 'Datenschutz | TSV Feldkirchen Tennis','Datenschutzinformationen der Tennisabteilung des TSV Feldkirchen.',true)
on conflict(slug) do update set
  title=excluded.title,body=excluded.body,meta_title=excluded.meta_title,
  meta_description=excluded.meta_description,published=excluded.published,updated_at=now();
