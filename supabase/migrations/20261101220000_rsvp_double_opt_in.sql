-- Double opt-in: nur nach Linkbestätigung werden Rückmeldungen gezählt.
-- Ausschließlich Server-Edge-Function (service_role) darf persönliche Daten speichern.
alter table public.event_rsvps
  add column if not exists member_email text,
  add column if not exists verified_at timestamptz;

create unique index if not exists event_rsvps_verified_email_unique
  on public.event_rsvps(event_id, member_email);

create table if not exists public.event_rsvp_pending (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_email text not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists event_rsvp_pending_email_rate on public.event_rsvp_pending(member_email,created_at desc);
create index if not exists event_rsvp_pending_ip_rate on public.event_rsvp_pending(request_fingerprint,created_at desc);
alter table public.event_rsvp_pending enable row level security;
revoke all on public.event_rsvp_pending from public, anon, authenticated;
grant all on public.event_rsvp_pending to service_role;

-- Der alte öffentliche Aufruf würde Cloudflare und E-Mail-Verifizierung umgehen.
revoke all on function public.submit_event_rsvp(uuid,uuid,text,text,integer,integer,text,text,boolean,boolean,jsonb)
  from public, anon, authenticated;
drop function if exists public.submit_event_rsvp(uuid,uuid,text,text,integer,integer,text,text,boolean,boolean,jsonb);

create or replace function public.confirm_event_rsvp_email(p_request_id uuid, p_token_hash text)
returns boolean
language plpgsql security definer
set search_path = ''
as $body$
declare
  pending_record public.event_rsvp_pending%rowtype;
  v_payload jsonb;
  v_attendance text;
  v_adults integer;
  v_children integer;
begin
  select * into pending_record from public.event_rsvp_pending p
  where p.id=p_request_id and p.token_hash=p_token_hash
    and p.expires_at>now()
    and exists(
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

  insert into public.event_rsvps(
    event_id, edit_key, member_name, member_email, verified_at,
    attendance, party_size, adults_count, children_count,
    dessert_contribution, salad_contribution, help_setup, help_cleanup,
    youth_registrations
  ) values (
    pending_record.event_id, gen_random_uuid(),
    v_payload->>'name', pending_record.member_email, now(),
    v_attendance, v_adults+v_children, v_adults, v_children,
    coalesce(v_payload->>'dessert',''), coalesce(v_payload->>'salad',''),
    coalesce((v_payload->>'help_setup')::boolean,false),
    coalesce((v_payload->>'help_cleanup')::boolean,false),
    coalesce(v_payload->'youth','[]'::jsonb)
  )
  on conflict(event_id,member_email) do update set
    member_name=excluded.member_name,
    verified_at=excluded.verified_at,
    attendance=excluded.attendance,
    party_size=excluded.party_size,
    adults_count=excluded.adults_count,
    children_count=excluded.children_count,
    dessert_contribution=excluded.dessert_contribution,
    salad_contribution=excluded.salad_contribution,
    help_setup=excluded.help_setup,
    help_cleanup=excluded.help_cleanup,
    youth_registrations=excluded.youth_registrations,
    updated_at=now();

  delete from public.event_rsvp_pending where id=pending_record.id;
  return true;
end;
$body$;
revoke all on function public.confirm_event_rsvp_email(uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_event_rsvp_email(uuid,text) to service_role;

-- Summen enthalten nur per E-Mail bestätigte Antworten.
create or replace function public.event_rsvp_summary(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $body$
declare v_summary jsonb;
begin
  if not exists (select 1 from public.events
    where id=p_event_id and status='published' and rsvp_enabled=true) then
    raise exception 'Veranstaltung nicht verfügbar.';
  end if;
  select jsonb_build_object(
    'yes',count(*) filter(where attendance='yes'),
    'no',count(*) filter(where attendance='no'),
    'maybe',count(*) filter(where attendance='maybe'),
    'persons',coalesce(sum(party_size) filter(where attendance='yes'),0),
    'adults',coalesce(sum(adults_count) filter(where attendance='yes'),0),
    'children',coalesce(sum(children_count) filter(where attendance='yes'),0)
  ) into v_summary
  from public.event_rsvps
  where event_id=p_event_id and verified_at is not null;
  return v_summary;
end;
$body$;
revoke all on function public.event_rsvp_summary(uuid) from public,anon,authenticated;
grant execute on function public.event_rsvp_summary(uuid) to anon,authenticated;
