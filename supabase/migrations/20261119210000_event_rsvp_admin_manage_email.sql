-- TSV Feldkirchen Tennis: Admin-Änderungen an bestätigten Anmeldungen mit verlässlicher Mail-Warteschlange.
-- Bestehende RSVP/RLS-Struktur bleibt bestehen. Keine öffentlichen Schreibrechte.
create table if not exists public.event_rsvp_admin_notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  rsvp_id uuid not null,
  editor_user_id uuid not null,
  recipient_email text not null,
  action text not null check (action in ('update','delete')),
  before_data jsonb not null,
  after_data jsonb,
  mail_status text not null default 'pending' check (mail_status in ('pending','sending','sent','failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists event_rsvp_admin_notifications_event_idx
  on public.event_rsvp_admin_notifications (event_id, created_at desc);
alter table public.event_rsvp_admin_notifications enable row level security;
revoke all on table public.event_rsvp_admin_notifications from public, anon, authenticated;
grant select, insert, update, delete on public.event_rsvp_admin_notifications to service_role;

-- Nur die bereits vorhandene event-rsvp-email-Edge-Function darf mit Service-Rolle
-- atomar ändern/löschen und einen noch zu versendenden Hinweis speichern.
create or replace function public.admin_change_event_rsvp(
  p_rsvp_id uuid,
  p_expected_updated_at timestamptz,
  p_action text,
  p_values jsonb,
  p_editor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $body$
declare
  old_row public.event_rsvps%rowtype;
  new_row public.event_rsvps%rowtype;
  before_json jsonb;
  after_json jsonb;
  notice_id uuid;
  adults integer;
  children integer;
  attendance text;
  name text;
begin
  if p_rsvp_id is null or p_expected_updated_at is null or p_editor_user_id is null
     or p_action not in ('update','delete') then
    raise exception 'RSVP_INVALID';
  end if;
  select * into old_row from public.event_rsvps r
    where r.id = p_rsvp_id and r.verified_at is not null for update;
  if not found then raise exception 'RSVP_NOT_FOUND'; end if;
  if old_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'RSVP_CONFLICT';
  end if;

  before_json := to_jsonb(old_row) - 'id' - 'event_id' - 'edit_key'
    - 'member_email' - 'verified_at' - 'created_at' - 'updated_at';

  if p_action = 'update' then
    name := btrim(coalesce(p_values->>'member_name',''));
    attendance := p_values->>'attendance';
    if p_values is null
       or jsonb_typeof(p_values->'adults_count') <> 'number'
       or jsonb_typeof(p_values->'children_count') <> 'number'
       or jsonb_typeof(p_values->'help_setup') <> 'boolean'
       or jsonb_typeof(p_values->'help_cleanup') <> 'boolean'
       or jsonb_typeof(p_values->'youth_registrations') <> 'array'
       or jsonb_typeof(p_values->'women_registrations') <> 'array'
       or jsonb_typeof(p_values->'men_registrations') <> 'array'
       or char_length(name) not between 2 and 100
       or attendance not in ('yes','maybe','no')
       or char_length(coalesce(p_values->>'dessert_contribution','')) > 180
       or char_length(coalesce(p_values->>'salad_contribution','')) > 180
       or jsonb_array_length(p_values->'youth_registrations') > 12
       or jsonb_array_length(p_values->'women_registrations') > 12
       or jsonb_array_length(p_values->'men_registrations') > 12 then
      raise exception 'RSVP_INVALID';
    end if;
    adults := (p_values->>'adults_count')::integer;
    children := (p_values->>'children_count')::integer;
    if adults < 0 or children < 0 or adults + children > 20
       or (attendance = 'yes' and adults+children < 1)
       or (attendance <> 'yes' and adults+children <> 0)
       or (attendance <> 'yes' and (
         p_values->>'dessert_contribution' <> '' or p_values->>'salad_contribution' <> ''
         or (p_values->>'help_setup')::boolean or (p_values->>'help_cleanup')::boolean
         or jsonb_array_length(p_values->'youth_registrations') > 0
         or jsonb_array_length(p_values->'women_registrations') > 0
         or jsonb_array_length(p_values->'men_registrations') > 0
       )) then raise exception 'RSVP_INVALID'; end if;

    after_json := jsonb_build_object(
      'member_name', name, 'attendance', attendance,
      'adults_count', adults, 'children_count', children, 'party_size', adults+children,
      'dessert_contribution', coalesce(p_values->>'dessert_contribution',''),
      'salad_contribution', coalesce(p_values->>'salad_contribution',''),
      'help_setup', (p_values->>'help_setup')::boolean,
      'help_cleanup', (p_values->>'help_cleanup')::boolean,
      'youth_registrations', p_values->'youth_registrations',
      'women_registrations', p_values->'women_registrations',
      'men_registrations', p_values->'men_registrations'
    );
    if before_json = after_json then
      return jsonb_build_object('unchanged', true);
    end if;
    update public.event_rsvps set
      member_name = name, attendance = attendance, party_size = adults+children,
      adults_count = adults, children_count = children,
      dessert_contribution = after_json->>'dessert_contribution',
      salad_contribution = after_json->>'salad_contribution',
      help_setup = (after_json->>'help_setup')::boolean,
      help_cleanup = (after_json->>'help_cleanup')::boolean,
      youth_registrations = after_json->'youth_registrations',
      women_registrations = after_json->'women_registrations',
      men_registrations = after_json->'men_registrations',
      updated_at = clock_timestamp()
    where id = old_row.id returning * into new_row;
  else
    after_json := null;
    delete from public.event_rsvps where id = old_row.id;
  end if;
  insert into public.event_rsvp_admin_notifications (
    event_id,rsvp_id,editor_user_id,recipient_email,action,before_data,after_data
  ) values (
    old_row.event_id,old_row.id,p_editor_user_id,old_row.member_email,
    p_action,before_json,after_json
  ) returning id into notice_id;
  return jsonb_build_object('notification_id',notice_id,'event_id',old_row.event_id);
end;
$body$;
revoke all on function public.admin_change_event_rsvp(uuid,timestamptz,text,jsonb,uuid)
  from public,anon,authenticated;
grant execute on function public.admin_change_event_rsvp(uuid,timestamptz,text,jsonb,uuid) to service_role;