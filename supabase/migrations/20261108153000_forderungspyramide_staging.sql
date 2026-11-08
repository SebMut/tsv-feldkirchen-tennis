-- Forderungspyramide (staging only). DO NOT apply to production before release approval.
-- Uses existing auth.users, profiles and optional players; no second authentication system.
create table public.pyramid_ladders (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 3 and 100),
 season_label text not null check (char_length(btrim(season_label)) between 3 and 70),
 starts_on date not null,
 ends_on date not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 constraint pyramid_ladders_date_order check (ends_on >= starts_on)
);
create table public.pyramid_entries (
 id uuid primary key default gen_random_uuid(),
 ladder_id uuid not null references public.pyramid_ladders(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 player_id uuid references public.players(id) on delete set null,
 display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
 position integer not null check (position > 0),
 provisional boolean not null default true,
 last_loss_at timestamptz,
 joined_at timestamptz not null default now(),
 unique(ladder_id,user_id),
 constraint pyramid_entries_unique_position unique(ladder_id,position) deferrable initially deferred
);
create table public.pyramid_requests (
 id uuid primary key default gen_random_uuid(),
 ladder_id uuid not null references public.pyramid_ladders(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 unique(ladder_id,user_id)
);
create table public.pyramid_challenges (
 id uuid primary key default gen_random_uuid(),
 ladder_id uuid not null references public.pyramid_ladders(id) on delete cascade,
 challenger_id uuid not null references public.pyramid_entries(id),
 defender_id uuid not null references public.pyramid_entries(id),
 challenger_position_at_start integer not null,
 defender_position_at_start integer not null,
 status text not null default 'pending'
   check (status in ('pending','accepted','declined','completed','forfeit','cancelled')),
 created_at timestamptz not null default now(),
 accept_deadline timestamptz not null default (now() + interval '10 days'),
 accepted_at timestamptz,
 play_deadline timestamptz,
 resolved_at timestamptz,
 winner_id uuid references public.pyramid_entries(id),
 score text,
 constraint pyramid_challenge_different_players check (challenger_id <> defender_id)
);
create index pyramid_challenges_open_idx on public.pyramid_challenges(ladder_id,status,accept_deadline);
create index pyramid_challenges_challenger_idx on public.pyramid_challenges(challenger_id,status);
create index pyramid_challenges_defender_idx on public.pyramid_challenges(defender_id,status);

alter table public.pyramid_ladders enable row level security;
alter table public.pyramid_entries enable row level security;
alter table public.pyramid_requests enable row level security;
alter table public.pyramid_challenges enable row level security;
revoke all on public.pyramid_ladders, public.pyramid_entries, public.pyramid_requests,
 public.pyramid_challenges from public,anon,authenticated;
grant select on public.pyramid_ladders, public.pyramid_entries, public.pyramid_requests,
 public.pyramid_challenges to authenticated;
grant insert,update on public.pyramid_ladders to authenticated;

-- SECURITY DEFINER is essential here to avoid recursive RLS on pyramid_entries.
-- This helper is in private, not an exposed API schema.
create function private.can_view_pyramid(p_ladder_id uuid) returns boolean
 language sql stable security definer set search_path = '' as $$
 select private.is_super_admin() or exists (
   select 1 from public.pyramid_entries e
   where e.ladder_id=p_ladder_id and e.user_id=(select auth.uid())
 );
$$;
revoke all on function private.can_view_pyramid(uuid) from public,anon;
grant execute on function private.can_view_pyramid(uuid) to authenticated;

create policy pyramid_ladders_read on public.pyramid_ladders for select to authenticated
 using (active or private.is_super_admin());
create policy pyramid_ladders_admin_insert on public.pyramid_ladders for insert to authenticated
 with check (private.is_super_admin());
create policy pyramid_ladders_admin_update on public.pyramid_ladders for update to authenticated
 using (private.is_super_admin()) with check (private.is_super_admin());
create policy pyramid_entries_read on public.pyramid_entries for select to authenticated
 using (private.can_view_pyramid(ladder_id));
create policy pyramid_requests_read on public.pyramid_requests for select to authenticated
 using (user_id=(select auth.uid()) or private.is_super_admin());
create policy pyramid_challenges_read on public.pyramid_challenges for select to authenticated
 using (private.can_view_pyramid(ladder_id));

-- Ranked rows follow the geometry in the reference PDF (row 0: 1; row 1: 2,3).
create function private.pyramid_row(p_position integer) returns integer
 language sql immutable set search_path = '' as $$
 select floor((sqrt(8.0*p_position-7.0)-1.0)/2.0)::integer
$$;
revoke all on function private.pyramid_row(integer) from public,anon;
grant execute on function private.pyramid_row(integer) to authenticated;

-- This internal operation assumes the parent ladder row is already locked.
-- A deferrable unique position constraint makes the rank shift atomic.
create function private.pyramid_finish(p_id uuid,p_winner uuid,p_state text,p_score text)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; cp integer; dp integer; loser uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_id for update;
 if c.status not in ('pending','accepted') or p_winner not in (c.challenger_id,c.defender_id)
   or p_state not in ('completed','forfeit') then
   raise exception 'Ungültiger Spielabschluss';
 end if;
 if p_state='completed' and c.status <> 'accepted' then
   raise exception 'Das Forderungsspiel ist nicht angenommen';
 end if;
 loser := case when p_winner=c.challenger_id then c.defender_id else c.challenger_id end;
 select position into cp from public.pyramid_entries where id=c.challenger_id;
 select position into dp from public.pyramid_entries where id=c.defender_id;
 if p_winner=c.challenger_id and cp>dp then
   update public.pyramid_entries
     set position=case when id=c.challenger_id then dp else position+1 end
     where ladder_id=c.ladder_id and position between dp and cp;
 end if;
 update public.pyramid_entries set last_loss_at=now(), provisional=false where id=loser;
 update public.pyramid_entries set provisional=false where id=p_winner;
 update public.pyramid_challenges set status=p_state,winner_id=p_winner,
   score=p_score,resolved_at=now() where id=p_id;
end;
$$;
revoke all on function private.pyramid_finish(uuid,uuid,text,text) from public,anon,authenticated;

-- Join requests are self-service, but only a SuperAdmin may approve.
create function public.pyramid_request_join(p_ladder uuid,p_name text)
 returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich' using errcode='42501'; end if;
 if char_length(btrim(coalesce(p_name,''))) not between 2 and 80 then
   raise exception 'Bitte einen Namen mit 2 bis 80 Zeichen angeben';
 end if;
 if not exists(select 1 from public.pyramid_ladders where id=p_ladder and active) then
   raise exception 'Diese Rangliste ist nicht für Anmeldungen geöffnet';
 end if;
 if exists(select 1 from public.pyramid_entries where ladder_id=p_ladder and user_id=auth.uid()) then
   raise exception 'Du bist bereits Teilnehmer dieser Rangliste';
 end if;
 insert into public.pyramid_requests(ladder_id,user_id,display_name)
 values(p_ladder,auth.uid(),btrim(p_name))
 on conflict(ladder_id,user_id) do update set display_name=excluded.display_name,
   status='pending',reviewed_at=null
 where public.pyramid_requests.status='rejected';
 if not found then raise exception 'Für diese Rangliste besteht bereits eine Anfrage'; end if;
end;
$$;
create function public.pyramid_approve_join(p_request uuid)
 returns uuid language plpgsql security definer set search_path = '' as $$
declare req public.pyramid_requests%rowtype; new_id uuid; next_position integer;
begin
 if not private.is_super_admin() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 select * into strict req from public.pyramid_requests where id=p_request;
 perform 1 from public.pyramid_ladders where id=req.ladder_id for update;
 select * into strict req from public.pyramid_requests where id=p_request for update;
 if req.status<>'pending' then raise exception 'Diese Anfrage ist bereits bearbeitet'; end if;
 select coalesce(max(position),0)+1 into next_position
   from public.pyramid_entries where ladder_id=req.ladder_id;
 insert into public.pyramid_entries(ladder_id,user_id,display_name,position)
 values(req.ladder_id,req.user_id,req.display_name,next_position) returning id into new_id;
 update public.pyramid_requests set status='approved',reviewed_at=now() where id=req.id;
 return new_id;
end;
$$;

-- Admin initialization ordering, blocked while any challenge is open.
create function public.pyramid_move_entry(p_entry uuid,p_delta integer)
 returns void language plpgsql security definer set search_path = '' as $$
declare e public.pyramid_entries%rowtype; swap_id uuid;
begin
 if not private.is_super_admin() then raise exception 'Keine Berechtigung' using errcode='42501'; end if;
 if p_delta not in (-1,1) then raise exception 'Nur ein Rang je Schritt möglich'; end if;
 select * into strict e from public.pyramid_entries where id=p_entry;
 perform 1 from public.pyramid_ladders where id=e.ladder_id for update;
 select * into strict e from public.pyramid_entries where id=p_entry for update;
 if exists(select 1 from public.pyramid_challenges where ladder_id=e.ladder_id
   and status in ('pending','accepted')) then
   raise exception 'Bei offenen Forderungen können Plätze nicht manuell geändert werden';
 end if;
 select id into swap_id from public.pyramid_entries
   where ladder_id=e.ladder_id and position=e.position+p_delta;
 if swap_id is null then raise exception 'Kein Nachbarplatz vorhanden'; end if;
 update public.pyramid_entries set position=case when id=e.id then e.position+p_delta
   else e.position end where id in (e.id,swap_id);
end;
$$;

create function public.pyramid_challenge(p_defender uuid)
 returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.pyramid_entries%rowtype; c public.pyramid_entries%rowtype;
 l public.pyramid_ladders%rowtype; cr integer; dr integer; cc integer; dc integer; allowed boolean; new_id uuid;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich' using errcode='42501'; end if;
 select * into strict d from public.pyramid_entries where id=p_defender;
 select * into strict l from public.pyramid_ladders where id=d.ladder_id for update;
 select * into strict d from public.pyramid_entries where id=p_defender;
 select * into c from public.pyramid_entries where ladder_id=d.ladder_id and user_id=auth.uid();
 if c.id is null then raise exception 'Du bist in dieser Rangliste nicht freigeschaltet' using errcode='42501'; end if;
 if not l.active or (now() at time zone 'Europe/Berlin')::date not between l.starts_on and l.ends_on then
   raise exception 'Der Forderungszeitraum ist nicht aktiv';
 end if;
 if c.id=d.id or c.position<=d.position then raise exception 'Nur höher platzierte Personen können gefordert werden'; end if;
 if c.last_loss_at>now()-interval '14 days' then raise exception 'Nach einer Niederlage gilt eine Sperre von 14 Tagen'; end if;
 if exists(select 1 from public.pyramid_challenges where status in ('pending','accepted')
    and (challenger_id=c.id or (status='accepted' and defender_id=c.id))) then
   raise exception 'Du hast noch eine offene Forderung';
 end if;
 if exists(select 1 from public.pyramid_challenges where status='accepted'
    and (challenger_id=d.id or defender_id=d.id)) then
   raise exception 'Diese Person hat bereits ein angesetztes Spiel';
 end if;
 cr:=private.pyramid_row(c.position); dr:=private.pyramid_row(d.position);
 cc:=c.position-(cr*(cr+1)/2)-1; dc:=d.position-(dr*(dr+1)/2)-1;
 allowed := c.position<=3
   or (dr=cr and dc<cc)
   or (dr=cr-1 and dc>=cc)
   or (c.provisional and dr=greatest(0,cr-1));
 if not allowed then raise exception 'Diese Forderung ist nach den Pyramidenregeln nicht erlaubt'; end if;
 insert into public.pyramid_challenges(ladder_id,challenger_id,defender_id,
   challenger_position_at_start,defender_position_at_start)
 values(l.id,c.id,d.id,c.position,d.position) returning id into new_id;
 return new_id;
end;
$$;

create function public.pyramid_respond(p_challenge uuid,p_accept boolean)
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
 if c.status<>'pending' or c.accept_deadline<=now() then raise exception 'Annahmefrist abgelaufen oder bereits beantwortet'; end if;
 if p_accept then
   if exists(select 1 from public.pyramid_challenges where id<>c.id and status='accepted'
     and (challenger_id=c.defender_id or defender_id=c.defender_id)) then
     raise exception 'Du hast bereits ein angenommenes Forderungsspiel';
   end if;
   update public.pyramid_challenges set status='accepted',
     accepted_at=now(),play_deadline=now()+interval '10 days' where id=c.id;
 else
   if not exists(select 1 from public.pyramid_challenges where id<>c.id
     and status in ('pending','accepted')
     and (challenger_id=c.defender_id or defender_id=c.defender_id)) then
     raise exception 'Ablehnen ist nur bei einer anderen offenen Forderung erlaubt';
   end if;
   update public.pyramid_challenges set status='declined',resolved_at=now() where id=c.id;
 end if;
end;
$$;

-- Only finished tennis scores are accepted; score is always from the winner's perspective.
create function private.pyramid_valid_winning_score(p_score text) returns boolean
 language plpgsql immutable set search_path = '' as $
declare v_set text; v_parts text[]; v_a integer; v_b integer;
        v_count integer:=0; v_wins_a integer:=0; v_wins_b integer:=0;
begin
 if p_score is null or p_score !~ '^[0-9]{1,2}:[0-9]{1,2}(, ?[0-9]{1,2}:[0-9]{1,2}){1,2}p_challenge uuid,p_score text,p_winner uuid default null)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; own_entry uuid; w uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select id into own_entry from public.pyramid_entries where ladder_id=c.ladder_id and user_id=auth.uid();
 w:=coalesce(p_winner,own_entry);
 if c.status<>'accepted' then raise exception 'Das Forderungsspiel ist nicht offen'; end if;
 if not private.is_super_admin() and (w is distinct from own_entry
     or own_entry not in (c.challenger_id,c.defender_id)) then
   raise exception 'Nur der Sieger darf sein Ergebnis melden' using errcode='42501';
 end if;
 if w not in (c.challenger_id,c.defender_id) then raise exception 'Ungültiger Sieger'; end if;
 if p_score is null or char_length(p_score)>80
   or not private.pyramid_valid_winning_score(p_score) then
   raise exception 'Ergebnisformat: 6:4, 6:3 oder 6:4, 4:6, 10:8';
 end if;
 perform private.pyramid_finish(c.id,w,'completed',p_score);
end;
$$;

-- pg_cron is already installed in the dedicated TSV project.
create function public.pyramid_settle_expired()
 returns integer language plpgsql security definer set search_path = '' as $$
declare l record; c record; n integer:=0;
begin
 for l in select distinct ladder_id from public.pyramid_challenges
    where status='pending' and accept_deadline<=now() loop
   perform 1 from public.pyramid_ladders where id=l.ladder_id for update;
   for c in select id,challenger_id from public.pyramid_challenges
     where ladder_id=l.ladder_id and status='pending' and accept_deadline<=now()
     order by created_at,id for update loop
     -- Missing the 10-day acceptance window counts as a defender loss.
     perform private.pyramid_finish(c.id,c.challenger_id,'forfeit',null);
     n:=n+1;
   end loop;
 end loop;
 return n;
end;
$$;
revoke all on function public.pyramid_settle_expired() from public,anon,authenticated;
grant execute on function public.pyramid_settle_expired() to postgres,service_role;
select cron.schedule('tsv-pyramid-acceptance-expiry','15 * * * *','select public.pyramid_settle_expired()');

-- RPC entry points must not remain callable by anon/PUBLIC.
revoke all on function public.pyramid_request_join(uuid,text),
 public.pyramid_approve_join(uuid), public.pyramid_move_entry(uuid,integer),
 public.pyramid_challenge(uuid), public.pyramid_respond(uuid,boolean),
 public.pyramid_report_result(uuid,text,uuid)
 from public,anon;
grant execute on function public.pyramid_request_join(uuid,text),
 public.pyramid_approve_join(uuid), public.pyramid_move_entry(uuid,integer),
 public.pyramid_challenge(uuid), public.pyramid_respond(uuid,boolean),
 public.pyramid_report_result(uuid,text,uuid) to authenticated;
 then
   return false;
 end if;
 for v_set in select regexp_split_to_table(p_score, ',\s*') loop
   v_count:=v_count+1;
   v_parts:=string_to_array(v_set,':');
   v_a:=v_parts[1]::integer;
   v_b:=v_parts[2]::integer;
   if v_count<=2 then
     if not ((greatest(v_a,v_b)=6 and least(v_a,v_b)<=4)
       or (greatest(v_a,v_b)=7 and least(v_a,v_b) in (5,6))) then return false; end if;
   elsif greatest(v_a,v_b)<10 or abs(v_a-v_b)<2 then return false;
   end if;
   if v_a>v_b then v_wins_a:=v_wins_a+1; else v_wins_b:=v_wins_b+1; end if;
 end loop;
 return (v_count=2 and v_wins_a=2 and v_wins_b=0)
    or (v_count=3 and v_wins_a=2 and v_wins_b=1);
end;
$;
revoke all on function private.pyramid_valid_winning_score(text) from public,anon,authenticated;

create function public.pyramid_report_result(p_challenge uuid,p_score text,p_winner uuid default null)
 returns void language plpgsql security definer set search_path = '' as $$
declare c public.pyramid_challenges%rowtype; own_entry uuid; w uuid;
begin
 select * into strict c from public.pyramid_challenges where id=p_challenge;
 perform 1 from public.pyramid_ladders where id=c.ladder_id for update;
 select * into strict c from public.pyramid_challenges where id=p_challenge for update;
 select id into own_entry from public.pyramid_entries where ladder_id=c.ladder_id and user_id=auth.uid();
 w:=coalesce(p_winner,own_entry);
 if c.status<>'accepted' then raise exception 'Das Forderungsspiel ist nicht offen'; end if;
 if not private.is_super_admin() and (w is distinct from own_entry
     or own_entry not in (c.challenger_id,c.defender_id)) then
   raise exception 'Nur der Sieger darf sein Ergebnis melden' using errcode='42501';
 end if;
 if w not in (c.challenger_id,c.defender_id) then raise exception 'Ungültiger Sieger'; end if;
 if p_score is null or char_length(p_score)>80
   or p_score !~ '^[0-9]{1,2}:[0-9]{1,2}(, ?[0-9]{1,2}:[0-9]{1,2}){1,2}$' then
   raise exception 'Ergebnisformat: 6:4, 6:3 oder 6:4, 4:6, 10:8';
 end if;
 perform private.pyramid_finish(c.id,w,'completed',p_score);
end;
$$;

-- pg_cron is already installed in the dedicated TSV project.
create function public.pyramid_settle_expired()
 returns integer language plpgsql security definer set search_path = '' as $$
declare l record; c record; n integer:=0;
begin
 for l in select distinct ladder_id from public.pyramid_challenges
    where status='pending' and accept_deadline<=now() loop
   perform 1 from public.pyramid_ladders where id=l.ladder_id for update;
   for c in select id,challenger_id from public.pyramid_challenges
     where ladder_id=l.ladder_id and status='pending' and accept_deadline<=now()
     order by created_at,id for update loop
     -- Missing the 10-day acceptance window counts as a defender loss.
     perform private.pyramid_finish(c.id,c.challenger_id,'forfeit',null);
     n:=n+1;
   end loop;
 end loop;
 return n;
end;
$$;
revoke all on function public.pyramid_settle_expired() from public,anon,authenticated;
grant execute on function public.pyramid_settle_expired() to postgres,service_role;
select cron.schedule('tsv-pyramid-acceptance-expiry','15 * * * *','select public.pyramid_settle_expired()');

-- RPC entry points must not remain callable by anon/PUBLIC.
revoke all on function public.pyramid_request_join(uuid,text),
 public.pyramid_approve_join(uuid), public.pyramid_move_entry(uuid,integer),
 public.pyramid_challenge(uuid), public.pyramid_respond(uuid,boolean),
 public.pyramid_report_result(uuid,text,uuid)
 from public,anon;
grant execute on function public.pyramid_request_join(uuid,text),
 public.pyramid_approve_join(uuid), public.pyramid_move_entry(uuid,integer),
 public.pyramid_challenge(uuid), public.pyramid_respond(uuid,boolean),
 public.pyramid_report_result(uuid,text,uuid) to authenticated;
