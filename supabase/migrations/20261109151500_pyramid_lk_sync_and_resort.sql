-- Keep the member profile LK and pyramid overview in sync, including when the
-- LK was declared before a Superadmin approved the membership request.
create or replace function public.pyramid_approve_join(p_request uuid)
 returns uuid language plpgsql security definer set search_path = '' as $$
declare req public.pyramid_requests%rowtype; l public.pyramid_ladders%rowtype;
        new_id uuid; next_position integer; declared_lk numeric(4,1);
begin
 if not private.is_super_admin() then
   raise exception 'Nur der Superadmin darf Teilnahmeanfragen genehmigen' using errcode='42501';
 end if;
 select * into strict req from public.pyramid_requests where id=p_request;
 select * into strict l from public.pyramid_ladders where id=req.ladder_id for update;
 select * into strict req from public.pyramid_requests where id=p_request for update;
 if req.status<>'pending' then raise exception 'Diese Anfrage ist bereits bearbeitet'; end if;
 select p.tennis_lk_rating into declared_lk from public.profiles p where p.id=req.user_id;
 select coalesce(max(position),0)+1 into next_position
   from public.pyramid_entries where ladder_id=req.ladder_id and withdrawn_at is null;
 insert into public.pyramid_entries(
   ladder_id,user_id,display_name,position,qualified,provisional,lk_rating
 ) values(
   req.ladder_id,req.user_id,req.display_name,next_position,true,l.seeded_at is null,declared_lk
 ) returning id into new_id;
 update public.pyramid_requests set status='approved',reviewed_at=now() where id=req.id;
 insert into private.pyramid_join_approval_notices(request_id) values(req.id)
   on conflict(request_id) do nothing;
 return new_id;
end;
$$;

-- Repair older entries whose profile already contains the authoritative LK.
update public.pyramid_entries e
 set lk_rating=p.tennis_lk_rating
from public.profiles p
where p.id=e.user_id
  and p.tennis_lk_rating is not null
  and e.lk_rating is distinct from p.tennis_lk_rating;

-- A Superadmin may deliberately restore the LK order even after the initial
-- seed was finalized. Open or unconfirmed games block this operation so their
-- challenge geometry cannot change underneath an active match.
create or replace function public.pyramid_sort_seed_by_lk(p_ladder uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare l public.pyramid_ladders%rowtype;
begin
 if not private.is_super_admin() then
   raise exception 'Nur der Superadmin darf die Rangliste nach LK sortieren' using errcode='42501';
 end if;
 select * into strict l from public.pyramid_ladders where id=p_ladder for update;
 if exists(select 1 from public.pyramid_challenges
   where ladder_id=p_ladder
     and status in ('pending','accepted','result_pending','result_disputed')) then
   raise exception 'Bei offenen Forderungen oder unbestätigten Ergebnissen ist eine Sortierung nicht zulässig';
 end if;
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
