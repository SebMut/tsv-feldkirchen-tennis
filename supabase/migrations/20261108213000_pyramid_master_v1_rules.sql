-- TSV Feldkirchen Tennis · Forderungspyramide Master-Regelwerk Version 1.0.
-- The uploaded master replaces the previous TSV and Oberrad-derived intervals:
-- 14 days to play, 3-day scheduling target, 7-day rematch/loss,
-- 48-hour winner protection and result confirmation, 28-day maximum neutralization.
-- Preserve the existing tables, ownership and manager permissions.

alter table public.pyramid_challenges
  add column if not exists proposed_winner_id uuid references public.pyramid_entries(id),
  add column if not exists proposed_score text,
  add column if not exists reported_at timestamptz,
  add column if not exists confirmation_deadline timestamptz,
  add column if not exists disputed_at timestamptz,
  add column if not exists dispute_reason text,
  add column if not exists weather_extended_at timestamptz,
  add column if not exists overdue_extended_at timestamptz,
  add column if not exists no_show_requested_at timestamptz,
  add column if not exists no_show_reporter_id uuid references public.pyramid_entries(id);

alter table public.pyramid_challenges drop constraint if exists pyramid_challenges_status_check;
alter table public.pyramid_challenges add constraint pyramid_challenges_status_check
  check (status in ('pending','accepted','result_pending','result_disputed',
    'completed','forfeit','declined','cancelled'));

alter table public.pyramid_challenges alter column accept_deadline
  set default (now()+interval '14 days');

-- Existing saved summer 2027 was not seeded and has no matches or entrants:
-- align just this existing future draft with the new May–September master.
update public.pyramid_ladders l set ends_on='2027-09-30'::date
 where l.season_label='Sommer 2027'
   and l.starts_on='2027-05-01'::date
   and l.ends_on='2027-07-31'::date
   and l.seeded_at is null
   and not exists(select 1 from public.pyramid_entries e where e.ladder_id=l.id)
   and not exists(select 1 from public.pyramid_challenges c where c.ladder_id=l.id);

-- New members receive the last physical ranking place on approval (master §3).
-- The previous qualification match workflow is superseded.
create or replace function public.pyramid_approve_join(p_request uuid)
 returns uuid language plpgsql security definer set search_path = '' as $$
declare req public.pyramid_requests%rowtype; l public.pyramid_ladders%rowtype;
        new_id uuid; next_position integer;
begin
 if not private.can_manage_pyramid() then
   raise exception 'Keine Berechtigung' using errcode='42501';
 end if;
 select * into strict req from public.pyramid_requests where id=p_request;
 select * into strict l from public.pyramid_ladders where id=req.ladder_id for update;
 select * into strict req from public.pyramid_requests where id=p_request for update;
 if req.status<>'pending' then raise exception 'Diese Anfrage ist bereits bearbeitet'; end if;
 select coalesce(max(position),0)+1 into next_position
   from public.pyramid_entries where ladder_id=req.ladder_id;
 insert into public.pyramid_entries(ladder_id,user_id,display_name,position,qualified,provisional)
 values(req.ladder_id,req.user_id,req.display_name,next_position,true,l.seeded_at is null)
 returning id into new_id;
 update public.pyramid_requests set status='approved',reviewed_at=now() where id=req.id;
 return new_id;
end;
$$;

