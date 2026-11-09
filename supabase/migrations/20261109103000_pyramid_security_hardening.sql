-- Security hardening after a complete Forderungspyramide RPC/RLS audit.

-- Members need the roster to render the pyramid, but challenge details contain
-- private dates, refusal reasons and disputes. Only participants in the specific
-- challenge (or authorized pyramid managers) may read those rows.
drop policy if exists pyramid_challenges_read on public.pyramid_challenges;
create policy pyramid_challenges_read on public.pyramid_challenges
 for select to authenticated
 using (
   private.can_manage_pyramid()
   or exists (
     select 1 from public.pyramid_entries own_entry
      where own_entry.ladder_id=pyramid_challenges.ladder_id
        and own_entry.user_id=(select auth.uid())
        and own_entry.id in (pyramid_challenges.challenger_id,pyramid_challenges.defender_id)
   )
 );

-- Trigger functions and geometry helpers are internal implementation details.
-- They must not remain directly executable by API roles.
revoke all on function private.pyramid_queue_change_notice() from public,anon,authenticated;
revoke all on function private.pyramid_row(integer) from public,anon,authenticated;

-- This legacy manager wrapper is unused by the clients. The guarded manager RPC
-- remains available, while the unnecessary extra API endpoint is removed.
revoke all on function public.pyramid_record_no_show(uuid) from public,anon,authenticated;

-- Fail closed if an authenticated account somehow has no profile row. Without
-- this check the one-time LK marker could not be written and the declaration
-- could be repeated indefinitely.
create or replace function public.pyramid_declare_my_lk(p_lk numeric)
 returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Anmeldung erforderlich' using errcode='42501'; end if;
 if p_lk is null or p_lk<1.0 or p_lk>25.0 then
   raise exception 'LK-Wert muss zwischen 1.0 und 25.0 liegen';
 end if;
 perform 1 from public.profiles where id=uid for update;
 if not found then raise exception 'Mitgliedsprofil nicht gefunden' using errcode='42501'; end if;
 if exists(select 1 from public.profiles where id=uid and tennis_lk_declared_at is not null) then
   raise exception 'Die einmalige LK-Angabe wurde bereits gespeichert. Änderungen sind nur durch den Superadmin möglich';
 end if;
 update public.profiles set tennis_lk_rating=p_lk,tennis_lk_declared_at=now() where id=uid;
 update public.pyramid_entries set lk_rating=p_lk where user_id=uid;
end;
$$;
revoke all on function public.pyramid_declare_my_lk(numeric) from public,anon;
grant execute on function public.pyramid_declare_my_lk(numeric) to authenticated;

-- A syntactically matching path is insufficient: the selected storage object
-- must also be owned by the signed-in user.
create or replace function public.pyramid_set_my_avatar(p_path text)
 returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Anmeldung erforderlich' using errcode='42501'; end if;
 if p_path is not null then
   if char_length(p_path)>480 or not (
     p_path ~ ('^users/'||uid::text||'/avatar-[A-Za-z0-9._-]+[.]webp$')
   ) then
     raise exception 'Ungültiger Pfad zum eigenen Profilbild' using errcode='42501';
   end if;
   if not exists(
     select 1 from storage.objects
      where bucket_id='media' and name=p_path
        and (owner_id=uid::text or owner=uid)
   ) then
     raise exception 'Profilbild gehört nicht zum angemeldeten Mitglied' using errcode='42501';
   end if;
 end if;
 update public.profiles set avatar_path=p_path,updated_at=now() where id=uid;
 if not found then raise exception 'Mitgliedsprofil nicht gefunden'; end if;
end;
$$;
revoke all on function public.pyramid_set_my_avatar(text) from public,anon;
grant execute on function public.pyramid_set_my_avatar(text) to authenticated;
