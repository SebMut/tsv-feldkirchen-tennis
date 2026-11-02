-- Hourly, server-side surveillance of the existing Winter 2026/27 BTV import.
-- This never writes fixture data, never changes RLS, and never runs the BTV fetch.
-- Actual fixture synchronization remains in the existing verified importer.
create or replace function private.assert_winter_btv_health()
returns void language plpgsql security invoker
set search_path = ''
as $$
declare
  last_ok timestamptz;
  total integer;
  missing_routes integer;
  missing_sources integer;
begin
  select max(completed_at) into last_ok from public.btv_import_runs
    where season_code='winter-2026-2027'
      and status='success'
      and source_fixture_count=15
      and coalesce(conflicts_count,0)=0;

  select count(*),
    count(*) filter (where nullif(btrim(m.venue_address),'') is null),
    count(*) filter (where coalesce(m.external_url,'') !~ '^https://www[.]btv[.]de/de/spielbetrieb/tabelle-spielplan[.]html[?]groupid=[0-9]+$')
  into total,missing_routes,missing_sources
  from public.matches m
  join public.team_seasons ts on ts.id=m.team_season_id
  join public.seasons s on s.id=ts.season_id
  where s.code='winter-2026-2027';

  if total<>15 or missing_routes>0 or missing_sources>0 then
    raise exception 'Winter BTV integrity: % matches, % routes missing, % source links missing',
      total,missing_routes,missing_sources;
  end if;
  if last_ok is null or last_ok<now()-interval '24 hours' then
    raise exception 'Winter BTV import missing/older than 24h; inspect automated import and BTV source';
  end if;
  if last_ok<now()-interval '8 hours' then
    raise warning 'Winter BTV last successful verified import older than 8 hours: %',last_ok;
  end if;
end;
$$;
revoke all on function private.assert_winter_btv_health() from public,anon,authenticated;
-- Job errors are retained in cron.job_run_details; status is also shown in the SuperAdmin panel.
select cron.schedule('tsv-winter-btv-health-hourly','22 * * * *',
  'select private.assert_winter_btv_health();');