-- Serialize creation by ladder row, so concurrent challenges of one player
-- cannot both commit. All statuses awaiting manager or opponent action are busy.
create or replace function private.pyramid_issue_challenge(
 p_challenger uuid,p_defender uuid,p_source text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.pyramid_entries%rowtype; c public.pyramid_entries%rowtype;
 l public.pyramid_ladders%rowtype; cr integer; dr integer; cc integer; dc integer;
 new_id uuid; allowed boolean;
begin
 if p_source not in ('online','private') then raise exception 'Ungültige Forderungsquelle'; end if;
 select * into strict d from public.pyramid_entries where id=p_defender;
 select * into strict l from public.pyramid_ladders where id=d.ladder_id for update;
 select * into strict d from public.pyramid_entries where id=p_defender;
 select * into strict c from public.pyramid_entries where id=p_challenger;
 if c.ladder_id<>d.ladder_id then raise exception 'Forderung nur innerhalb derselben Rangliste'; end if;
 if not l.active or (now() at time zone 'Europe/Berlin')::date
    not between l.starts_on and l.ends_on then
   raise exception 'Die Saison ist nicht aktiv';
 end if;
 if l.seeded_at is null then raise exception 'Startaufstellung zuerst abschließen'; end if;
 if c.id=d.id or c.position<=d.position then
   raise exception 'Nur höher platzierte Personen können gefordert werden';
 end if;
 if (c.neutralized_at is not null and c.neutralized_at>now()-interval '28 days')
    or (d.neutralized_at is not null and d.neutralized_at>now()-interval '28 days') then
   raise exception 'Ein Spieler ist momentan neutralisiert';
 end if;
 if c.last_loss_at>now()-interval '7 days' then
   raise exception 'Nach einer Niederlage gilt eine Wartezeit von sieben Tagen';
 end if;
 if d.last_win_at>now()-interval '48 hours' then
   raise exception 'Der Sieger ist 48 Stunden gegen neue Forderungen geschützt';
 end if;
 if exists(select 1 from public.pyramid_challenges pc
   where pc.challenger_id=c.id and pc.defender_id=d.id
   and pc.status in ('completed','forfeit')
   and pc.resolved_at>now()-interval '7 days') then
   raise exception 'Derselbe Gegner kann erst nach sieben Tagen erneut gefordert werden';
 end if;
 if exists(select 1 from public.pyramid_challenges pc
   where pc.status in ('pending','accepted','result_pending','result_disputed')
   and (pc.challenger_id in (c.id,d.id) or pc.defender_id in (c.id,d.id))) then
   raise exception 'Einer der Spieler hat bereits eine offene Forderung';
 end if;
 cr:=private.pyramid_row(c.position); dr:=private.pyramid_row(d.position);
 cc:=c.position-(cr*(cr+1)/2)-1; dc:=d.position-(dr*(dr+1)/2)-1;
 allowed:=(c.position<=3 or (dr=cr and dc<cc) or (dr=cr-1 and dc>=cc));
 if not allowed then raise exception 'Forderung nach Tannenbaum-Regeln unzulässig'; end if;
 insert into public.pyramid_challenges(ladder_id,challenger_id,defender_id,
  challenger_position_at_start,defender_position_at_start,source,
  accept_deadline,play_deadline)
 values(l.id,c.id,d.id,c.position,d.position,p_source,
  now()+interval '14 days',now()+interval '14 days')
 returning id into new_id;
 insert into private.pyramid_auto_decline_notices(challenge_id,kind)
 values(new_id,'challenge_created') on conflict(challenge_id,kind) do nothing;
 return new_id;
end;
$$;
revoke all on function private.pyramid_issue_challenge(uuid,uuid,text) from public,anon,authenticated;

-- Acceptance does not reset the 14-day playing deadline. Scheduling should
-- be agreed within 3 days if possible, but this is advice, not a hard veto.
create or replace function private.pyramid_accept_locked(p_challenge uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 if c.status<>'pending' or c.created_at+interval '14 days'<=now() then
   raise exception 'Die Forderungsfrist ist abgelaufen; Ranglistenverwaltung entscheidet';
 end if;
 if exists(select 1 from public.pyramid_challenges where id<>c.id
   and status in ('pending','accepted','result_pending','result_disputed')
   and (challenger_id in (c.challenger_id,c.defender_id)
     or defender_id in (c.challenger_id,c.defender_id))) then
   raise exception 'Ein Spieler hat bereits eine offene Forderung';
 end if;
 update public.pyramid_challenges set status='accepted',accepted_at=now(),
   play_deadline=c.created_at+interval '14 days' where id=c.id;
end;
$$;
revoke all on function private.pyramid_accept_locked(uuid) from public,anon,authenticated;

create or replace function public.pyramid_schedule_match(p_challenge uuid,p_date timestamptz)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; own uuid; deadline timestamptz;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select id into own from public.pyramid_entries where user_id=auth.uid() and ladder_id=c.ladder_id;
 if not private.can_manage_pyramid() and own not in (c.challenger_id,c.defender_id) then
   raise exception 'Keine Berechtigung für die Terminvereinbarung' using errcode='42501';
 end if;
 if c.status<>'accepted' then raise exception 'Forderung muss zuerst angenommen werden'; end if;
 deadline:=coalesce(c.play_deadline,c.created_at+interval '14 days');
 if p_date is null or p_date<now()-interval '15 minutes' then
   raise exception 'Bitte einen zukünftigen Spieltermin eintragen';
 end if;
 if p_date>deadline then
   raise exception 'Das Spiel muss innerhalb von 14 Tagen nach der Forderung stattfinden';
 end if;
 update public.pyramid_challenges set scheduled_for=p_date,scheduled_at=now(),
   play_deadline=deadline where id=c.id;
end;
$$;

-- A reported score is only a proposal: NO ranking movement until the losing
-- opponent confirms within 48 hours or a manager explicitly adjudicates.
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
 if c.status<>'accepted' then raise exception 'Das Spiel ist nicht zur Ergebnisabgabe offen'; end if;
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
     reported_at=now(),confirmation_deadline=now()+interval '48 hours',
     disputed_at=null,dispute_reason=null
   where id=c.id;
 insert into private.pyramid_auto_decline_notices(challenge_id,kind)
 values(c.id,'result_reported') on conflict(challenge_id,kind) do nothing;
end;
$$;

-- Match finishing is the ONLY place that changes standings. Existing result
-- rank geometry is preserved; result_pending must be confirmed by the loser.
create or replace function private.pyramid_finish(
 p_id uuid,p_winner uuid,p_state text,p_score text
) returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; cp integer; dp integer;
        official_count integer; destination integer; was_qualified boolean; loser uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_id for update;
 if c.status not in ('pending','accepted','result_pending','result_disputed')
   or p_winner not in (c.challenger_id,c.defender_id)
   or p_state not in ('completed','forfeit') then
   raise exception 'Ungültiger Spielabschluss';
 end if;
 if p_state='completed' and c.status not in ('result_pending','result_disputed') then
   raise exception 'Ergebnis wurde noch nicht bestätigt';
 end if;
 loser:=case when p_winner=c.challenger_id then c.defender_id else c.challenger_id end;
 select position,qualified into cp,was_qualified
  from public.pyramid_entries where id=c.challenger_id;
 select position into dp from public.pyramid_entries where id=c.defender_id;
 if not was_qualified then
   select count(*) into official_count from public.pyramid_entries
    where ladder_id=c.ladder_id and qualified;
   if p_winner=c.challenger_id then
     update public.pyramid_entries
      set position=case when id=c.challenger_id then dp else position+1 end
      where ladder_id=c.ladder_id and position between dp and cp;
   else
     destination:=official_count+1;
     if cp>destination then
       update public.pyramid_entries
       set position=case when id=c.challenger_id then destination else position+1 end
       where ladder_id=c.ladder_id and position between destination and cp;
     end if;
   end if;
   update public.pyramid_entries set qualified=true,provisional=false where id=c.challenger_id;
 elsif p_winner=c.challenger_id and cp>dp then
   update public.pyramid_entries
    set position=case when id=c.challenger_id then dp else position+1 end
    where ladder_id=c.ladder_id and position between dp and cp;
 end if;
 update public.pyramid_entries set last_win_at=now() where id=p_winner;
 update public.pyramid_entries set last_loss_at=now() where id=loser;
 update public.pyramid_entries set provisional=false
  where id in (c.challenger_id,c.defender_id);
 update public.pyramid_challenges set status=p_state,winner_id=p_winner,
   score=p_score,resolved_at=now() where id=p_id;
end;
$$;
revoke all on function private.pyramid_finish(uuid,uuid,text,text) from public,anon,authenticated;

create or replace function public.pyramid_confirm_result(
 p_challenge uuid,p_confirm boolean,p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; reviewer uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select user_id into reviewer from public.pyramid_entries
   where id=case when c.proposed_winner_id=c.challenger_id
          then c.defender_id else c.challenger_id end;
 if auth.uid() is distinct from reviewer then
   raise exception 'Nur der gegnerische Spieler darf bestätigen' using errcode='42501';
 end if;
 if c.status<>'result_pending' then raise exception 'Keine offene Ergebnisbestätigung'; end if;
 if c.confirmation_deadline<now() then
   raise exception '48-Stunden-Frist abgelaufen; bitte Ranglistenwart kontaktieren';
 end if;
 if p_confirm then
   perform private.pyramid_finish(c.id,c.proposed_winner_id,'completed',c.proposed_score);
 else
   if char_length(btrim(coalesce(p_reason,'')))<5 then
     raise exception 'Bitte den Grund für den Ergebniswiderspruch angeben (mind. 5 Zeichen)';
   end if;
   update public.pyramid_challenges
    set status='result_disputed',disputed_at=now(),dispute_reason=left(btrim(p_reason),1000)
    where id=c.id;
 end if;
end;
$$;
revoke all on function public.pyramid_confirm_result(uuid,boolean,text) from public,anon;
grant execute on function public.pyramid_confirm_result(uuid,boolean,text) to authenticated;

create or replace function public.pyramid_decide_result(
 p_challenge uuid,p_approve boolean,p_winner uuid default null,p_score text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; winner uuid; score text;
begin
 if not private.can_manage_pyramid() then
   raise exception 'Nur die Ranglistenverwaltung darf Ergebnisstreitigkeiten entscheiden'
     using errcode='42501';
 end if;
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 if c.status not in ('result_pending','result_disputed') then
   raise exception 'Kein zur Entscheidung offenes Ergebnis';
 end if;
 if not p_approve then
   update public.pyramid_challenges set status='accepted',proposed_winner_id=null,
      proposed_score=null,reported_at=null,confirmation_deadline=null,
      disputed_at=null,dispute_reason=null where id=c.id;
 else
   winner:=coalesce(p_winner,c.proposed_winner_id);
   score:=coalesce(p_score,c.proposed_score);
   if winner not in (c.challenger_id,c.defender_id)
     or score is null or not private.pyramid_valid_winning_score(score) then
     raise exception 'Sieger oder Ergebnis ungültig';
   end if;
   perform private.pyramid_finish(c.id,winner,'completed',score);
 end if;
end;
$$;
revoke all on function public.pyramid_decide_result(uuid,boolean,uuid,text) from public,anon;
grant execute on function public.pyramid_decide_result(uuid,boolean,uuid,text) to authenticated;

-- 15-minute grace period. Any of the two players can request an adjudicated
-- forfeit, but cannot award themselves a win.
create or replace function public.pyramid_request_no_show(p_challenge uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; own uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select id into own from public.pyramid_entries
   where ladder_id=c.ladder_id and user_id=auth.uid();
 if own not in (c.challenger_id,c.defender_id) then
   raise exception 'Nur die beteiligten Spieler dürfen Nichtantreten melden' using errcode='42501';
 end if;
 if c.status<>'accepted' or c.scheduled_for is null
   or now()<c.scheduled_for+interval '15 minutes' then
   raise exception 'Nichtantreten kann 15 Minuten nach dem bestätigten Spieltermin gemeldet werden';
 end if;
 if c.no_show_requested_at is not null then
   raise exception 'Eine Nichtantreten-Meldung wird bereits geprüft';
 end if;
 update public.pyramid_challenges
   set no_show_requested_at=now(),no_show_reporter_id=own where id=c.id;
end;
$$;
revoke all on function public.pyramid_request_no_show(uuid) from public,anon;
grant execute on function public.pyramid_request_no_show(uuid) to authenticated;

create or replace function public.pyramid_decide_no_show(p_challenge uuid,p_approve boolean)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype;
begin
 if not private.can_manage_pyramid() then
   raise exception 'Nur die Ranglistenverwaltung darf Nichtantreten werten' using errcode='42501';
 end if;
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 if c.status<>'accepted' or c.no_show_reporter_id is null then
   raise exception 'Keine offene Nichtantreten-Meldung';
 end if;
 if p_approve then
   perform private.pyramid_finish(c.id,c.no_show_reporter_id,'forfeit',null);
 else
   update public.pyramid_challenges set no_show_requested_at=null,
     no_show_reporter_id=null where id=c.id;
 end if;
end;
$$;
revoke all on function public.pyramid_decide_no_show(uuid,boolean) from public,anon;
grant execute on function public.pyramid_decide_no_show(uuid,boolean) to authenticated;

-- Keep the old manager entry point but require an existing player report.
create or replace function public.pyramid_record_no_show(p_challenge uuid)
 returns void language plpgsql security definer set search_path = '' as $$
begin
 perform public.pyramid_decide_no_show(p_challenge,true);
end;
$$;

-- Once only: bad weather may extend the 14-day play deadline up to seven days.
create or replace function public.pyramid_extend_weather(p_challenge uuid,p_days integer)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype;
begin
 if not private.can_manage_pyramid() then
   raise exception 'Keine Berechtigung' using errcode='42501';
 end if;
 if p_days is null or p_days<1 or p_days>7 then
   raise exception 'Wetterverlängerung maximal 7 Tage';
 end if;
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 if c.status not in ('pending','accepted') or c.weather_extended_at is not null then
   raise exception 'Wetterverlängerung nur einmal bei offenem Spiel möglich';
 end if;
 update public.pyramid_challenges
   set weather_extended_at=now(),
       play_deadline=c.created_at+interval '14 days'+p_days*interval '1 day'
   where id=c.id;
end;
$$;
revoke all on function public.pyramid_extend_weather(uuid,integer) from public,anon;
grant execute on function public.pyramid_extend_weather(uuid,integer) to authenticated;

-- At expiry nothing happens to ranks automatically. A manager explicitly
-- extends, cancels or awards a forfeit, and every outcome is stored.
create or replace function public.pyramid_resolve_overdue(
 p_challenge uuid,p_action text,p_winner uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype;
begin
 if not private.can_manage_pyramid() then
   raise exception 'Keine Berechtigung' using errcode='42501';
 end if;
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 if c.status not in ('pending','accepted')
    or now()<=coalesce(c.play_deadline,c.created_at+interval '14 days') then
   raise exception 'Forderungsfrist noch nicht überschritten';
 end if;
 if p_action='extend' then
   if c.overdue_extended_at is not null then raise exception 'Bereits verlängert'; end if;
   update public.pyramid_challenges set overdue_extended_at=now(),
     play_deadline=now()+interval '7 days',
     accept_deadline=now()+interval '7 days' where id=c.id;
 elsif p_action='cancel' then
   update public.pyramid_challenges set status='cancelled',resolved_at=now() where id=c.id;
 elsif p_action='forfeit' then
   if p_winner not in (c.challenger_id,c.defender_id) then
     raise exception 'Für kampflosen Sieg bitte Sieger festlegen';
   end if;
   perform private.pyramid_finish(c.id,p_winner,'forfeit',null);
 else raise exception 'Ungültige Entscheidung';
 end if;
end;
$$;
revoke all on function public.pyramid_resolve_overdue(uuid,text,uuid) from public,anon;
grant execute on function public.pyramid_resolve_overdue(uuid,text,uuid) to authenticated;

-- 28-day MAXIMUM neutrality: expire it automatically, never demote players
-- (the uploaded master explicitly keeps their relative ranking).
create or replace function private.pyramid_process_injury_neutrality()
 returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
 update public.pyramid_entries
   set neutralized_at=null,neutralized_reason=null,neutral_shifted_at=null,
       neutral_shift_count=0
   where neutralized_at is not null
     and neutralized_at<=now()-interval '28 days';
 get diagnostics affected=row_count;
 return affected;
end;
$$;
revoke all on function private.pyramid_process_injury_neutrality()
 from public,anon,authenticated;
select cron.unschedule('tsv-pyramid-neutral-injury');
select cron.schedule('tsv-pyramid-neutral-expiry','15 * * * *',
 'select private.pyramid_process_injury_neutrality();');


-- The same secured Gmail outbox also notifies the opponent when a result
-- awaits confirmation; the queue is never directly writable by members.
alter table private.pyramid_auto_decline_notices
 drop constraint if exists pyramid_auto_decline_notices_kind_check;
alter table private.pyramid_auto_decline_notices
 add constraint pyramid_auto_decline_notices_kind_check
 check (kind in ('auto_decline','challenge_created','result_reported'));

create or replace function public.claim_pyramid_notification()
 returns table(id uuid,kind text,recipient_email text,challenger_name text,
   defender_name text,ladder_title text,season_label text,challenge_status text)
 language plpgsql security definer set search_path = '' as $
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then
   raise exception 'Nur der E-Mail-Service darf senden' using errcode='42501';
 end if;
 return query with due as (
  select n.id from private.pyramid_auto_decline_notices n
  where n.sent_at is null and n.attempts<10 and n.next_attempt_at<=now()
   and (n.claimed_until is null or n.claimed_until<now())
  order by case when n.kind='result_reported' then 0
    when n.kind='auto_decline' then 1 else 2 end,n.created_at
  limit 1 for update skip locked
 ), claimed as (
  update private.pyramid_auto_decline_notices n
    set claimed_until=now()+interval '3 minutes',attempts=n.attempts+1
  from due where n.id=due.id returning n.id,n.challenge_id,n.kind
 )
 select cl.id,cl.kind::text,
  coalesce(nullif(btrim(u.email),''),nullif(btrim(p.email),''))::text,
  ch.display_name::text,df.display_name::text,l.title::text,l.season_label::text,
  c.status::text
 from claimed cl
 join public.pyramid_challenges c on c.id=cl.challenge_id
 join public.pyramid_entries ch on ch.id=c.challenger_id
 join public.pyramid_entries df on df.id=c.defender_id
 join public.pyramid_ladders l on l.id=c.ladder_id
 left join auth.users u on u.id=case
   when cl.kind='challenge_created' then df.user_id
   when cl.kind='result_reported' and c.proposed_winner_id=c.challenger_id then df.user_id
   when cl.kind='result_reported' then ch.user_id
   else ch.user_id end
 left join public.profiles p on p.id=case
   when cl.kind='challenge_created' then df.user_id
   when cl.kind='result_reported' and c.proposed_winner_id=c.challenger_id then df.user_id
   when cl.kind='result_reported' then ch.user_id
   else ch.user_id end;
end;
$;
revoke all on function public.claim_pyramid_notification()
 from public,anon,authenticated;
grant execute on function public.claim_pyramid_notification() to service_role;

-- Do not let an active match (including a disputed result) be bypassed by
-- neutralizing one of its players.
create or replace function public.pyramid_set_neutralized(p_entry uuid,p_reason text)
 returns void language plpgsql security definer set search_path = '' as $
declare e public.pyramid_entries%rowtype;
begin
 select * into strict e from public.pyramid_entries where id=p_entry;
 perform 1 from public.pyramid_ladders where id=e.ladder_id for update;
 select * into strict e from public.pyramid_entries where id=p_entry for update;
 if not private.can_manage_pyramid() and e.user_id is distinct from auth.uid() then
   raise exception 'Nur der Teilnehmer oder die Verwaltung darf neutralisieren' using errcode='42501';
 end if;
 if p_reason is not null and p_reason not in ('injury','illness','vacation','other') then
   raise exception 'Ungültiger Abwesenheitsgrund';
 end if;
 if p_reason is not null and exists(select 1 from public.pyramid_challenges
   where status in ('pending','accepted','result_pending','result_disputed')
     and (challenger_id=e.id or defender_id=e.id)) then
   raise exception 'Bitte das laufende Forderungsspiel zuerst abschließen oder durch den Ranglistenwart aufheben';
 end if;
 update public.pyramid_entries
   set neutralized_at=case when p_reason is null then null
     when e.neutralized_at is null then now()
     else e.neutralized_at end,
       neutralized_reason=p_reason,neutral_shifted_at=null,neutral_shift_count=0
   where id=e.id;
end;
$;

-- All sections of the uploaded master are documented in the migration above.
