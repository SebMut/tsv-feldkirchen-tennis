-- The position constraint is INITIALLY DEFERRED already. With the hardened
-- empty search_path used by these SECURITY DEFINER functions, referring to the
-- constraint by its unqualified name fails before the actual operation runs.
-- Recreate the affected functions without the redundant SET CONSTRAINTS call.

create or replace function public.pyramid_delete_entry(p_entry uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare
  e public.pyramid_entries%rowtype;
begin
  if not private.is_super_admin() then
    raise exception 'Nur Superadmins dürfen Spieler aus der Rangliste löschen' using errcode='42501';
  end if;

  select * into strict e from public.pyramid_entries where id=p_entry;
  perform 1 from public.pyramid_ladders where id=e.ladder_id for update;
  select * into strict e from public.pyramid_entries where id=p_entry for update;

  delete from public.pyramid_challenges
   where challenger_id=e.id or defender_id=e.id;
  delete from public.pyramid_requests
   where ladder_id=e.ladder_id and user_id=e.user_id;
  delete from public.pyramid_entries where id=e.id;
  update public.pyramid_entries
     set position=position-1
   where ladder_id=e.ladder_id and withdrawn_at is null and position>e.position;
end;
$$;
revoke all on function public.pyramid_delete_entry(uuid) from public,anon;
grant execute on function public.pyramid_delete_entry(uuid) to authenticated;

create or replace function public.pyramid_delete_my_account(p_ladder uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid:=auth.uid();
  own_entry public.pyramid_entries%rowtype;
begin
  if uid is null then
    raise exception 'Anmeldung erforderlich' using errcode='42501';
  end if;
  if p_ladder is null then raise exception 'Rangliste fehlt'; end if;

  perform 1 from public.pyramid_ladders where id=p_ladder for update;
  select * into own_entry
    from public.pyramid_entries
   where ladder_id=p_ladder and user_id=uid and withdrawn_at is null
   for update;
  if not found then
    raise exception 'Kein aktives Forderungspyramidenkonto gefunden' using errcode='P0002';
  end if;

  update public.pyramid_challenges
     set status='cancelled',resolved_at=coalesce(resolved_at,now())
   where (challenger_id=own_entry.id or defender_id=own_entry.id)
     and status in ('pending','accepted','result_pending','result_disputed');

  update public.pyramid_entries
     set withdrawn_at=now(),position=null,neutralized_at=null,
         neutralized_reason=null
   where id=own_entry.id;

  update public.pyramid_entries
     set position=position-1
   where ladder_id=p_ladder
     and withdrawn_at is null
     and position>own_entry.position;

  delete from public.pyramid_requests
   where ladder_id=p_ladder and user_id=uid;
end;
$$;
revoke all on function public.pyramid_delete_my_account(uuid) from public,anon;
grant execute on function public.pyramid_delete_my_account(uuid) to authenticated;

create or replace function public.pyramid_correct_completed_result(
 p_challenge uuid,p_winner uuid,p_score text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.pyramid_challenges%rowtype;
begin
  if not private.is_super_admin() then
    raise exception 'Nur Superadmins dürfen abgeschlossene Ergebnisse ändern' using errcode='42501';
  end if;

  select * into strict c from public.pyramid_challenges where id=p_challenge;
  perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
  select * into strict c from public.pyramid_challenges where id=p_challenge for update;

  if c.status<>'completed' then raise exception 'Spiel ist nicht abgeschlossen'; end if;
  if p_winner not in (c.challenger_id,c.defender_id)
     or p_score is null or char_length(p_score)>80
     or not private.pyramid_valid_winning_score(p_score) then
    raise exception 'Sieger oder Ergebnis ungültig';
  end if;

  if p_winner=c.winner_id then
    update public.pyramid_challenges
       set score=p_score,proposed_winner_id=p_winner,proposed_score=p_score,
           dispute_reason=null,disputed_at=null
     where id=c.id;
    return;
  end if;

  if exists (
    select 1 from public.pyramid_challenges newer
     where newer.ladder_id=c.ladder_id and newer.id<>c.id
       and newer.status in ('completed','forfeit')
       and newer.resolved_at>c.resolved_at
  ) then
    raise exception 'Gewinnerkorrekturen bitte bei den neuesten Spielen beginnen';
  end if;

  if c.winner_id=c.challenger_id
     and c.challenger_position_at_start>c.defender_position_at_start then
    update public.pyramid_entries e
       set position=case
         when e.id=c.challenger_id then c.challenger_position_at_start
         else e.position-1 end
     where e.ladder_id=c.ladder_id
       and e.withdrawn_at is null
       and (e.id=c.challenger_id or e.position between
         c.defender_position_at_start+1 and c.challenger_position_at_start);
  end if;

  update public.pyramid_challenges
     set status='accepted',winner_id=null,score=null,resolved_at=null,
         proposed_winner_id=null,proposed_score=null,reported_at=null,
         confirmation_deadline=null,disputed_at=null,dispute_reason=null
   where id=c.id;
  perform private.pyramid_finish(c.id,p_winner,'completed',p_score);
end;
$$;
revoke all on function public.pyramid_correct_completed_result(uuid,uuid,text) from public,anon;
grant execute on function public.pyramid_correct_completed_result(uuid,uuid,text) to authenticated;
