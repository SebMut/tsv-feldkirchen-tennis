-- TSV Feldkirchen Tennis: member portraits and four-week vacation neutrality.
-- Depends on 20261108200000 and 20261108201500; preserve all existing teams/media policies.
-- Reuse public.profiles.avatar_path, Supabase Storage media, and private.can_write_media_path.
-- Relative paths only. Portraits belong to users/<current auth.uid()>/avatar-*.webp.
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
 if parts[1]='users' then
   return auth.uid() is not null
     and array_length(parts,1)=2
     and parts[2]=auth.uid()::text
     and storage.filename(object_name) ~ '^avatar-[A-Za-z0-9._-]+[.]webp$';
 end if;
 if parts[1] = 'teams' and parts[2] is not null then
   begin team_uuid := parts[2]::uuid;
   exception when invalid_text_representation then return false; end;
   if 'news' = any(parts) then return private.has_global_permission('news'); end if;
   return private.can_edit_team(team_uuid);
 end if;
 if parts[1] = 'matches' and parts[2] is not null then
   begin match_uuid := parts[2]::uuid;
   exception when invalid_text_representation then return false; end;
   select ts.team_id into match_team from public.matches m
     join public.team_seasons ts on ts.id=m.team_season_id
     where m.id=match_uuid;
   return match_team is not null and private.can_edit_team(match_team);
 end if;
 if parts[1] = 'events' and parts[2] is not null then
   begin object_uuid := parts[2]::uuid;
   exception when invalid_text_representation then return false; end;
   return private.has_global_permission('events')
     and exists(select 1 from public.events e where e.id=object_uuid);
 end if;
 if parts[1] = 'news' and parts[2] is not null then
   begin object_uuid := parts[2]::uuid;
   exception when invalid_text_representation then return false; end;
   return private.has_global_permission('news')
     and exists(select 1 from public.news n where n.id=object_uuid);
 end if;
 return false;
end;
$$;

-- Narrow helper for storing ONLY one's own avatar reference in the existing
-- profile row. This cannot update roles, global rights or any other profile.
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
     select 1 from storage.objects where bucket_id='media' and name=p_path
   ) then
     raise exception 'Profilbild wurde nicht im Medienspeicher gefunden';
   end if;
 end if;
 update public.profiles set avatar_path=p_path,updated_at=now() where id=uid;
 if not found then raise exception 'Mitgliedsprofil nicht gefunden'; end if;
end;
$$;
revoke all on function public.pyramid_set_my_avatar(text) from public,anon;
grant execute on function public.pyramid_set_my_avatar(text) to authenticated;

-- The generic profiles RLS policy intentionally does NOT expose all member
-- profiles. Return only avatar paths for members who can view THIS ladder.
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
  where e.ladder_id=p_ladder and p.avatar_path is not null
    and p.avatar_path ~ ('^users/'||e.user_id::text||'/avatar-[A-Za-z0-9._-]+[.]webp$');
end;
$$;
revoke all on function public.pyramid_member_avatars(uuid) from public,anon;
grant execute on function public.pyramid_member_avatars(uuid) to authenticated;

-- Vacancy/vacation gets the same 28-day ladder demotion as injury. Members may
-- reactivate themselves at any point; no demotion is applied before 28 days.
-- Keep the existing cron job; widen the existing function instead of adding
-- a second job that might shift a participant twice.
create or replace function private.pyramid_process_injury_neutrality()
 returns integer language plpgsql security definer set search_path = '' as $$
declare l record; e record; target integer; last_pos integer; steps integer:=0;
begin
 for l in select distinct ladder_id from public.pyramid_entries
  where neutralized_reason in ('injury','vacation') and neutralized_at is not null loop
  perform 1 from public.pyramid_ladders where id=l.ladder_id for update;
  for e in select id,position,neutralized_at,neutral_shift_count from public.pyramid_entries
   where ladder_id=l.ladder_id
     and neutralized_reason in ('injury','vacation') and neutralized_at is not null
   order by position,id for update loop
   if now()<e.neutralized_at+((e.neutral_shift_count+1)*interval '28 days') then continue; end if;
   select max(position) into last_pos from public.pyramid_entries
     where ladder_id=l.ladder_id and qualified;
   if last_pos is null then continue; end if;
   -- First 28 days: move to the end of the current row; after every further
   -- 28-day interval: move to the end of the next row until the last position.
   select greatest(e.position,least(last_pos,
    ((private.pyramid_row(e.position)+1+
      case when e.neutral_shift_count=0 then 0 else 1 end)
     *(private.pyramid_row(e.position)+2+
      case when e.neutral_shift_count=0 then 0 else 1 end))/2)) into target;
   if target>e.position then
     update public.pyramid_entries
       set position=case when id=e.id then target else position-1 end
       where ladder_id=l.ladder_id and position between e.position and target;
   end if;
   update public.pyramid_entries set neutral_shift_count=e.neutral_shift_count+1,
     neutral_shifted_at=now() where id=e.id;
   steps:=steps+1;
  end loop;
 end loop;
 return steps;
end;
$$;
revoke all on function private.pyramid_process_injury_neutrality() from public,anon,authenticated;

-- Never share member images to anonymous clients. Existing private ladder
-- membership logic remains the source of truth.
