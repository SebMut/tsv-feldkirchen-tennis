-- Destructive pyramid administration is intentionally restricted to SuperAdmin.
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
  set constraints pyramid_entries_unique_position deferred;

  -- Challenge history references entries with restrictive foreign keys. Removing
  -- the member from this ladder therefore also removes their ladder-only history.
  delete from public.pyramid_challenges
   where challenger_id=e.id or defender_id=e.id;
  delete from public.pyramid_requests
   where ladder_id=e.ladder_id and user_id=e.user_id;
  delete from public.pyramid_entries where id=e.id;
  update public.pyramid_entries
     set position=position-1
   where ladder_id=e.ladder_id and position>e.position;
end;
$$;

revoke all on function public.pyramid_delete_entry(uuid) from public,anon;
grant execute on function public.pyramid_delete_entry(uuid) to authenticated;

-- Completed results can be corrected by SuperAdmin. A winner change is applied
-- in reverse chronological order so subsequent ladder movements stay auditable.
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
  set constraints pyramid_entries_unique_position deferred;

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

  -- Undo a previous challenger promotion. A defender victory never changed ranks.
  if c.winner_id=c.challenger_id
     and c.challenger_position_at_start>c.defender_position_at_start then
    update public.pyramid_entries e
       set position=case
         when e.id=c.challenger_id then c.challenger_position_at_start
         else e.position-1 end
     where e.ladder_id=c.ladder_id
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
