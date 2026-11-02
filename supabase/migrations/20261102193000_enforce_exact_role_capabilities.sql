-- Explicit capabilities: only designated global editors may write news or events.
-- Team managers/editors retain team and roster management. Team/global tickers
-- retain only match/ticker actions, never editorial publication or galleries.
drop policy if exists news_insert on public.news;
create policy news_insert on public.news for insert to authenticated
  with check (private.has_global_permission('news'));
drop policy if exists news_update on public.news;
create policy news_update on public.news for update to authenticated
  using (private.has_global_permission('news'))
  with check (private.has_global_permission('news'));
drop policy if exists news_delete on public.news;
create policy news_delete on public.news for delete to authenticated
  using (private.has_global_permission('news'));
drop policy if exists news_authenticated_read on public.news;
create policy news_authenticated_read on public.news for select to authenticated
  using ((status = 'published' and published_at is not null and published_at <= now())
         or private.has_global_permission('news'));

drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (private.has_global_permission('events'));
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (private.has_global_permission('events'))
  with check (private.has_global_permission('events'));
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated
  using (private.has_global_permission('events'));
drop policy if exists events_authenticated_read on public.events;
create policy events_authenticated_read on public.events for select to authenticated
  using (status = 'published' or private.has_global_permission('events'));

-- Gallery management is editorial team management, not a ticker function.
create or replace function private.can_manage_gallery(target_gallery uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_super_admin() or exists (
    select 1 from public.galleries g
    left join public.matches m on m.id = g.match_id
    left join public.team_seasons ts on ts.id = m.team_season_id
    where g.id = target_gallery
      and ((g.team_id is not null and private.can_edit_team(g.team_id))
           or (ts.team_id is not null and private.can_edit_team(ts.team_id)))
  );
$$;
drop policy if exists galleries_insert on public.galleries;
create policy galleries_insert on public.galleries for insert to authenticated
with check (
  private.is_super_admin() or (
    team_id is not null and private.can_edit_team(team_id)
    and (match_id is null or exists (
      select 1 from public.matches m
      join public.team_seasons ts on ts.id = m.team_season_id
      where m.id = match_id and ts.team_id = galleries.team_id
    ))
  )
);

-- Storage authorization must agree with the same underlying RLS rules.
create or replace function private.can_write_media_path(object_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[];
  team_uuid uuid;
  match_uuid uuid;
  object_uuid uuid;
  match_team uuid;
begin
  if private.is_super_admin() then return true; end if;
  if object_name is null or object_name like '%..%' or object_name like '/%' then return false; end if;
  parts := storage.foldername(object_name);
  if parts[1] = 'teams' and parts[2] is not null then
    begin team_uuid := parts[2]::uuid;
    exception when invalid_text_representation then return false; end;
    -- The legacy teams/<team>/news tree must not circumvent global news rights.
    if 'news' = any(parts) then return private.has_global_permission('news'); end if;
    return private.can_edit_team(team_uuid);
  end if;
  if parts[1] = 'matches' and parts[2] is not null then
    begin match_uuid := parts[2]::uuid;
    exception when invalid_text_representation then return false; end;
    select ts.team_id into match_team from public.matches m
      join public.team_seasons ts on ts.id = m.team_season_id
      where m.id = match_uuid;
    return match_team is not null and private.can_edit_team(match_team);
  end if;
  if parts[1] = 'events' and parts[2] is not null then
    begin object_uuid := parts[2]::uuid;
    exception when invalid_text_representation then return false; end;
    return private.has_global_permission('events')
      and exists (select 1 from public.events e where e.id = object_uuid);
  end if;
  if parts[1] = 'news' and parts[2] is not null then
    begin object_uuid := parts[2]::uuid;
    exception when invalid_text_representation then return false; end;
    return private.has_global_permission('news')
      and exists (select 1 from public.news n where n.id = object_uuid);
  end if;
  return false;
end;
$$;
revoke all on function private.can_write_media_path(text) from public;
grant execute on function private.can_write_media_path(text) to authenticated;

-- Complete, atomic update for a user's permissions and team memberships.
-- Only the Edge Function using its service-role client may call this RPC.
create or replace function public.admin_apply_user_permissions(
  target_user uuid, desired_role text, desired_permissions text[], desired_memberships jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  current_role text;
  membership_count integer;
begin
  if current_user <> 'service_role' then
    raise exception 'Only the administrative service may manage user roles' using errcode='42501';
  end if;
  if desired_role not in ('user','super_admin')
    or desired_permissions is null
    or not (desired_permissions <@ array['news','events','ticker']::text[])
    or array_position(desired_permissions,null) is not null
    or desired_memberships is null
    or jsonb_typeof(desired_memberships) <> 'array' then
    raise exception 'Invalid permissions payload';
  end if;
  select global_role into current_role from public.profiles
    where id=target_user for update;
  if not found then raise exception 'User profile not found'; end if;
  if current_role='super_admin' and desired_role<>'super_admin'
     and (select count(*) from public.profiles where global_role='super_admin') <= 1 then
    raise exception 'The last SuperAdmin cannot be demoted';
  end if;
  if desired_role='super_admin' and (jsonb_array_length(desired_memberships)<>0 or cardinality(desired_permissions)<>0) then
    raise exception 'SuperAdmin must not have additional scoped assignments';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(desired_memberships) as x(team_id uuid, role text)
    where x.team_id is null or x.role is null
      or x.role not in ('manager','editor','ticker')
      or not exists(select 1 from public.teams t where t.id=x.team_id)
  ) then raise exception 'Invalid team assignment'; end if;
  select count(*) into membership_count from jsonb_to_recordset(desired_memberships)
    as x(team_id uuid,role text);
  if membership_count <> (
    select count(distinct x.team_id) from jsonb_to_recordset(desired_memberships)
      as x(team_id uuid,role text)
  ) then raise exception 'Duplicate team assignments'; end if;

  update public.profiles set global_role=desired_role,
    global_permissions=desired_permissions where id=target_user;
  delete from public.team_memberships where user_id=target_user;
  if desired_role='user' then
    insert into public.team_memberships(user_id,team_id,role,active)
    select target_user,x.team_id,x.role,true
    from jsonb_to_recordset(desired_memberships) as x(team_id uuid,role text);
  end if;
end;
$$;
revoke all on function public.admin_apply_user_permissions(uuid,text,text[],jsonb)
  from public,anon,authenticated;
grant execute on function public.admin_apply_user_permissions(uuid,text,text[],jsonb)
  to service_role;
