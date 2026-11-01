-- TSV Feldkirchen: optionale Damen/Herren-Vereinsmeisterschaften.
-- E-Mail-Bestätigung darf bestehende Rückmeldungen niemals überschreiben.
alter table public.event_rsvps
  add column if not exists women_registrations jsonb not null default '[]'::jsonb,
  add column if not exists men_registrations jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='event_rsvps_women_array') then
    alter table public.event_rsvps add constraint event_rsvps_women_array
      check (jsonb_typeof(women_registrations)='array');
  end if;
  if not exists(select 1 from pg_constraint where conname='event_rsvps_men_array') then
    alter table public.event_rsvps add constraint event_rsvps_men_array
      check (jsonb_typeof(men_registrations)='array');
  end if;
end $$;

create or replace function public.confirm_event_rsvp_email(p_request_id uuid, p_token_hash text)
returns boolean
language plpgsql security definer set search_path = ''
as $body$
declare
  pending_record public.event_rsvp_pending%rowtype;
  v_payload jsonb;
  v_attendance text;
  v_adults integer;
  v_children integer;
  v_inserted integer;
begin
  select * into pending_record from public.event_rsvp_pending p
  where p.id=p_request_id and p.token_hash=p_token_hash
    and p.expires_at>now()
    and exists (
      select 1 from public.events e
      where e.id=p.event_id and e.status='published'
        and e.rsvp_enabled and e.starts_at>now()
        and (e.rsvp_deadline is null or e.rsvp_deadline>=now())
    )
  for update;
  if not found then return false; end if;
  v_payload := pending_record.payload;
  v_attendance := v_payload->>'attendance';
  v_adults := (v_payload->>'adults')::integer;
  v_children := (v_payload->>'children')::integer;

  -- Eine schon erfasste E-Mail-Adresse bleibt unverändert.
  -- ON CONFLICT DO NOTHING ist atomar, auch bei gleichzeitig geöffneten Links.
  insert into public.event_rsvps (
    event_id,edit_key,member_name,member_email,verified_at,
    attendance,party_size,adults_count,children_count,
    dessert_contribution,salad_contribution,help_setup,help_cleanup,
    youth_registrations,women_registrations,men_registrations
  ) values (
    pending_record.event_id,gen_random_uuid(),
    v_payload->>'name',pending_record.member_email,now(),
    v_attendance,v_adults+v_children,v_adults,v_children,
    coalesce(v_payload->>'dessert',''),coalesce(v_payload->>'salad',''),
    coalesce((v_payload->>'help_setup')::boolean,false),
    coalesce((v_payload->>'help_cleanup')::boolean,false),
    coalesce(v_payload->'youth','[]'::jsonb),
    coalesce(v_payload->'women','[]'::jsonb),
    coalesce(v_payload->'men','[]'::jsonb)
  )
  on conflict(event_id,member_email) do nothing;
  get diagnostics v_inserted = row_count;
  delete from public.event_rsvp_pending where id=pending_record.id;
  if v_inserted=0 then return false; end if;
  return true;
end;
$body$;
revoke all on function public.confirm_event_rsvp_email(uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_event_rsvp_email(uuid,text) to service_role;