-- Erweiterung der 2024er Papier-Vorlage für Sommerfest und Jugendvereinsmeisterschaften.
-- Die historischen Angaben werden NICHT als neue Einladung veröffentlicht.
alter table public.events
  add column if not exists rsvp_deadline timestamptz,
  add column if not exists rsvp_details jsonb not null default '{}'::jsonb;

alter table public.event_rsvps
  add column if not exists adults_count integer not null default 0,
  add column if not exists children_count integer not null default 0,
  add column if not exists dessert_contribution text not null default '',
  add column if not exists salad_contribution text not null default '',
  add column if not exists help_setup boolean not null default false,
  add column if not exists help_cleanup boolean not null default false,
  add column if not exists youth_registrations jsonb not null default '[]'::jsonb;

-- Vorhandene Zusagen bleiben gültig und werden der Erwachsenen-Zahl zugeordnet.
update public.event_rsvps
set adults_count = party_size, children_count = 0
where attendance = 'yes' and adults_count + children_count = 0;

alter table public.event_rsvps
  add constraint event_rsvps_group_counts
    check (
      adults_count between 0 and 20
      and children_count between 0 and 20
      and adults_count + children_count <= 20
      and party_size = adults_count + children_count
    ),
  add constraint event_rsvps_contribution_lengths
    check (char_length(dessert_contribution) <= 180 and char_length(salad_contribution) <= 180),
  add constraint event_rsvps_youth_list
    check (jsonb_typeof(youth_registrations) = 'array' and jsonb_array_length(youth_registrations) <= 12);

-- Die alte RPC-Version ohne zusätzliche Antwortfelder nicht weiter öffentlich anbieten.
revoke execute on function public.submit_event_rsvp(uuid,uuid,text,text,integer) from anon, authenticated, public;
drop function public.submit_event_rsvp(uuid,uuid,text,text,integer);

create function public.submit_event_rsvp(
  p_event_id uuid, p_edit_key uuid, p_member_name text, p_attendance text,
  p_adults integer, p_children integer, p_dessert text, p_salad text,
  p_help_setup boolean, p_help_cleanup boolean, p_youth jsonb
) returns text
language plpgsql security definer
set search_path = ''
as $body$
declare
  v_name text := btrim(coalesce(p_member_name,''));
  v_dessert text := btrim(coalesce(p_dessert,''));
  v_salad text := btrim(coalesce(p_salad,''));
  v_youth jsonb := coalesce(p_youth, '[]'::jsonb);
  v_group integer := coalesce(p_adults,0) + coalesce(p_children,0);
begin
  if p_event_id is null or p_edit_key is null
    or char_length(v_name) not between 2 and 100
    or p_attendance is null or p_attendance not in ('yes','no','maybe')
    or p_adults is null or p_children is null
    or p_adults not between 0 and 20 or p_children not between 0 and 20
    or v_group > 20
    or (p_attendance='yes' and v_group < 1)
    or (p_attendance<>'yes' and v_group <> 0)
    or char_length(v_dessert)>180 or char_length(v_salad)>180
    or jsonb_typeof(v_youth) <> 'array' then
    raise exception 'Ungültige Rückmeldung.';
  end if;
  if jsonb_array_length(v_youth) > 12 or exists (
    select 1 from jsonb_array_elements(v_youth) as participant
    where jsonb_typeof(participant) <> 'object'
      or coalesce(participant->>'category','') not in
        ('u10-mixed','u12-m','u15-m','u18-m','u18-w')
      or char_length(btrim(coalesce(participant->>'name',''))) not between 2 and 100
  ) then
    raise exception 'Bitte gültige Jugend-Teilnehmer und Altersklassen angeben.';
  end if;
  if not exists (
    select 1 from public.events e
    where e.id=p_event_id and e.status='published'
      and e.rsvp_enabled=true and e.starts_at > now()
      and (e.rsvp_deadline is null or e.rsvp_deadline >= now())
  ) then
    raise exception 'Für diese Veranstaltung ist die Anmeldung nicht geöffnet.';
  end if;
  insert into public.event_rsvps (
    event_id,edit_key,member_name,attendance,party_size,
    adults_count,children_count,dessert_contribution,salad_contribution,
    help_setup,help_cleanup,youth_registrations
  ) values (
    p_event_id,p_edit_key,v_name,p_attendance,v_group,
    p_adults,p_children,v_dessert,v_salad,
    coalesce(p_help_setup,false),coalesce(p_help_cleanup,false),v_youth
  )
  on conflict (event_id,edit_key) do update set
    member_name=excluded.member_name,attendance=excluded.attendance,
    party_size=excluded.party_size,adults_count=excluded.adults_count,
    children_count=excluded.children_count,
    dessert_contribution=excluded.dessert_contribution,
    salad_contribution=excluded.salad_contribution,
    help_setup=excluded.help_setup,help_cleanup=excluded.help_cleanup,
    youth_registrations=excluded.youth_registrations,updated_at=now();
  return 'saved';
end;
$body$;
revoke all on function public.submit_event_rsvp(uuid,uuid,text,text,integer,integer,text,text,boolean,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.submit_event_rsvp(uuid,uuid,text,text,integer,integer,text,text,boolean,boolean,jsonb) to anon, authenticated;

create or replace function public.event_rsvp_summary(p_event_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $body$
declare v_summary jsonb;
begin
  if not exists (select 1 from public.events
    where id=p_event_id and status='published' and rsvp_enabled=true) then
    raise exception 'Veranstaltung nicht verfügbar.';
  end if;
  select jsonb_build_object(
    'yes',count(*) filter (where attendance='yes'),
    'no',count(*) filter (where attendance='no'),
    'maybe',count(*) filter (where attendance='maybe'),
    'persons',coalesce(sum(party_size) filter (where attendance='yes'),0),
    'adults',coalesce(sum(adults_count) filter (where attendance='yes'),0),
    'children',coalesce(sum(children_count) filter (where attendance='yes'),0)
  ) into v_summary from public.event_rsvps where event_id=p_event_id;
  return v_summary;
end;
$body$;
revoke all on function public.event_rsvp_summary(uuid) from public, anon, authenticated;
grant execute on function public.event_rsvp_summary(uuid) to anon, authenticated;
