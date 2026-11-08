-- TSV Feldkirchen Tennis: finish the rule set from the five-page Spvgg Oberrad
-- reference, adapted to the existing TSV ladder manager and season configuration.
-- Existing memberships, challenges, seasons and site functions remain untouched.

-- A qualifying entrant is a member, but not yet a ranked player. Initial seed
-- entries are ranked even before the LK-based initial seed is finalized.
alter table public.pyramid_entries
  add column qualified boolean not null default true,
  add column lk_rating numeric(4,1)
    check (lk_rating between 1.0 and 25.0);
comment on column public.pyramid_entries.qualified
 is 'True after the initial seed, or after a new entrant completes their qualifying match';
comment on column public.pyramid_entries.lk_rating
 is 'Optional LK rating documented by the ladder manager before finalizing the initial seed';
alter table public.pyramid_challenges
  add column source text not null default 'online'
  check (source in ('online','private'));

-- Extend the EXISTING protected mail queue instead of creating a second queue.
alter table private.pyramid_auto_decline_notices
  drop constraint if exists pyramid_auto_decline_notices_challenge_id_key;
alter table private.pyramid_auto_decline_notices
  add column kind text not null default 'auto_decline'
    check (kind in ('auto_decline','challenge_created'));
alter table private.pyramid_auto_decline_notices
  add constraint pyramid_notice_unique_kind unique(challenge_id,kind);

-- Per the reference, the loser is only blocked when they were the challenger.
-- A winning entrant moves onto the defender's current rank; a losing entrant is
-- inserted immediately after the last QUALIFIED player, in front of other
-- unranked entrants awaiting their own qualification. Rank shifts are atomic.
create or replace function private.pyramid_finish(p_id uuid,p_winner uuid,p_state text,p_score text)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; cp integer; dp integer;
        was_qualified boolean; official_count integer; destination integer;
begin
 select * into strict c from public.pyramid_challenges where id=p_id for update;
 if c.status not in ('pending','accepted') or p_winner not in (c.challenger_id,c.defender_id)
   or p_state not in ('completed','forfeit') then
   raise exception 'Ungültiger Spielabschluss';
 end if;
 if p_state='completed' and c.status<>'accepted' then
   raise exception 'Das Forderungsspiel ist nicht angenommen';
 end if;
 select position,qualified into cp,was_qualified
   from public.pyramid_entries where id=c.challenger_id;
 select position into dp from public.pyramid_entries where id=c.defender_id;
 if not was_qualified then
   select count(*) into official_count from public.pyramid_entries
    where ladder_id=c.ladder_id and qualified;
   if p_winner=c.challenger_id then
     -- New entrant wins: insert at defender's CURRENT position, shifting all
     -- lower-ranked people, including any other still-unranked entrants.
     update public.pyramid_entries
       set position=case when id=c.challenger_id then dp else position+1 end
       where ladder_id=c.ladder_id and position between dp and cp;
   else
     -- New entrant loses: take the last official rank (not an arbitrary
     -- provisional slot behind other unfinished qualification matches).
     destination:=official_count+1;
     if cp>destination then
       update public.pyramid_entries
        set position=case when id=c.challenger_id then destination else position+1 end
        where ladder_id=c.ladder_id and position between destination and cp;
     end if;
   end if;
   update public.pyramid_entries
     set qualified=true,provisional=false where id=c.challenger_id;
 elsif p_winner=c.challenger_id and cp>dp then
   update public.pyramid_entries
     set position=case when id=c.challenger_id then dp else position+1 end
     where ladder_id=c.ladder_id and position between dp and cp;
 end if;
 -- Section 5.3: 14-day lock ONLY after the challenger loses, never after
 -- the defender loses an ordinary challenge.
 if p_winner=c.defender_id then
   update public.pyramid_entries set last_loss_at=now() where id=c.challenger_id;
 end if;
 update public.pyramid_entries set provisional=false
   where id in (c.challenger_id,c.defender_id);
 update public.pyramid_challenges
  set status=p_state,winner_id=p_winner,score=p_score,resolved_at=now() where id=p_id;
end;
$$;
revoke all on function private.pyramid_finish(uuid,uuid,text,text)
 from public,anon,authenticated;

-- Initial LK sorting is explicit, audited, and only allowed before seeding.
-- The existing player table contains no LK field, so values must be supplied
-- by a manager; missing LK entries are placed after rated entries.
create or replace function public.pyramid_set_lk(p_entry uuid,p_lk numeric)
 returns void language plpgsql security definer set search_path = '' as $$
