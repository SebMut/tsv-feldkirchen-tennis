-- TV scoreboard timing is stored in the existing site_settings table.
-- Readable by the public TV view, writable only by private.is_super_admin() via existing RLS.
-- No new tables, policies, or application roles.
insert into public.site_settings (key, value, is_public)
values (
  'tv_ticker_timing',
  '{"poll_seconds":30,"recap_every_seconds":300,"recap_duration_seconds":30,"highlight_seconds":300}'::jsonb,
  true
)
on conflict (key) do nothing;
