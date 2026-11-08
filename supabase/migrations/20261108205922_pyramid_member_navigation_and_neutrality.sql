-- Member navigation rules requested for the TSV Forderungspyramide.
-- The frontend mirrors these checks, but the database remains authoritative.

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
 -- Both players may enter the first agreed date. Once a date exists, the
 -- challenged player cannot replace it; only challenger or manager may edit.
 if not private.can_manage_pyramid() and c.scheduled_for is not null
    and own=c.defender_id then
   raise exception 'Ein eingetragener Spieltermin kann nur vom Herausforderer oder Ranglistenwart geändert werden'
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
   play_deadline=deadline where id=c.id;
end;
$$;
revoke all on function public.pyramid_schedule_match(uuid,timestamptz) from public,anon;
grant execute on function public.pyramid_schedule_match(uuid,timestamptz) to authenticated;

-- After 28 days every neutralization ends. A returning member moves to the
-- last position of the current pyramid row. If already last, move to the
-- middle position of the following row. Existing positions stay contiguous.
create or replace function private.pyramid_process_injury_neutrality()
 returns integer language plpgsql security definer set search_path = '' as $$
declare e record; row_number integer; row_end integer; target integer;
        affected integer:=0;
begin
 for e in
   select id,ladder_id,position
   from public.pyramid_entries
   where neutralized_at is not null
     and neutralized_at<=now()-interval '28 days'
   order by ladder_id,position
   for update
 loop
   perform 1 from public.pyramid_ladders where id=e.ladder_id for update;
   row_number:=ceil((sqrt(8*e.position+1)-1)/2.0)::integer;
   row_end:=row_number*(row_number+1)/2;
   if e.position<row_end then
     target:=row_end;
   else
     target:=row_end+1+floor(row_number/2.0)::integer;
   end if;
   -- Do not create gaps when the next row is not fully occupied yet.
   select least(target,coalesce(max(position),e.position)) into target
     from public.pyramid_entries where ladder_id=e.ladder_id;
   if target>e.position then
     update public.pyramid_entries set position=position-1
       where ladder_id=e.ladder_id and position>e.position and position<=target;
   end if;
   update public.pyramid_entries
     set position=target,neutralized_at=null,neutralized_reason=null,
         neutral_shifted_at=now(),neutral_shift_count=neutral_shift_count+1
     where id=e.id;
   affected:=affected+1;
 end loop;
 return affected;
end;
$$;
revoke all on function private.pyramid_process_injury_neutrality()
 from public,anon,authenticated;
