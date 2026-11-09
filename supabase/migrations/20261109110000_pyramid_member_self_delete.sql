-- Members can leave a Forderungspyramide without destroying the historic
-- matches that remain relevant to their opponents. The entry becomes a
-- tombstone for challenge history, while its live ranking position is freed.
alter table public.pyramid_entries
  add column if not exists withdrawn_at timestamptz;

alter table public.pyramid_entries
  alter column position drop not null;
alter table public.pyramid_entries
  drop constraint if exists pyramid_entries_position_check;
alter table public.pyramid_entries
  add constraint pyramid_entries_position_check
  check (position is null or position > 0);
alter table public.pyramid_entries
  add constraint pyramid_entries_withdrawn_position_check
  check (
    (withdrawn_at is null and position is not null)
    or (withdrawn_at is not null and position is null)
  );

create index if not exists pyramid_entries_active_ladder_position_idx
  on public.pyramid_entries(ladder_id,position)
  where withdrawn_at is null;

comment on column public.pyramid_entries.withdrawn_at is
  'Set when a member deletes their Forderungspyramide account. Historic challenge references remain intact.';

-- Only active members count as ladder members. Managers retain their existing
-- access. This helper is private because it bypasses entry RLS.
create or replace function private.can_view_pyramid(p_ladder_id uuid) returns boolean
 language sql stable security definer set search_path = '' as $$
 select private.is_super_admin() or exists (
   select 1 from public.pyramid_entries e
   where e.ladder_id=p_ladder_id
     and e.user_id=(select auth.uid())
     and e.withdrawn_at is null
 );
$$;
revoke all on function private.can_view_pyramid(uuid) from public,anon;
grant execute on function private.can_view_pyramid(uuid) to authenticated;

drop policy if exists pyramid_entries_read on public.pyramid_entries;
create policy pyramid_entries_read on public.pyramid_entries
 for select to authenticated
 using (
   private.can_manage_pyramid()
   or private.can_view_pyramid(ladder_id)
   or user_id=(select auth.uid())
 );

-- A former member must no longer regain challenge access through their
-- retained history row. The active opponent can still see the historic match.
drop policy if exists pyramid_challenges_read on public.pyramid_challenges;
create policy pyramid_challenges_read on public.pyramid_challenges
 for select to authenticated
 using (
   private.can_manage_pyramid()
   or exists (
     select 1 from public.pyramid_entries own_entry
      where own_entry.ladder_id=pyramid_challenges.ladder_id
        and own_entry.user_id=(select auth.uid())
        and own_entry.withdrawn_at is null
        and own_entry.id in (pyramid_challenges.challenger_id,pyramid_challenges.defender_id)
   )
 );

create or replace function public.pyramid_delete_my_account(p_ladder uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid:=auth.uid();
  own_entry public.pyramid_entries%rowtype;
begin
  if uid is null then
    raise exception 'Anmeldung erforderlich' using errcode='42501';
  end if;
  if p_ladder is null then raise exception 'Rangliste fehlt'; end if;

  -- Serialize all position changes in this ladder and lock only the caller's
  -- active membership. A caller can never delete another member by ID.
  perform 1 from public.pyramid_ladders where id=p_ladder for update;
  select * into own_entry
    from public.pyramid_entries
   where ladder_id=p_ladder and user_id=uid and withdrawn_at is null
   for update;
  if not found then
    raise exception 'Kein aktives Forderungspyramidenkonto gefunden' using errcode='P0002';
  end if;

  set constraints pyramid_entries_unique_position deferred;

  -- Unfinished encounters cannot remain actionable after one participant has
  -- left. Completed/forfeit results are deliberately untouched.
  update public.pyramid_challenges
     set status='cancelled',resolved_at=coalesce(resolved_at,now())
   where (challenger_id=own_entry.id or defender_id=own_entry.id)
     and status in ('pending','accepted','result_pending','result_disputed');

  update public.pyramid_entries
     set withdrawn_at=now(),position=null,neutralized_at=null,
         neutralized_reason=null
   where id=own_entry.id;

  update public.pyramid_entries
     set position=position-1
   where ladder_id=p_ladder
     and withdrawn_at is null
     and position>own_entry.position;

  delete from public.pyramid_requests
   where ladder_id=p_ladder and user_id=uid;
end;
$$;
revoke all on function public.pyramid_delete_my_account(uuid) from public,anon;
grant execute on function public.pyramid_delete_my_account(uuid) to authenticated;

-- Defense in depth: no RPC, including future ones, may create a new challenge
-- involving a withdrawn entry.
create or replace function private.pyramid_require_active_challenge_participants()
 returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.pyramid_entries e
     where e.id in (new.challenger_id,new.defender_id)
       and e.withdrawn_at is not null
  ) then
    raise exception 'Gelöschte Forderungspyramidenkonten können nicht gefordert werden';
  end if;
  return new;
