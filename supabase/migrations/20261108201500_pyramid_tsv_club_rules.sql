-- Vereinseigene TSV-Forderungsregeln (supersede source-PDF details).
-- Dependency: 20261108200000_pyramid_pdf_rules_completion.sql.
-- Preserve existing ladder seasons; no changes to unrelated teams or users.
alter table public.pyramid_entries
 add column last_win_at timestamptz,
 add column neutralized_at timestamptz,
 add column neutralized_reason text check(neutralized_reason in ('injury','illness','vacation','other')),
 add column neutral_shifted_at timestamptz,
 add column neutral_shift_count integer not null default 0 check(neutral_shift_count>=0);
alter table public.pyramid_challenges
 add column scheduled_for timestamptz,
 add column scheduled_at timestamptz,
 add column refusal_reason text,
 add column refusal_submitted_at timestamptz;
-- The old Oberrad 10-day automatic forfeiture is explicitly not TSV rules.
select cron.unschedule('tsv-pyramid-acceptance-expiry');
-- An existing pending challenge still counts as listed / blocks both people.
-- No member may bypass this by creating a second parallel request.
create or replace function private.pyramid_issue_challenge(
 p_challenger uuid,p_defender uuid,p_source text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.pyramid_entries%rowtype; c public.pyramid_entries%rowtype;
 l public.pyramid_ladders%rowtype; cr integer; dr integer; cc integer; dc integer;
 allowed boolean; new_id uuid;
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
 if l.seeded_at is null then raise exception 'Startaufstellung zuerst abschließen'; end if;
 if not d.qualified then raise exception 'Noch nicht eingestiegene Spieler können nicht gefordert werden'; end if;
 if c.id=d.id or c.position<=d.position then
   raise exception 'Nur höher platzierte Personen können gefordert werden';
 end if;
 if c.neutralized_at is not null or d.neutralized_at is not null then
   raise exception 'Ein Spieler ist momentan neutralisiert (Abwesenheit)';
 end if;
 -- The loser may challenge again after 3 days. The winner is shielded
 -- against incoming requests for 3 days; no blanket 14-day lock.
 if c.last_loss_at>now()-interval '3 days' then
   raise exception 'Nach einer Niederlage darf erst nach drei Tagen erneut gefordert werden';
 end if;
 if d.last_win_at>now()-interval '3 days' then
   raise exception 'Der Sieger ist drei Tage gegen neue Forderungen geschützt';
 end if;
 -- The challenger cannot challenge the SAME defender until two weeks
 -- after their last concluded match, independent of who won.
 if exists(select 1 from public.pyramid_challenges pc
    where pc.challenger_id=c.id and pc.defender_id=d.id and pc.resolved_at>now()-interval '14 days'
      and pc.status in ('completed','forfeit')) then
   raise exception 'Derselbe Gegner darf erst zwei Wochen nach dem Spiel erneut gefordert werden';
 end if;
 if exists(select 1 from public.pyramid_challenges pc where pc.status in ('pending','accepted')
    and (pc.challenger_id in (c.id,d.id) or pc.defender_id in (c.id,d.id))) then
   raise exception 'Einer der Spieler steht bereits in der Forderungsliste';
 end if;
 cr:=private.pyramid_row(c.position);dr:=private.pyramid_row(d.position);
 cc:=c.position-(cr*(cr+1)/2)-1;dc:=d.position-(dr*(dr+1)/2)-1;
 if not c.qualified then
   -- TSV: first challenge can be against ANY RANKED player.
   allowed:=d.qualified;
 else
   allowed := c.position<=3 or (dr=cr and dc<cc) or (dr=cr-1 and dc>=cc);
 end if;
 if not coalesce(allowed,false) then
   raise exception 'Diese Forderung ist nach den Pyramidenregeln nicht zulässig';
 end if;
 insert into public.pyramid_challenges(ladder_id,challenger_id,defender_id,
   challenger_position_at_start,defender_position_at_start,source)
 values(l.id,c.id,d.id,c.position,d.position,p_source) returning id into new_id;
 insert into private.pyramid_auto_decline_notices(challenge_id,kind)
 values(new_id,'challenge_created') on conflict(challenge_id,kind) do nothing;
 return new_id;
end;
$$;
revoke all on function private.pyramid_issue_challenge(uuid,uuid,text) from public,anon,authenticated;

-- Result processing with TSV post-match protections.
-- This function keeps the qualifying-player insertion behaviour of the prior migration.
create or replace function private.pyramid_finish(p_id uuid,p_winner uuid,p_state text,p_score text)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; cp integer; dp integer;
        was_qualified boolean; official_count integer; destination integer;
        loser uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_id for update;
 if c.status not in ('pending','accepted') or p_winner not in (c.challenger_id,c.defender_id)
   or p_state not in ('completed','forfeit') then
   raise exception 'Ungültiger Spielabschluss';
 end if;
 if p_state='completed' and c.status <> 'accepted' then
   raise exception 'Das Forderungsspiel ist nicht angenommen';
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

-- TSV: acceptance is separate from binding appointment. Players must enter
-- their agreed appointment within 7 days of the request, and play within
-- 10 days of when it was agreed.
create or replace function public.pyramid_schedule_match(p_challenge uuid,p_date timestamptz)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; own uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select id into own from public.pyramid_entries where user_id=auth.uid() and ladder_id=c.ladder_id;
 if not private.can_manage_pyramid() and own not in (c.challenger_id,c.defender_id) then
   raise exception 'Nur die Spielpartner oder die Ranglistenverwaltung dürfen einen Termin eintragen' using errcode='42501';
 end if;
 if c.status<>'accepted' then raise exception 'Bitte Forderung zuerst annehmen'; end if;
 if c.refusal_submitted_at is not null then raise exception 'Forderung wird durch die Verwaltung geprüft'; end if;
 if p_date is null or p_date<now()-interval '15 minutes' then raise exception 'Spieltermin muss in der Zukunft liegen'; end if;
 if p_date>now()+interval '10 days' then raise exception 'Spiel innerhalb von 10 Tagen nach Terminvereinbarung austragen'; end if;
 if now()>c.created_at+interval '7 days' and not private.can_manage_pyramid() then
   raise exception '7-Tage-Frist zur Terminvereinbarung überschritten: Ranglistenverwaltung kontaktieren';
 end if;
 update public.pyramid_challenges set scheduled_for=p_date,scheduled_at=now(),
   play_deadline=now()+interval '10 days' where id=c.id;
end;
$$;
revoke all on function public.pyramid_schedule_match(uuid,timestamptz) from public,anon;
grant execute on function public.pyramid_schedule_match(uuid,timestamptz) to authenticated;

-- Declining without good cause must not silently cancel a registered
-- challenge. Record a reason and let a manager decide validity or forfeit.
create or replace function public.pyramid_submit_refusal(p_challenge uuid,p_reason text)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; defender_user uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select user_id into defender_user from public.pyramid_entries where id=c.defender_id;
 if auth.uid() is distinct from defender_user then
   raise exception 'Nur die geforderte Person darf eine Begründung einreichen' using errcode='42501';
 end if;
 if c.status not in ('pending','accepted') then raise exception 'Forderung nicht mehr offen'; end if;
 if char_length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Begründung mit mindestens 10 Zeichen erforderlich'; end if;
 update public.pyramid_challenges set refusal_reason=left(btrim(p_reason),1000),
   refusal_submitted_at=now() where id=c.id;
end;
$$;
revoke all on function public.pyramid_submit_refusal(uuid,text) from public,anon;
grant execute on function public.pyramid_submit_refusal(uuid,text) to authenticated;

create or replace function public.pyramid_resolve_refusal(p_challenge uuid,p_valid boolean)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype;
begin
 if not private.can_manage_pyramid() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 if c.status not in ('pending','accepted') or c.refusal_submitted_at is null then
   raise exception 'Keine offene begründete Absage vorhanden';
 end if;
 if p_valid then
   update public.pyramid_challenges set status='cancelled',resolved_at=now(),
     decline_reason='player_declined' where id=c.id;
 else
   perform private.pyramid_finish(c.id,c.challenger_id,'forfeit',null);
 end if;
end;
$$;
revoke all on function public.pyramid_resolve_refusal(uuid,boolean) from public,anon;
grant execute on function public.pyramid_resolve_refusal(uuid,boolean) to authenticated;

-- No-show can be confirmed only by authorized management after the appointment.
create or replace function public.pyramid_record_no_show(p_challenge uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype;
begin
 if not private.can_manage_pyramid() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 if c.status<>'accepted' or c.scheduled_for is null or c.scheduled_for>now() then
   raise exception 'Kein bereits verstrichener bestätigter Spieltermin';
 end if;
 perform private.pyramid_finish(c.id,c.challenger_id,'forfeit',null);
end;
$$;
revoke all on function public.pyramid_record_no_show(uuid) from public,anon;
grant execute on function public.pyramid_record_no_show(uuid) to authenticated;

-- Legacy response method may accept a valid registered challenge, but cannot
-- bypass evidence and management decision for refusal.
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
 if c.status<>'pending' then raise exception 'Forderung bereits beantwortet oder abgeschlossen'; end if;
 if c.refusal_submitted_at is not null then
   raise exception 'Begründete Absage wartet auf Entscheidung der Ranglistenverwaltung';
 end if;
 if not p_accept then
   raise exception 'Bitte begründete Absage einreichen; Verwaltung prüft triftigen Grund';
 end if;
 perform private.pyramid_accept_locked(c.id);
end;
$$;

-- TSV neutrality: player self-service or authorized manager.
-- Only injury causes 4-week repeated rank movement.
create or replace function public.pyramid_set_neutralized(p_entry uuid,p_reason text)
 returns void language plpgsql security definer set search_path = '' as $$
declare e public.pyramid_entries%rowtype;
begin
 select * into strict e from public.pyramid_entries where id=p_entry;
 perform 1 from public.pyramid_ladders where id=e.ladder_id for update;
 select * into strict e from public.pyramid_entries where id=p_entry for update;
 if not private.can_manage_pyramid() and e.user_id is distinct from auth.uid() then
   raise exception 'Nur der Teilnehmer oder die Verwaltung darf neutralisieren' using errcode='42501';
 end if;
 if p_reason is not null and p_reason not in ('injury','illness','vacation','other') then
   raise exception 'Ungültiger Grund';
 end if;
 if p_reason is not null and exists(select 1 from public.pyramid_challenges
   where status in ('pending','accepted') and (challenger_id=e.id or defender_id=e.id)) then
   raise exception 'Vor dem Neutralisieren muss das eingetragene Forderungsspiel abgeschlossen werden';
 end if;
 update public.pyramid_entries
  set neutralized_at=case when p_reason is null then null when neutralized_at is null or neutralized_reason is distinct from p_reason then now() else neutralized_at end,
   neutralized_reason=p_reason,
   neutral_shifted_at=case when p_reason is null then null when neutralized_at is null or neutralized_reason is distinct from p_reason then null else neutral_shifted_at end,
   neutral_shift_count=case when p_reason is null or neutralized_at is null or neutralized_reason is distinct from p_reason then 0 else neutral_shift_count end
 where id=e.id;
end;
$$;
revoke all on function public.pyramid_set_neutralized(uuid,text) from public,anon;
grant execute on function public.pyramid_set_neutralized(uuid,text) to authenticated;

create or replace function private.pyramid_process_injury_neutrality()
 returns integer language plpgsql security definer set search_path = '' as $$
declare l record; e record; target integer; last_pos integer; steps integer:=0;
begin
 for l in select distinct ladder_id from public.pyramid_entries
  where neutralized_reason='injury' and neutralized_at is not null loop
  perform 1 from public.pyramid_ladders where id=l.ladder_id for update;
  for e in select id,position,neutralized_at,neutral_shift_count from public.pyramid_entries
   where ladder_id=l.ladder_id and neutralized_reason='injury' and neutralized_at is not null
   order by position,id for update loop
   if now()<e.neutralized_at+((e.neutral_shift_count+1)*interval '28 days') then continue; end if;
   select max(position) into last_pos from public.pyramid_entries
    where ladder_id=l.ladder_id and qualified;
   if last_pos is null then continue; end if;
   -- First four weeks: bottom of current row; later four-week periods: the
   -- bottom of the next lower populated row, until the last ranked place.
   select greatest(e.position,least(last_pos,
    ((private.pyramid_row(e.position)+1+
      case when e.neutral_shift_count=0 then 0 else 1 end)
    *(private.pyramid_row(e.position)+2+
      case when e.neutral_shift_count=0 then 0 else 1 end))/2)) into target;
   if target>e.position then
     update public.pyramid_entries
       set position=case when id=e.id then target else position-1 end
       where ladder_id=l.ladder_id and position between e.position and target;
   end if;
   update public.pyramid_entries set neutral_shift_count=e.neutral_shift_count+1,
     neutral_shifted_at=now() where id=e.id;
   steps:=steps+1;
  end loop;
 end loop;
 return steps;
end;
$$;
revoke all on function private.pyramid_process_injury_neutrality() from public,anon,authenticated;
select cron.schedule('tsv-pyramid-neutral-injury','30 3 * * *',
 'select private.pyramid_process_injury_neutrality();');

-- TSV-specific constraint on an initial result: a real scheduled match is
-- recommended but managers can record historical private games too.
-- Existing protected result RPC remains intact.
