-- Phase 6: Supers may inspect inactive catalog entries for editing.
-- Existing public SELECT policies stay unchanged; no new anonymous access.
create policy sponsors_superadmin_read on public.sponsors
  for select to authenticated using (private.is_super_admin());

create policy officials_superadmin_read on public.officials
  for select to authenticated using (private.is_super_admin());

create policy placements_superadmin_read on public.sponsor_placements
  for select to authenticated using (private.is_super_admin());

create policy courts_superadmin_read on public.courts
  for select to authenticated using (private.is_super_admin());