declare entry_row public.pyramid_entries%rowtype; ladder_row public.pyramid_ladders%rowtype;
begin
 if not private.can_manage_pyramid() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 select * into strict entry_row from public.pyramid_entries where id=p_entry;
 select * into strict ladder_row from public.pyramid_ladders where id=entry_row.ladder_id for update;
 if ladder_row.seeded_at is not null then
   raise exception 'LK-Werte können nur vor der Startaufstellung geändert werden';
 end if;
 if p_lk is not null and (p_lk<1.0 or p_lk>25.0) then
   raise exception 'LK-Wert muss zwischen 1.0 und 25.0 liegen';
 end if;
 update public.pyramid_entries set lk_rating=p_lk where id=p_entry;
end;
$$;
revoke all on function public.pyramid_set_lk(uuid,numeric) from public,anon;
grant execute on function public.pyramid_set_lk(uuid,numeric) to authenticated;

create or replace function public.pyramid_sort_seed_by_lk(p_ladder uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare l public.pyramid_ladders%rowtype;
begin
 if not private.can_manage_pyramid() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 select * into strict l from public.pyramid_ladders where id=p_ladder for update;
 if l.seeded_at is not null then raise exception 'Startaufstellung bereits abgeschlossen'; end if;
 if exists(select 1 from public.pyramid_challenges
   where ladder_id=p_ladder and status in ('pending','accepted')) then
   raise exception 'Bei offenen Forderungen ist eine Sortierung nicht zulässig';
 end if;
 with ranked as (
   select id,row_number() over(order by lk_rating asc nulls last,position,joined_at,id)::integer as new_pos
   from public.pyramid_entries where ladder_id=p_ladder
 )
 update public.pyramid_entries e set position=r.new_pos from ranked r where r.id=e.id;
end;
$$;
revoke all on function public.pyramid_sort_seed_by_lk(uuid) from public,anon;
grant execute on function public.pyramid_sort_seed_by_lk(uuid) to authenticated;

-- Late participants are now held out of the ranked standings until they
-- win or lose one qualifying challenge. Pre-season seed applicants stay ranked.
create or replace function public.pyramid_approve_join(p_request uuid)
 returns uuid language plpgsql security definer set search_path = '' as $$
declare req public.pyramid_requests%rowtype; l public.pyramid_ladders%rowtype;
        new_id uuid; next_position integer;
begin
 if not private.can_manage_pyramid() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 select * into strict req from public.pyramid_requests where id=p_request;
 select * into strict l from public.pyramid_ladders where id=req.ladder_id for update;
 select * into strict req from public.pyramid_requests where id=p_request for update;
 if req.status<>'pending' then raise exception 'Diese Anfrage ist bereits bearbeitet'; end if;
 select coalesce(max(position),0)+1 into next_position
   from public.pyramid_entries where ladder_id=req.ladder_id;
 insert into public.pyramid_entries(ladder_id,user_id,display_name,position,qualified,provisional)
 values(req.ladder_id,req.user_id,req.display_name,next_position,
   l.seeded_at is null,true)
 returning id into new_id;
 update public.pyramid_requests set status='approved',reviewed_at=now() where id=req.id;
 return new_id;
end;
$$;

-- Central validation used by BOTH a member challenge and an admin-registered
-- privately agreed challenge. Never trust client-provided role or geometry.
create or replace function private.pyramid_issue_challenge(
 p_challenger uuid,p_defender uuid,p_source text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.pyramid_entries%rowtype; c public.pyramid_entries%rowtype;
 l public.pyramid_ladders%rowtype; cr integer; dr integer; cc integer; dc integer;
 allowed boolean; new_id uuid; last_ranked_row integer;
begin
 if p_source not in ('online','private') then raise exception 'Ungültige Forderungsquelle'; end if;
 select * into strict d from public.pyramid_entries where id=p_defender;
 select * into strict l from public.pyramid_ladders where id=d.ladder_id for update;
 select * into strict d from public.pyramid_entries where id=p_defender;
 select * into strict c from public.pyramid_entries where id=p_challenger;
 if c.ladder_id<>d.ladder_id then raise exception 'Forderung nur innerhalb derselben Rangliste'; end if;
 if not l.active or (now() at time zone 'Europe/Berlin')::date not between l.starts_on and l.ends_on then
   raise exception 'Der Forderungszeitraum ist nicht aktiv';
 end if;
 if l.seeded_at is null then raise exception 'Zuerst muss die LK-Startaufstellung abgeschlossen werden'; end if;
 if not d.qualified then raise exception 'Neueinsteiger können erst nach ihrem Einforderungsspiel gefordert werden'; end if;
 if c.id=d.id or c.position<=d.position then
   raise exception 'Nur höher platzierte Personen können gefordert werden';
 end if;
 if c.last_loss_at>now()-interval '14 days' then
   raise exception 'Der Herausforderer muss seine 14-tägige Sperre einhalten';
 end if;
 if exists(select 1 from public.pyramid_challenges where status in ('pending','accepted')
   and (challenger_id=c.id or (status='accepted' and defender_id=c.id))) then
   raise exception 'Der Herausforderer hat noch ein offenes Forderungsspiel';
 end if;
 if exists(select 1 from public.pyramid_challenges where status='accepted'
   and (challenger_id=d.id or defender_id=d.id)) then
   raise exception 'Diese Person hat bereits ein angesetztes Spiel';
 end if;
 cr:=private.pyramid_row(c.position);dr:=private.pyramid_row(d.position);
 cc:=c.position-(cr*(cr+1)/2)-1;dc:=d.position-(dr*(dr+1)/2)-1;
 if not c.qualified then
   select max(private.pyramid_row(position)) into last_ranked_row
     from public.pyramid_entries where ladder_id=l.id and qualified;
   allowed:=last_ranked_row>=1 and dr<last_ranked_row;
 else
   allowed := c.position<=3 or (dr=cr and dc<cc) or (dr=cr-1 and dc>=cc);
 end if;
 if not coalesce(allowed,false) then
   raise exception 'Diese Forderung ist nach den Pyramidenregeln nicht zulässig';
 end if;
 insert into public.pyramid_challenges(ladder_id,challenger_id,defender_id,
  challenger_position_at_start,defender_position_at_start,source)
 values(l.id,c.id,d.id,c.position,d.position,p_source) returning id into new_id;
 -- A durable, retryable email to the DEFENDER is queued with the transaction.
 insert into private.pyramid_auto_decline_notices(challenge_id,kind)
 values(new_id,'challenge_created') on conflict(challenge_id,kind) do nothing;
 return new_id;
end;
$$;
revoke all on function private.pyramid_issue_challenge(uuid,uuid,text)
 from public,anon,authenticated;

create or replace function public.pyramid_challenge(p_defender uuid)
 returns uuid language plpgsql security definer set search_path = '' as $$
declare challenger uuid; target public.pyramid_entries%rowtype;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich' using errcode='42501'; end if;
 select * into strict target from public.pyramid_entries where id=p_defender;
 select id into challenger from public.pyramid_entries
   where ladder_id=target.ladder_id and user_id=auth.uid();
 if challenger is null then raise exception 'Teilnahme an der Rangliste nicht freigeschaltet' using errcode='42501'; end if;
 return private.pyramid_issue_challenge(challenger,p_defender,'online');
end;
$$;

-- Both ordinary acceptance and management of a previously agreed private game
-- use the SAME serialized state transition and cancellation mail queue.
create or replace function private.pyramid_accept_locked(p_challenge uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 if c.status<>'pending' or c.accept_deadline<=now() then
   raise exception 'Annahmefrist abgelaufen oder Forderung nicht mehr offen';
 end if;
 if exists(select 1 from public.pyramid_challenges where id<>c.id and status='accepted'
  and (challenger_id in (c.challenger_id,c.defender_id)
    or defender_id in (c.challenger_id,c.defender_id))) then
   raise exception 'Ein Spieler hat bereits ein angenommenes Forderungsspiel';
 end if;
 update public.pyramid_challenges
   set status='accepted',accepted_at=now(),play_deadline=now()+interval '10 days'
   where id=c.id;
 with rejected as (
  update public.pyramid_challenges
    set status='declined',resolved_at=now(),decline_reason='another_match_accepted'
  where ladder_id=c.ladder_id and id<>c.id and status='pending'
    and (defender_id in (c.challenger_id,c.defender_id)
      or challenger_id in (c.challenger_id,c.defender_id))
  returning id
 ), queued as (
  insert into private.pyramid_auto_decline_notices(challenge_id,kind)
  select id,'auto_decline' from rejected
  on conflict(challenge_id,kind) do nothing returning challenge_id
 )
 update private.pyramid_auto_decline_notices n set sent_at=coalesce(n.sent_at,now()),
   last_error='superseded_by_other_match'
 where n.kind='challenge_created' and n.sent_at is null
   and n.challenge_id in (select challenge_id from queued);
end;
$$;
revoke all on function private.pyramid_accept_locked(uuid) from public,anon,authenticated;

create or replace function public.pyramid_respond(p_challenge uuid,p_accept boolean)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; defender_user uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select user_id into defender_user from public.pyramid_entries where id=c.defender_id;
 if auth.uid() is distinct from defender_user then
   raise exception 'Nur die geforderte Person darf antworten' using errcode='42501';
 end if;
 if c.status<>'pending' or c.accept_deadline<=now() then
   raise exception 'Annahmefrist abgelaufen oder Forderung bereits beantwortet';
 end if;
 if p_accept then
   perform private.pyramid_accept_locked(c.id);
 else
   if not exists(select 1 from public.pyramid_challenges where id<>c.id
     and status in ('pending','accepted')
     and (challenger_id=c.defender_id or defender_id=c.defender_id)) then
     raise exception 'Ablehnen ist nur bei einer anderen offenen Forderung erlaubt';
   end if;
   update public.pyramid_challenges set status='declined',resolved_at=now(),
     decline_reason='player_declined' where id=c.id;
 end if;
end;
$$;

-- Register a privately arranged challenge through the existing management role.
-- 'Already accepted' is an explicit admin attestation of prior consent.
create or replace function public.pyramid_register_private_challenge(
 p_challenger uuid,p_defender uuid,p_already_accepted boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare id uuid;
begin
 if not private.can_manage_pyramid() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 id:=private.pyramid_issue_challenge(p_challenger,p_defender,'private');
 if p_already_accepted then perform private.pyramid_accept_locked(id); end if;
 return id;
end;
$$;
revoke all on function public.pyramid_register_private_challenge(uuid,uuid,boolean)
 from public,anon;
grant execute on function public.pyramid_register_private_challenge(uuid,uuid,boolean) to authenticated;
revoke all on function public.pyramid_challenge(uuid),
 public.pyramid_respond(uuid,boolean) from public,anon;
grant execute on function public.pyramid_challenge(uuid),
 public.pyramid_respond(uuid,boolean) to authenticated;

-- One queue, one token-gated Gmail worker, two mail types.
create or replace function public.claim_pyramid_notification()
 returns table(id uuid,kind text,recipient_email text,challenger_name text,
  defender_name text,ladder_title text,season_label text,challenge_status text)
 language plpgsql security definer set search_path = '' as $$
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then
   raise exception 'Nur der E-Mail-Service darf senden' using errcode='42501';
 end if;
 return query with due as (
  select n.id from private.pyramid_auto_decline_notices n
  where n.sent_at is null and n.attempts<10 and n.next_attempt_at<=now()
   and (n.claimed_until is null or n.claimed_until<now())
  order by case when n.kind='auto_decline' then 0 else 1 end,n.created_at
  limit 1 for update skip locked
 ), claimed as (
  update private.pyramid_auto_decline_notices n
    set claimed_until=now()+interval '3 minutes',attempts=n.attempts+1
  from due where n.id=due.id returning n.id,n.challenge_id,n.kind
 )
 select cl.id,cl.kind::text,
  coalesce(nullif(btrim(recipient_user.email),''),nullif(btrim(recipient_profile.email),''))::text,
  ch.display_name::text,df.display_name::text,l.title::text,l.season_label::text,
  c.status::text
 from claimed cl
 join public.pyramid_challenges c on c.id=cl.challenge_id
 join public.pyramid_entries ch on ch.id=c.challenger_id
 join public.pyramid_entries df on df.id=c.defender_id
 join public.pyramid_ladders l on l.id=c.ladder_id
 left join auth.users recipient_user on recipient_user.id=
  case when cl.kind='challenge_created' then df.user_id else ch.user_id end
 left join public.profiles recipient_profile on recipient_profile.id=
  case when cl.kind='challenge_created' then df.user_id else ch.user_id end;
end;
$$;
revoke all on function public.claim_pyramid_notification()
 from public,anon,authenticated;
grant execute on function public.claim_pyramid_notification() to service_role;

-- Keep all existing seasonal dates; PDF standard summer/winter ranges are
-- suggested in the form, never silently imposed on an existing TSV season.
