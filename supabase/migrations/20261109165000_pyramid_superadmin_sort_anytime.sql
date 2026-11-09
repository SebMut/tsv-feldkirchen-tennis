-- Explicit Superadmin re-sorting is an administrative override. The
-- Superadmin may intentionally restore the LK order even while a challenge is
-- open; the confirmation in the UI makes the ranking replacement explicit.
create or replace function public.pyramid_sort_seed_by_lk(p_ladder uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare l public.pyramid_ladders%rowtype;
begin
 if not private.is_super_admin() then
   raise exception 'Nur der Superadmin darf die Rangliste nach LK sortieren' using errcode='42501';
 end if;
 select * into strict l from public.pyramid_ladders where id=p_ladder for update;
 set constraints pyramid_entries_unique_position deferred;
 with ranked as (
   select id,row_number() over(
     order by lk_rating asc nulls last,position,joined_at,id
   )::integer as new_pos
   from public.pyramid_entries
   where ladder_id=p_ladder and withdrawn_at is null
 )
 update public.pyramid_entries e set position=r.new_pos from ranked r where r.id=e.id;
end;
$$;
revoke all on function public.pyramid_sort_seed_by_lk(uuid) from public,anon;
grant execute on function public.pyramid_sort_seed_by_lk(uuid) to authenticated;
