-- Central media storage authorization for all website uploads.
-- Applied to Supabase project eaurnufdochjapfzqwvm.

create or replace function private.can_write_media_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select
    public.is_super_admin()
    or (
      split_part(object_name, '/', 1) = 'teams'
      and nullif(split_part(object_name, '/', 2), '') is not null
      and public.can_edit_team(split_part(object_name, '/', 2)::uuid)
    )
    or (
      split_part(object_name, '/', 1) = 'matches'
      and exists (
        select 1
        from public.matches m
        join public.team_seasons ts on ts.id = m.team_season_id
        where m.id = split_part(object_name, '/', 2)::uuid
          and (public.can_edit_team(ts.team_id) or public.can_tick_team(ts.team_id))
      )
    )
    or (
      split_part(object_name, '/', 1) = 'events'
      and exists (
        select 1 from public.events e
        where e.id = split_part(object_name, '/', 2)::uuid
          and e.team_id is not null
          and public.can_edit_team(e.team_id)
      )
    )
    or (
      split_part(object_name, '/', 1) = 'news'
      and exists (
        select 1 from public.news n
        where n.id = split_part(object_name, '/', 2)::uuid
          and n.team_id is not null
          and public.can_edit_team(n.team_id)
      )
    );
$$;

revoke all on function private.can_write_media_path(text) from public;
grant execute on function private.can_write_media_path(text) to authenticated;

drop policy if exists media_authenticated_insert on storage.objects;
drop policy if exists media_authenticated_update on storage.objects;
drop policy if exists media_authenticated_delete on storage.objects;

create policy media_authenticated_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'media' and private.can_write_media_path(name));

create policy media_authenticated_update
on storage.objects for update
to authenticated
using (bucket_id = 'media' and private.can_write_media_path(name))
with check (bucket_id = 'media' and private.can_write_media_path(name));

create policy media_authenticated_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'media' and private.can_write_media_path(name));

update storage.buckets
set public = true,
    file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif']
where id = 'media';
