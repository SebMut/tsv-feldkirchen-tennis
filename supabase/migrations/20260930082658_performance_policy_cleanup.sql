-- Applied migration: performance_policy_cleanup
create index if not exists events_created_by_idx on public.events(created_by);
create index if not exists facility_status_updated_by_idx on public.facility_status(updated_by);
create index if not exists galleries_created_by_idx on public.galleries(created_by);
create index if not exists live_ticker_entries_author_idx on public.live_ticker_entries(author_id);
create index if not exists match_live_state_updated_by_idx on public.match_live_state(updated_by);
create index if not exists news_author_idx on public.news(author_id);
create index if not exists pages_updated_by_idx on public.pages(updated_by);
create index if not exists site_settings_updated_by_idx on public.site_settings(updated_by);

drop policy if exists seasons_admin_write on public.seasons;
create policy seasons_admin_insert on public.seasons for insert to authenticated with check (private.is_super_admin());
create policy seasons_admin_update on public.seasons for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy seasons_admin_delete on public.seasons for delete to authenticated using (private.is_super_admin());

drop policy if exists categories_admin_write on public.team_categories;
create policy categories_admin_insert on public.team_categories for insert to authenticated with check (private.is_super_admin());
create policy categories_admin_update on public.team_categories for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy categories_admin_delete on public.team_categories for delete to authenticated using (private.is_super_admin());

drop policy if exists sponsors_admin_write on public.sponsors;
create policy sponsors_admin_insert on public.sponsors for insert to authenticated with check (private.is_super_admin());
create policy sponsors_admin_update on public.sponsors for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy sponsors_admin_delete on public.sponsors for delete to authenticated using (private.is_super_admin());

drop policy if exists placements_admin_write on public.sponsor_placements;
create policy placements_admin_insert on public.sponsor_placements for insert to authenticated with check (private.is_super_admin());
create policy placements_admin_update on public.sponsor_placements for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy placements_admin_delete on public.sponsor_placements for delete to authenticated using (private.is_super_admin());

drop policy if exists officials_admin_write on public.officials;
create policy officials_admin_insert on public.officials for insert to authenticated with check (private.is_super_admin());
create policy officials_admin_update on public.officials for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy officials_admin_delete on public.officials for delete to authenticated using (private.is_super_admin());

drop policy if exists pages_admin_write on public.pages;
create policy pages_admin_insert on public.pages for insert to authenticated with check (private.is_super_admin());
create policy pages_admin_update on public.pages for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy pages_admin_delete on public.pages for delete to authenticated using (private.is_super_admin());

drop policy if exists settings_admin_write on public.site_settings;
create policy settings_admin_insert on public.site_settings for insert to authenticated with check (private.is_super_admin());
create policy settings_admin_update on public.site_settings for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy settings_admin_delete on public.site_settings for delete to authenticated using (private.is_super_admin());

drop policy if exists facility_admin_write on public.facility_status;
create policy facility_admin_insert on public.facility_status for insert to authenticated with check (private.is_super_admin());
create policy facility_admin_update on public.facility_status for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy facility_admin_delete on public.facility_status for delete to authenticated using (private.is_super_admin());

drop policy if exists courts_admin_write on public.courts;
create policy courts_admin_insert on public.courts for insert to authenticated with check (private.is_super_admin());
create policy courts_admin_update on public.courts for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy courts_admin_delete on public.courts for delete to authenticated using (private.is_super_admin());
