-- Superadmin-Auswertung der tatsächlich geöffneten News-/Event-Detailtexte.
-- Die Ereignisschlüssel enthalten nur bereits öffentliche Content-IDs, keine Nutzerdaten.
create or replace function public.admin_site_analytics_content(p_days integer default 30)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare result jsonb;
begin
  if not (select private.is_super_admin()) then
    raise exception 'Keine Berechtigung für Website-Statistiken' using errcode='42501';
  end if;
  if p_days not in (7,30,90,365) then
    raise exception 'Ungültiger Zeitraum' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.views desc),'[]'::jsonb)
    into result
  from (
    select a.target_key as id,
      case when a.target_key like 'news:%' then 'News' else 'Veranstaltung' end as kind,
      coalesce(n.title,e.title,'Nicht mehr verfügbar') as title,
      sum(a.hits)::bigint as views
    from public.site_analytics_hourly a
    left join public.news n on a.target_key like 'news:%'
      and n.id::text=substring(a.target_key from 6)
    left join public.events e on a.target_key like 'event:%'
      and e.id::text=substring(a.target_key from 7)
    where a.hour_bucket >= now()-make_interval(days=>p_days)
      and a.event_type='content_click'
      and a.target_key ~ '^(news|event):[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    group by a.target_key,n.title,e.title
    order by views desc limit 15
  ) x;
  return result;
end;
$$;
revoke all on function public.admin_site_analytics_content(integer) from public, anon, authenticated;
grant execute on function public.admin_site_analytics_content(integer) to authenticated;
