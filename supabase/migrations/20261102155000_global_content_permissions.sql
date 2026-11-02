-- Club-wide capabilities are independent of team memberships.
alter table public.profiles
  add column if not exists global_permissions text[] not null default '{}'::text[];

alter table public.profiles
  add constraint profiles_global_permissions_allowed
  check (global_permissions <@ array['events','news','ticker']::text[]
    and array_position(global_permissions, null) is null);

-- A user creating their own profile cannot pre-grant global privileges.
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) and global_role = 'user'
    and global_permissions = '{}'::text[]);

-- Keep existing self-edit capabilities, but prevent elevation through profiles_update_self.
create or replace function private.guard_global_permissions_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.global_permissions is distinct from old.global_permissions
    and coalesce(auth.jwt()->>'role','') <> 'service_role'
    and not private.is_super_admin() then
    raise exception 'Globale Berechtigungen dürfen nur SuperAdmins vergeben.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_global_permissions_update() from public;
drop trigger if exists guard_global_permissions_update on public.profiles;
create trigger guard_global_permissions_update
  before update of global_permissions on public.profiles
  for each row execute function private.guard_global_permissions_update();

create or replace function private.has_global_permission(required_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_super_admin() or coalesce((
    select required_permission = any(p.global_permissions)
    from public.profiles p where p.id = (select auth.uid())
  ),false);
$$;
revoke all on function private.has_global_permission(text) from public;
grant execute on function private.has_global_permission(text) to authenticated;

-- A global ticker may tick any match, but still cannot edit team master data.
create or replace function private.can_tick_team(target_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_super_admin()
    or (target_team is not null and private.has_global_permission('ticker'))
    or exists (
      select 1 from public.team_memberships tm
      where tm.user_id = (select auth.uid())
        and tm.team_id = target_team and tm.active
        and tm.role in ('manager','editor','ticker')
    );
$$;

drop policy if exists matches_authenticated_read on public.matches;
create policy matches_authenticated_read on public.matches
  for select to authenticated
  using (is_published or private.can_edit_team_season(team_season_id)
    or private.can_tick_match(id));

drop policy if exists events_authenticated_read on public.events;
create policy events_authenticated_read on public.events
  for select to authenticated
  using (status = 'published' or private.is_super_admin()
    or private.has_global_permission('events')
    or (team_id is not null and private.can_edit_team(team_id)));
drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert to authenticated
  with check (private.is_super_admin() or private.has_global_permission('events')
    or (team_id is not null and private.can_edit_team(team_id)));
drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update to authenticated
  using (private.is_super_admin() or private.has_global_permission('events')
    or (team_id is not null and private.can_edit_team(team_id)))
  with check (private.is_super_admin() or private.has_global_permission('events')
    or (team_id is not null and private.can_edit_team(team_id)));
drop policy if exists events_delete on public.events;
create policy events_delete on public.events
  for delete to authenticated
  using (private.is_super_admin() or private.has_global_permission('events')
    or (team_id is not null and private.can_edit_team(team_id)));

drop policy if exists news_authenticated_read on public.news;
create policy news_authenticated_read on public.news
  for select to authenticated
  using ((status = 'published' and published_at is not null and published_at <= now())
    or private.is_super_admin() or private.has_global_permission('news')
    or (team_id is not null and private.can_edit_team(team_id)));
drop policy if exists news_insert on public.news;
create policy news_insert on public.news
  for insert to authenticated
  with check (private.is_super_admin() or private.has_global_permission('news')
    or (team_id is not null and private.can_edit_team(team_id)));
drop policy if exists news_update on public.news;
create policy news_update on public.news
  for update to authenticated
  using (private.is_super_admin() or private.has_global_permission('news')
    or (team_id is not null and private.can_edit_team(team_id)))
  with check (private.is_super_admin() or private.has_global_permission('news')
    or (team_id is not null and private.can_edit_team(team_id)));
drop policy if exists news_delete on public.news;
create policy news_delete on public.news
  for delete to authenticated
  using (private.is_super_admin() or private.has_global_permission('news')
    or (team_id is not null and private.can_edit_team(team_id)));

-- Event coordinators can read verified registrations for their event administration.
drop policy if exists event_rsvps_global_events_select on public.event_rsvps;
create policy event_rsvps_global_events_select on public.event_rsvps
  for select to authenticated
  using (private.has_global_permission('events'));

-- The established Storage policies already call this helper.
create or replace function private.can_write_media_path(object_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[];
  target_team uuid;
  target_match uuid;
  target_event uuid;
  target_news uuid;
  resolved_team uuid;
begin
  if private.is_super_admin() then return true; end if;
  parts := storage.foldername(object_name);
  if coalesce(parts[1], '') = 'teams' and parts[2] is not null then
    begin target_team := parts[2]::uuid;
    exception when invalid_text_representation then return false; end;
    return private.can_edit_team(target_team);
  end if;
  if coalesce(parts[1], '') = 'matches' and parts[2] is not null then
    begin target_match := parts[2]::uuid;
    exception when invalid_text_representation then return false; end;
    select ts.team_id into resolved_team
    from public.matches m join public.team_seasons ts on ts.id = m.team_season_id
    where m.id = target_match;
    return resolved_team is not null and private.can_tick_team(resolved_team);
  end if;
  if coalesce(parts[1], '') = 'events' and parts[2] is not null then
    begin target_event := parts[2]::uuid;
    exception when invalid_text_representation then return false; end;
    select e.team_id into resolved_team from public.events e where e.id = target_event;
    if not found then return false; end if;
    return private.has_global_permission('events')
      or (resolved_team is not null and private.can_edit_team(resolved_team));
  end if;
  if coalesce(parts[1], '') = 'news' and parts[2] is not null then
    begin target_news := parts[2]::uuid;
    exception when invalid_text_representation then return false; end;
    select n.team_id into resolved_team from public.news n where n.id = target_news;
    if not found then return false; end if;
    return private.has_global_permission('news')
      or (resolved_team is not null and private.can_edit_team(resolved_team));
  end if;
  return false;
end;
$$;
revoke all on function private.can_write_media_path(text) from public;
grant execute on function private.can_write_media_path(text) to authenticated;