-- Preview-safe facility status and first verified migrated content.
-- Applied to Supabase project eaurnufdochjapfzqwvm as version 20260930094226.

alter table public.facility_status drop constraint if exists facility_status_status_check;
alter table public.facility_status
  add constraint facility_status_status_check
  check (status = any (array['unknown'::text,'open'::text,'limited'::text,'closed'::text]));

alter table public.courts drop constraint if exists courts_status_check;
alter table public.courts
  add constraint courts_status_check
  check (status = any (array['unknown'::text,'open'::text,'limited'::text,'closed'::text]));

insert into public.facility_status (id, status, message)
values (true, 'unknown', 'Der aktuelle Anlagenstatus wird vor dem Spielbetrieb durch den Verein gepflegt.')
on conflict (id) do update
set status = excluded.status,
    message = excluded.message,
    updated_at = now();

insert into public.courts (name, sort_order, status, status_message, active)
select 'Platz ' || n, n, 'unknown', 'Status wird vom Verein gepflegt.', true
from generate_series(1, 8) as n
on conflict (name) do update
set sort_order = excluded.sort_order,
    active = true,
    updated_at = now();

insert into public.site_settings (key, value, is_public)
values
  ('impressum_url', to_jsonb('https://tsvfeldkirchen.de/impressum'::text), true),
  ('privacy_url', to_jsonb('https://tsvfeldkirchen.de/datenschutz-dsgvo'::text), true)
on conflict (key) do update
set value = excluded.value,
    is_public = excluded.is_public,
    updated_at = now();

insert into public.events (
  slug, title, description, category, starts_at, ends_at, all_day,
  location_name, address, status, external_url
)
values (
  'schnuppertag-2026',
  'Schnuppertag',
  'Schnuppertag der Tennisabteilung. Anmeldung über die Tennisschule Alex Braun.',
  'training',
  '2026-04-12 10:00:00 Europe/Berlin',
  '2026-04-12 17:00:00 Europe/Berlin',
  false,
  'TSV Feldkirchen Tennis',
  'Olympiastrasse 1, 85622 Feldkirchen',
  'published',
  'https://www.tennisschule-alexbraun.de/'
)
on conflict (slug) do update
set title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    location_name = excluded.location_name,
    address = excluded.address,
    status = excluded.status,
    external_url = excluded.external_url,
    updated_at = now();

insert into public.news (
  slug, title, excerpt, body, status, published_at
)
values (
  'schnuppertag-2026',
  'Schnuppertag',
  'Schnuppertag am 12. April 2026 von 10:00 bis 17:00 Uhr.',
  'Am 12. April 2026 findet von 10:00 bis 17:00 Uhr der Schnuppertag der Tennisabteilung statt. Die Anmeldung erfolgt über die Tennisschule Alex Braun.',
  'published',
  '2026-03-30 12:00:00 Europe/Berlin'
)
on conflict (slug) do update
set title = excluded.title,
    excerpt = excluded.excerpt,
    body = excluded.body,
    status = excluded.status,
    published_at = excluded.published_at,
    updated_at = now();
