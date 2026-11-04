-- The atomic permission RPC is SECURITY DEFINER, so current_user is its
-- owner rather than service_role. Keep the verified JWT service role path as
-- well as direct service_role PostgREST updates. Neither grants new access to
-- private schema or changes a normal authenticated user's permissions.
create or replace function private.guard_global_permissions_update()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if new.global_permissions is not distinct from old.global_permissions then
    return new;
  end if;

  if current_user = 'service_role'
    or coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return new;
  end if;

  if not private.is_super_admin() then
    raise exception 'Globale Berechtigungen dürfen nur SuperAdmins vergeben.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

revoke all on function private.guard_global_permissions_update() from public, anon, authenticated;