end;
$$;
revoke all on function private.pyramid_require_active_challenge_participants()
 from public,anon,authenticated;
drop trigger if exists pyramid_challenge_active_participants on public.pyramid_challenges;
create trigger pyramid_challenge_active_participants
 before insert or update of challenger_id,defender_id on public.pyramid_challenges
 for each row execute function private.pyramid_require_active_challenge_participants();

create or replace function public.pyramid_finalize_seed(p_ladder uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare l public.pyramid_ladders%rowtype;
begin
 if not private.can_manage_pyramid() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 select * into strict l from public.pyramid_ladders where id=p_ladder for update;
 if l.seeded_at is not null then raise exception 'Startaufstellung ist bereits abgeschlossen'; end if;
 if (select count(*) from public.pyramid_entries where ladder_id=p_ladder and withdrawn_at is null)<2 then
   raise exception 'Für eine Startaufstellung werden mindestens zwei Teilnehmer benötigt';
 end if;
 if exists(select 1 from public.pyramid_challenges where ladder_id=p_ladder and status in ('pending','accepted')) then
   raise exception 'Bei offenen Forderungen kann nicht abgeschlossen werden';
 end if;
 update public.pyramid_entries set provisional=false
  where ladder_id=p_ladder and withdrawn_at is null;
 update public.pyramid_ladders set seeded_at=now() where id=p_ladder;
end;
$$;
revoke all on function public.pyramid_finalize_seed(uuid) from public,anon;
grant execute on function public.pyramid_finalize_seed(uuid) to authenticated;

-- Keep the anonymous board free of withdrawn members.
create or replace function public.pyramid_public_standings()
returns table(
 ladder_id uuid, ladder_title text, season_label text, starts_on date,
 ends_on date, seeded boolean, "position" integer, display_name text
) language sql stable security definer set search_path='' as $$
 select l.id,l.title,l.season_label,l.starts_on,l.ends_on,
        (l.seeded_at is not null),e.position,e.display_name
 from public.pyramid_ladders l
 left join public.pyramid_entries e
   on e.ladder_id=l.id and e.qualified and e.withdrawn_at is null
 where l.active
 order by l.starts_on desc,l.title,e.position
$$;
revoke all on function public.pyramid_public_standings() from public;
grant execute on function public.pyramid_public_standings() to anon,authenticated;

-- Portrait lists are likewise limited to the active roster.
create or replace function public.pyramid_member_avatars(p_ladder uuid)
 returns table(user_id uuid,avatar_path text)
 language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or p_ladder is null
   or not private.can_view_pyramid(p_ladder) then
   raise exception 'Keine Berechtigung für die Ranglistenbilder' using errcode='42501';
 end if;
 return query select e.user_id,p.avatar_path
  from public.pyramid_entries e
  join public.profiles p on p.id=e.user_id
  where e.ladder_id=p_ladder and e.withdrawn_at is null
    and p.avatar_path is not null
    and p.avatar_path ~ ('^users/'||e.user_id::text||'/avatar-[A-Za-z0-9._-]+[.]webp$');
end;
$$;
revoke all on function public.pyramid_member_avatars(uuid) from public,anon;
grant execute on function public.pyramid_member_avatars(uuid) to authenticated;
