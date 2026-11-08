-- A disputed result goes back to the member who originally reported it.
-- Completed results remain immutable through this workflow.
alter table public.pyramid_challenges
  add column if not exists result_reporter_id uuid references public.pyramid_entries(id) on delete set null;

update public.pyramid_challenges
set result_reporter_id=proposed_winner_id
where result_reporter_id is null
  and status in ('result_pending','result_disputed')
  and proposed_winner_id is not null;

create or replace function public.pyramid_report_result(
 p_challenge uuid,p_score text,p_winner uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; own_entry uuid; winner uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select id into own_entry from public.pyramid_entries
   where ladder_id=c.ladder_id and user_id=auth.uid();
 winner:=coalesce(p_winner,own_entry);

 if c.status='completed' then
   raise exception 'Das Ergebnis wurde von beiden Seiten bestätigt. Änderungen sind nur durch den Superadmin möglich';
 end if;
 if c.status not in ('accepted','result_disputed') then
   raise exception 'Das Spiel ist nicht zur Ergebnisabgabe offen';
 end if;
 if c.status='result_disputed'
    and not private.can_manage_pyramid()
    and own_entry is distinct from c.result_reporter_id then
   raise exception 'Nur die Person, die das Ergebnis gemeldet hat, darf es nach dem Widerspruch korrigieren'
     using errcode='42501';
 end if;
 if now()>coalesce(c.play_deadline,c.created_at+interval '14 days')
    and not private.can_manage_pyramid() then
   raise exception 'Spielfrist überschritten: Bitte die Ranglistenverwaltung kontaktieren';
 end if;
 if winner not in (c.challenger_id,c.defender_id) then
   raise exception 'Ungültiger Sieger';
 end if;
 if not private.can_manage_pyramid() and
   (own_entry is distinct from winner or own_entry not in (c.challenger_id,c.defender_id)) then
   raise exception 'Nur der Sieger darf das Ergebnis melden' using errcode='42501';
 end if;
 if p_score is null or char_length(p_score)>80
   or not private.pyramid_valid_winning_score(p_score) then
   raise exception 'Ungültiges Ergebnis: z. B. 6:4, 4:6, 10:8';
 end if;

 update public.pyramid_challenges
   set status='result_pending',proposed_winner_id=winner,proposed_score=p_score,
     result_reporter_id=coalesce(result_reporter_id,own_entry,winner),
     reported_at=now(),confirmation_deadline=now()+interval '48 hours',
     disputed_at=null,dispute_reason=null
   where id=c.id;
 insert into private.pyramid_auto_decline_notices(challenge_id,kind)
 values(c.id,'result_reported') on conflict(challenge_id,kind) do nothing;
end;
$$;

revoke all on function public.pyramid_report_result(uuid,text,uuid) from public,anon;
grant execute on function public.pyramid_report_result(uuid,text,uuid) to authenticated;
