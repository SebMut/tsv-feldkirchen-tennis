-- Superadmins may correct the playable period of an existing ladder. The
-- authorization check lives inside the RPC so regular pyramid managers cannot
-- bypass the Superadmin-only UI through the Data API.
create or replace function public.pyramid_update_ladder_dates(
  p_ladder uuid,
  p_starts_on date,
  p_ends_on date
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'Nur Superadmins dürfen den Saisonzeitraum ändern' using errcode='42501';
  end if;
  if p_ladder is null or p_starts_on is null or p_ends_on is null then
    raise exception 'Rangliste, Startdatum und Enddatum sind erforderlich';
  end if;
  if p_ends_on < p_starts_on then
    raise exception 'Das Enddatum muss am oder nach dem Startdatum liegen';
  end if;

  update public.pyramid_ladders
     set starts_on=p_starts_on,ends_on=p_ends_on
   where id=p_ladder;
  if not found then
    raise exception 'Rangliste nicht gefunden' using errcode='P0002';
  end if;
end;
$$;

revoke all on function public.pyramid_update_ladder_dates(uuid,date,date) from public,anon;
grant execute on function public.pyramid_update_ladder_dates(uuid,date,date) to authenticated;
