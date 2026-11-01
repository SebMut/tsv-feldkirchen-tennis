-- TSV Feldkirchen: freiwillige Veranstaltungs-Rückmeldungen.
-- Nur veröffentlichte, explizit aktivierte Veranstaltungen nehmen Zusagen an.
-- Persönliche Namen und Antworten sind ausschließlich für SuperAdmins lesbar.
alter table public.events
  add column if not exists rsvp_enabled boolean not null default false;

create table if not exists public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  edit_key uuid not null,
  member_name text not null check (char_length(btrim(member_name)) between 2 and 100),
  attendance text not null check (attendance in ('yes','no','maybe')),
  party_size integer not null check (party_size between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_rsvps_attendance_count_check
    check ((attendance = 'yes' and party_size >= 1) or (attendance <> 'yes' and party_size = 0)),
  constraint event_rsvps_unique_response unique (event_id, edit_key)
);
create index if not exists event_rsvps_event_idx on public.event_rsvps (event_id);
alter table public.event_rsvps enable row level security;

revoke all on table public.event_rsvps from anon, authenticated;
grant select on public.event_rsvps to authenticated;
grant all on public.event_rsvps to service_role;

drop policy if exists event_rsvps_super_admin_select on public.event_rsvps;
create policy event_rsvps_super_admin_select on public.event_rsvps
  for select to authenticated using ((select private.is_super_admin()));

-- Öffentlich aufrufbar, aber keine freie Tabellen-Schreibberechtigung.
-- Der 122-Bit-zufällige UUID-Schlüssel dient ausschließlich zum Bearbeiten
-- der eigenen Antwort auf demselben Gerät (keine Mitgliederprüfung).
create or replace function public.submit_event_rsvp(
  p_event_id uuid, p_edit_key uuid, p_member_name text,
  p_attendance text, p_party_size integer
) returns text
language plpgsql security definer
set search_path = ''
as $body$
declare
  v_name text := btrim(coalesce(p_member_name, ''));
begin
  if p_event_id is null or p_edit_key is null
    or char_length(v_name) not between 2 and 100
    or p_attendance is null or p_attendance not in ('yes','no','maybe')
    or p_party_size is null or p_party_size not between 0 and 20
    or (p_attendance = 'yes' and p_party_size < 1)
    or (p_attendance <> 'yes' and p_party_size <> 0) then
    raise exception 'Ungültige Rückmeldung.';
  end if;
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.status = 'published'
      and e.rsvp_enabled = true and e.starts_at > now()
  ) then
    raise exception 'Für diese Veranstaltung ist keine Anmeldung geöffnet.';
  end if;

  insert into public.event_rsvps (event_id, edit_key, member_name, attendance, party_size)
  values (p_event_id, p_edit_key, v_name, p_attendance, p_party_size)
  on conflict (event_id, edit_key) do update set
    member_name = excluded.member_name,
    attendance = excluded.attendance,
    party_size = excluded.party_size,
    updated_at = now();

  return 'saved';
end;
$body$;
revoke all on function public.submit_event_rsvp(uuid,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.submit_event_rsvp(uuid,uuid,text,text,integer) to anon, authenticated;

-- Anonyme Besucher sehen lediglich aggregierte Zahlen, niemals Namen.
create or replace function public.event_rsvp_summary(p_event_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $body$
declare
  v_summary jsonb;
begin
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.status = 'published' and e.rsvp_enabled = true
  ) then
    raise exception 'Veranstaltung nicht verfügbar.';
  end if;

  select jsonb_build_object(
    'yes', count(*) filter (where attendance = 'yes'),
    'no', count(*) filter (where attendance = 'no'),
    'maybe', count(*) filter (where attendance = 'maybe'),
    'persons', coalesce(sum(party_size) filter (where attendance = 'yes'), 0)
  ) into v_summary
  from public.event_rsvps
  where event_id = p_event_id;
  return v_summary;
end;
$body$;
revoke all on function public.event_rsvp_summary(uuid) from public, anon, authenticated;
grant execute on function public.event_rsvp_summary(uuid) to anon, authenticated;
