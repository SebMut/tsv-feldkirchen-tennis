-- Hallenfinder-Aufrufe in die datensparsame Website-Statistik aufnehmen.
create or replace function public.track_site_analytics(
  p_event text, p_path text, p_device text, p_source text,
  p_match text default '', p_target text default ''
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_match text := '';
begin
  if p_event is null or p_event not in
     ('page_view','ticker_view','nav_click','action_click','calendar_click','route_click','content_click')
     or p_device is null or p_device not in ('mobile','tablet','desktop')
     or p_source is null or p_source not in ('direct','internal','search','social','external')
     or p_path is null
     or not (
       p_path = any(array['/','/spieltag/','/spieltag/live-ticker/','/live/','/aktuelles/',
         '/termine/','/mannschaften/','/sponsoren/','/training/','/mitglied-werden/',
         '/kontakt/','/ueber-uns/','/funktionaere/','/hallenplaetze/','/spiel/','/veranstaltung/',
         '/impressum/','/datenschutz/'])
       or p_path ~ '^/mannschaften/[a-z0-9-]{1,60}/$'
     )
     or coalesce(p_target,'') !~ '^[a-z0-9_:-]{0,48}$'
  then return; end if;
  if p_event = 'ticker_view' and p_path not in ('/spieltag/','/spieltag/live-ticker/','/live/') then return; end if;
  if p_event = 'ticker_view' and p_path = '/live/'
    and coalesce(p_match,'') ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    and exists (select 1 from public.matches where id = p_match::uuid and is_published)
  then v_match := lower(p_match); end if;
  insert into public.site_analytics_hourly
      (hour_bucket,event_type,page_path,device_type,source_type,match_ref,target_key,hits)
  values (date_trunc('hour',now()),p_event,p_path,p_device,p_source,v_match,coalesce(p_target,''),1)
  on conflict (hour_bucket,event_type,page_path,device_type,source_type,match_ref,target_key)
  do update set hits = public.site_analytics_hourly.hits + 1;
end;
$$;

create or replace function public.admin_site_analytics(p_days integer default 30)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare v_since timestamptz; v_prev timestamptz; v_result jsonb;
begin
  if not (select private.is_super_admin()) then
    raise exception 'Keine Berechtigung für Website-Statistiken' using errcode='42501';
  end if;
  if p_days not in (7,30,90,365) then
    raise exception 'Ungültiger Zeitraum' using errcode='22023';
  end if;
  v_since := now() - make_interval(days => p_days);
  v_prev := now() - make_interval(days => p_days * 2);
  select jsonb_build_object(
    'summary', (select jsonb_build_object(
      'page_views',coalesce(sum(hits) filter (where event_type='page_view' and hour_bucket>=v_since),0),
      'previous_page_views',coalesce(sum(hits) filter (where event_type='page_view' and hour_bucket>=v_prev and hour_bucket<v_since),0),
      'hall_finder_views',coalesce(sum(hits) filter (where event_type='page_view' and page_path='/hallenplaetze/' and hour_bucket>=v_since),0),
      'ticker_views',coalesce(sum(hits) filter (where event_type='ticker_view' and hour_bucket>=v_since),0),
      'ticker_detail_views',coalesce(sum(hits) filter (where event_type='ticker_view' and page_path='/live/' and hour_bucket>=v_since),0),
      'tv_views',coalesce(sum(hits) filter (where event_type='ticker_view' and page_path='/spieltag/live-ticker/' and hour_bucket>=v_since),0),
      'interactions',coalesce(sum(hits) filter (where event_type not in ('page_view','ticker_view') and hour_bucket>=v_since),0))
      from public.site_analytics_hourly),
    'daily', (select coalesce(jsonb_agg(to_jsonb(s) order by s.day),'[]'::jsonb) from (
      select (hour_bucket at time zone 'Europe/Berlin')::date as day,
        sum(hits) filter (where event_type='page_view')::bigint as views,
        sum(hits) filter (where event_type='ticker_view')::bigint as ticker
      from public.site_analytics_hourly where hour_bucket >= v_since group by 1 order by 1
    ) s),
    'pages', (select coalesce(jsonb_agg(to_jsonb(s) order by s.views desc),'[]'::jsonb) from (
      select page_path as path,sum(hits)::bigint as views from public.site_analytics_hourly
      where hour_bucket >= v_since and event_type='page_view' group by page_path order by views desc limit 18
    ) s),
    'actions', (select coalesce(jsonb_agg(to_jsonb(s) order by s.views desc),'[]'::jsonb) from (
      select event_type as event,target_key as target,sum(hits)::bigint as views
      from public.site_analytics_hourly where hour_bucket >= v_since and event_type not in ('page_view','ticker_view')
      group by event_type,target_key order by views desc limit 18
    ) s),
    'hall_venues', (select coalesce(jsonb_agg(to_jsonb(s) order by s.views desc),'[]'::jsonb) from (
      select split_part(target_key,':',2) as target,sum(hits)::bigint as views
      from public.site_analytics_hourly
      where hour_bucket >= v_since and event_type='action_click' and page_path='/hallenplaetze/'
        and target_key = any(array['halle:aschheim','halle:ismaning','halle:sporttraum','halle:haar','halle:kirchheim'])
      group by target_key order by views desc
    ) s),
    'devices', (select coalesce(jsonb_agg(to_jsonb(s) order by s.views desc),'[]'::jsonb) from (
      select device_type as name,sum(hits)::bigint as views from public.site_analytics_hourly
      where hour_bucket >= v_since and event_type='page_view' group by device_type order by views desc
    ) s),
    'sources', (select coalesce(jsonb_agg(to_jsonb(s) order by s.views desc),'[]'::jsonb) from (
      select source_type as name,sum(hits)::bigint as views from public.site_analytics_hourly
      where hour_bucket >= v_since and event_type='page_view' group by source_type order by views desc
    ) s),
    'hours', (select coalesce(jsonb_agg(to_jsonb(s) order by s.hour),'[]'::jsonb) from (
      select extract(hour from hour_bucket at time zone 'Europe/Berlin')::int as hour,sum(hits)::bigint as views
      from public.site_analytics_hourly where hour_bucket >= v_since and event_type='page_view' group by 1 order by 1
    ) s),
    'ticker_matches', (select coalesce(jsonb_agg(to_jsonb(s) order by s.views desc),'[]'::jsonb) from (
      select a.match_ref as id,coalesce(m.opponent,'Begegnung') as opponent,max(m.starts_at) as starts_at,sum(a.hits)::bigint as views
      from public.site_analytics_hourly a left join public.matches m on m.id::text=a.match_ref
      where a.hour_bucket >= v_since and a.event_type='ticker_view' and a.match_ref <> ''
      group by a.match_ref,m.opponent order by views desc limit 12
    ) s),
    'ticker_channels', (select coalesce(jsonb_agg(to_jsonb(s) order by s.views desc),'[]'::jsonb) from (
      select page_path as path,sum(hits)::bigint as views from public.site_analytics_hourly
      where hour_bucket >= v_since and event_type='ticker_view' group by page_path order by views desc
    ) s),
    'started_at', min(hour_bucket)::text
  ) into v_result from public.site_analytics_hourly;
  return v_result;
end;
$$;

revoke all on function public.track_site_analytics(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.track_site_analytics(text,text,text,text,text,text) to anon, authenticated;
revoke all on function public.admin_site_analytics(integer) from public, anon, authenticated;
grant execute on function public.admin_site_analytics(integer) to authenticated;
