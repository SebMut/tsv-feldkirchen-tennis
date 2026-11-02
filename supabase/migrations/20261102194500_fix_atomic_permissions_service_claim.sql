-- SECURITY DEFINER changes current_user to the function owner. Authenticate the signed service JWT instead.
create or replace function public.admin_apply_user_permissions(
  target_user uuid, desired_role text, desired_permissions text[], desired_memberships jsonb
) returns void language plpgsql security definer set search_path = '' as $$
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
