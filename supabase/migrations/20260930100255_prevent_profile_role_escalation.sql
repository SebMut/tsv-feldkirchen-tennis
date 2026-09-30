drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and global_role = 'user'
);

create policy profiles_update_admin
on public.profiles
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());
