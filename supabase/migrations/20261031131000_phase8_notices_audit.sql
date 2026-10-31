-- Phase 8: newsroom/club noticeboard and privacy-conscious admin audit trail.
-- All changes additive. Anon receives read-only access to published notices.
create table if not exists public.club_notices (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 3 and 160),
 message text not null check (length(trim(message)) between 3 and 2500),
 kind text not null default 'info' check (kind in ('info','event','urgent')),
 starts_at timestamptz not null default now(),
 ends_at timestamptz,
 is_published boolean not null default false,
 sort_order integer not null default 0,
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint club_notices_time_order check (ends_at is null or ends_at > starts_at)
);
create index if not exists club_notices_public_idx on public.club_notices(is_published,starts_at,ends_at);
alter table public.club_notices enable row level security;
create policy club_notices_public_read on public.club_notices for select to anon
 using (is_published and starts_at <= now() and (ends_at is null or ends_at >= now()));
create policy club_notices_authenticated_read on public.club_notices for select to authenticated
 using ((is_published and starts_at <= now() and (ends_at is null or ends_at >= now())) or private.is_super_admin());
create policy club_notices_insert_admin on public.club_notices for insert to authenticated with check (private.is_super_admin());
create policy club_notices_update_admin on public.club_notices for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy club_notices_delete_admin on public.club_notices for delete to authenticated using (private.is_super_admin());
revoke all on table public.club_notices from public,anon,authenticated;
grant select on table public.club_notices to anon;
grant select,insert,update,delete on table public.club_notices to authenticated;

create table if not exists public.club_change_log (
 id bigint generated always as identity primary key,
 entity_type text not null,
 entity_id text not null,
 operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
 actor_id uuid,
 changed_fields text[] not null default array[]::text[],
 occurred_at timestamptz not null default now()
);
create index if not exists club_change_log_occurred_idx on public.club_change_log(occurred_at desc);
alter table public.club_change_log enable row level security;
create policy club_change_log_superadmin_read on public.club_change_log for select to authenticated using (private.is_super_admin());
revoke all on table public.club_change_log from public,anon,authenticated;
grant select on table public.club_change_log to authenticated;

create or replace function private.record_club_change()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare
 old_data jsonb := '{}'::jsonb;
 new_data jsonb := '{}'::jsonb;
 keys text[] := array[]::text[];
 record_data jsonb;
 record_id text;
begin
 if TG_OP <> 'INSERT' then old_data := to_jsonb(old); end if;
 if TG_OP <> 'DELETE' then new_data := to_jsonb(new); end if;
 record_data := case when TG_OP = 'DELETE' then old_data else new_data end;
 record_id := coalesce(record_data->>'id',record_data->>'match_id','unbekannt');
 if TG_OP = 'UPDATE' then
   select coalesce(array_agg(key order by key),array[]::text[]) into keys
   from jsonb_object_keys(new_data) as key
   where key = any (array['status','result_text','winner','home_score','away_score','lineup_format',
     'tsv_player_1_id','tsv_player_2_id','opponent_slot_1','opponent_slot_2',
     'is_published','published_at','starts_at','ends_at','title','message','body',
     'hero_image_path','team_id','match_id','deleted_at','status_message'])
     and (old_data->key) is distinct from (new_data->key);
   if array_length(keys,1) is null then return coalesce(new,old); end if;
 end if;
 insert into public.club_change_log(entity_type,entity_id,operation,actor_id,changed_fields)
 values (TG_TABLE_NAME,record_id,TG_OP,auth.uid(),keys);
 return coalesce(new,old);
end;
$fn$;
revoke all on function private.record_club_change() from public,anon,authenticated;
drop trigger if exists log_club_matches on public.matches;
create trigger log_club_matches after insert or update or delete on public.matches for each row execute function private.record_club_change();
drop trigger if exists log_club_encounters on public.match_encounters;
create trigger log_club_encounters after insert or update or delete on public.match_encounters for each row execute function private.record_club_change();
drop trigger if exists log_club_live_state on public.match_live_state;
create trigger log_club_live_state after insert or update or delete on public.match_live_state for each row execute function private.record_club_change();
drop trigger if exists log_club_ticker on public.live_ticker_entries;
create trigger log_club_ticker after insert or update or delete on public.live_ticker_entries for each row execute function private.record_club_change();
drop trigger if exists log_club_events on public.events;
create trigger log_club_events after insert or update or delete on public.events for each row execute function private.record_club_change();
drop trigger if exists log_club_news on public.news;
create trigger log_club_news after insert or update or delete on public.news for each row execute function private.record_club_change();
drop trigger if exists log_club_facility on public.facility_status;
create trigger log_club_facility after insert or update or delete on public.facility_status for each row execute function private.record_club_change();
drop trigger if exists log_club_notices on public.club_notices;
create trigger log_club_notices after insert or update or delete on public.club_notices for each row execute function private.record_club_change();
