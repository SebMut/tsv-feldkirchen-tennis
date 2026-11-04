-- Fix invitation flow: auth.users trigger creates a profile before admin-users
-- writes the intended global permissions. Direct service-role API updates previously
-- reached private.is_super_admin(), while service_role intentionally has no USAGE on
-- the private schema. The email was already sent, but profile update returned HTTP 500.
-- Do not grant service_role broad access to the private schema.
create or replace function private.guard_global_permissions_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.global_permissions is not distinct from old.global_permissions then
    return new;
  end if;

  -- service_role is a protected Postgres role with BYPASSRLS, used only by the
  -- authenticated server-side administration function (never by the browser).
  -- Do not call private.is_super_admin() from service_role: private is not
  -- exposed to that role for direct PostgREST calls.
  if current_user = 'service_role' then
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
