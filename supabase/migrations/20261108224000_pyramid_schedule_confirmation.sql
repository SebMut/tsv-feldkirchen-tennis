-- Only the challenger proposes or changes a match date. The challenged
-- player must explicitly accept each proposal before it becomes binding.

alter table public.pyramid_challenges
  add column if not exists scheduled_confirmed_at timestamptz;

create or replace function public.pyramid_schedule_match(p_challenge uuid,p_date timestamptz)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; own uuid; deadline timestamptz;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select id into own from public.pyramid_entries where user_id=auth.uid() and ladder_id=c.ladder_id;
 if own is null or own<>c.challenger_id then
   raise exception 'Nur der Herausforderer darf den Spieltermin eintragen oder ändern'
   using errcode='42501';
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
   scheduled_confirmed_at=null,play_deadline=deadline where id=c.id;
end;
$$;
revoke all on function public.pyramid_schedule_match(uuid,timestamptz) from public,anon;
grant execute on function public.pyramid_schedule_match(uuid,timestamptz) to authenticated;

create or replace function public.pyramid_confirm_schedule(p_challenge uuid)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; own uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select id into own from public.pyramid_entries where user_id=auth.uid() and ladder_id=c.ladder_id;
 if own is null or own<>c.defender_id then
   raise exception 'Nur der Geforderte darf den vorgeschlagenen Termin akzeptieren'
   using errcode='42501';
 end if;
 if c.status<>'accepted' or c.scheduled_for is null then
   raise exception 'Es liegt kein bestätigbarer Spieltermin vor';
 end if;
 if c.scheduled_for<now()-interval '15 minutes' then
   raise exception 'Ein bereits vergangener Termin kann nicht akzeptiert werden';
 end if;
 update public.pyramid_challenges set scheduled_confirmed_at=now() where id=c.id;
end;
$$;
revoke all on function public.pyramid_confirm_schedule(uuid) from public,anon;
grant execute on function public.pyramid_confirm_schedule(uuid) to authenticated;

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
 if c.status<>'accepted' or c.scheduled_for is null or c.scheduled_confirmed_at is null
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
