-- The challenger may also withdraw an accepted match until a result is reported.
create or replace function public.pyramid_withdraw_challenge(p_challenge uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.pyramid_challenges%rowtype;
  challenger_user uuid;
begin
  select * into strict c from public.pyramid_challenges where id=p_challenge;
  perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
  select * into strict c from public.pyramid_challenges where id=p_challenge for update;

  select user_id into strict challenger_user
    from public.pyramid_entries where id=c.challenger_id;

  if auth.uid() is distinct from challenger_user then
    raise exception 'Nur der Herausforderer darf die Forderung zurückziehen' using errcode='42501';
  end if;
  if c.status not in ('pending','accepted') then
    raise exception 'Diese Forderung kann nicht mehr zurückgezogen werden';
  end if;

  update public.pyramid_challenges
     set status='cancelled', resolved_at=now(), decline_reason='withdrawn_by_challenger'
   where id=c.id;
end;
$$;

revoke all on function public.pyramid_withdraw_challenge(uuid) from public,anon;
grant execute on function public.pyramid_withdraw_challenge(uuid) to authenticated;
