-- Preserve stable membership IDs and creation dates when administrators edit roles.
-- Unchanged memberships are not deleted/reinserted; revoked teams are removed.
CREATE OR REPLACE FUNCTION public.admin_apply_user_permissions(target_user uuid, desired_role text, desired_permissions text[], desired_memberships jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_role text;
  membership_count integer;
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' then
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
  -- Keep unchanged memberships (and their IDs/timestamps). Delete only revoked teams.
  delete from public.team_memberships tm
    where tm.user_id=target_user
      and (desired_role <> 'user' or not exists(
        select 1 from jsonb_to_recordset(desired_memberships)
          as x(team_id uuid,role text) where x.team_id=tm.team_id
      ));
  if desired_role='user' then
    insert into public.team_memberships as tm(user_id,team_id,role,active)
    select target_user,x.team_id,x.role,true
    from jsonb_to_recordset(desired_memberships) as x(team_id uuid,role text)
    on conflict (user_id,team_id) do update
      set role=excluded.role,active=true
      where tm.role is distinct from excluded.role or not tm.active;
  end if;
end;
$function$

