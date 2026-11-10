begin;

-- The published standings are populated by trusted server-side imports. Browser
-- roles only read them; RLS already denied writes, and the grants now enforce
-- the same boundary before RLS is evaluated.
revoke all on table public.team_standings from anon, authenticated;
grant select on table public.team_standings to anon, authenticated;

-- These three RPCs deliberately cross RLS boundaries for narrowly scoped,
-- public data. Remove inherited/default EXECUTE and keep only the roles used by
-- the website. The function bodies use an empty search_path and return either
-- aggregate counts, public ladder names/positions, or validated counters.
revoke all on function public.event_rsvp_summary(uuid)
  from public, anon, authenticated;
grant execute on function public.event_rsvp_summary(uuid)
  to anon, authenticated;

revoke all on function public.pyramid_public_standings()
  from public, anon, authenticated;
grant execute on function public.pyramid_public_standings()
  to anon, authenticated;

revoke all on function public.track_site_analytics(text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.track_site_analytics(text,text,text,text,text,text)
  to anon, authenticated;

comment on function public.event_rsvp_summary(uuid) is
  'Public, aggregate-only RSVP totals for a published event; no personal fields are returned.';
comment on function public.pyramid_public_standings() is
  'Public active ladder, position and display-name projection; private profile and challenge data are excluded.';
comment on function public.track_site_analytics(text,text,text,text,text,text) is
  'Public write-only aggregate counter with strict event, path, device, source and target allowlists.';

-- Private helper and trigger functions are not API endpoints. Explicitly remove
-- residual default EXECUTE privileges and prevent future functions in this
-- schema from inheriting PUBLIC execution.
revoke execute on all functions in schema private from public, anon;
alter default privileges in schema private revoke execute on functions from public;

-- These service-only tables intentionally have RLS without client policies and
-- no client grants. Comments make that closed-by-default design explicit.
comment on table public.event_rsvp_pending is
  'Service-only double-opt-in staging data. No anon/authenticated grants or RLS policies by design.';
comment on table public.official_season_sources is
  'Service-only official import source registry. No anon/authenticated grants or RLS policies by design.';

commit;
