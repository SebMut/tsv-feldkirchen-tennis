-- Read-only operational integrity diagnostic for the existing Supabase project.
-- Only the authenticated admin-users Edge Function's service-role client may call it.
create or replace function public.admin_system_integrity()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  missing_count integer := 0;
  missing_examples jsonb := '[]'::jsonb;
  job_status jsonb := '[]'::jsonb;
  failures_24h integer := 0;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Only the administrative service may inspect system integrity'
      using errcode='42501';
  end if;

  with media_refs as (
    select 'events'::text as source, hero_image_path as path from public.events where hero_image_path is not null
    union all select 'news', hero_image_path from public.news where hero_image_path is not null
    union all select 'teams', image_path from public.teams where image_path is not null
    union all select 'team_seasons', team_image_path from public.team_seasons where team_image_path is not null
    union all select 'gallery_items', storage_path from public.gallery_items where storage_path is not null
    union all select 'sponsors', logo_path from public.sponsors where logo_path is not null
    union all select 'officials', photo_path from public.officials where photo_path is not null
    union all select 'profiles', avatar_path from public.profiles where avatar_path is not null
  ), missing as (
    select r.source,r.path from media_refs r
    left join storage.objects o on o.bucket_id='media' and o.name=r.path
    where r.path <> '' and r.path not like 'http%' and o.id is null
  )
  select (select count(*)::integer from missing),
    coalesce((select jsonb_agg(jsonb_build_object('source',m.source,'path',m.path))
      from (select source,path from missing order by source,path limit 20) m),'[]'::jsonb)
  into missing_count,missing_examples;

  select coalesce(jsonb_agg(jsonb_build_object('name',jobname,'active',active,
    'last_status',last_status,'last_run',last_run) order by jobname),'[]'::jsonb)
  into job_status
  from (
    select j.jobname,j.active,run.status as last_status,run.start_time as last_run
    from cron.job j
    left join lateral (
      select r.status,r.start_time from cron.job_run_details r
      where r.jobid=j.jobid order by r.start_time desc limit 1
    ) run on true
    where j.jobname like 'tsv-%'
  ) checks;

  select count(*)::integer into failures_24h
  from cron.job_run_details r
  join cron.job j on j.jobid=r.jobid
  where j.jobname like 'tsv-%'
    and r.start_time >= now()-interval '24 hours'
    and r.status not in ('succeeded','running');

  return jsonb_build_object('checked_at',now(),'missing_media_count',missing_count,
    'missing_media_examples',missing_examples,'cron_jobs',job_status,
    'cron_failures_24h',failures_24h);
end;
$$;
revoke all on function public.admin_system_integrity() from public,anon,authenticated;
grant execute on function public.admin_system_integrity() to service_role;
