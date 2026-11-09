-- Non-login placeholders for testing the real 30+ player pyramid layout.
-- They are visibly marked and cannot participate in challenges or email flows.
alter table public.pyramid_entries alter column user_id drop not null;
alter table public.pyramid_entries add column if not exists is_test boolean not null default false;

do $$
begin
 if not exists(
   select 1 from pg_constraint
   where conrelid='public.pyramid_entries'::regclass
     and conname='pyramid_entries_test_identity_check'
 ) then
   alter table public.pyramid_entries
    add constraint pyramid_entries_test_identity_check
    check ((is_test and user_id is null) or (not is_test and user_id is not null));
 end if;
end;
$$;

create or replace function private.pyramid_reject_test_challenge()
 returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(
   select 1 from public.pyramid_entries e
   where e.id in (new.challenger_id,new.defender_id) and e.is_test
 ) then
   raise exception 'Testplätze können nicht an Forderungsspielen teilnehmen' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function private.pyramid_reject_test_challenge() from public,anon,authenticated;
drop trigger if exists pyramid_reject_test_challenge on public.pyramid_challenges;
create trigger pyramid_reject_test_challenge
 before insert or update of challenger_id,defender_id on public.pyramid_challenges
 for each row execute function private.pyramid_reject_test_challenge();

create or replace function public.pyramid_set_lk(p_entry uuid,p_lk numeric)
 returns void language plpgsql security definer set search_path = '' as $$
declare target_user uuid; target_is_test boolean;
begin
 if not private.is_super_admin() then
   raise exception 'Nur der Superadmin darf bestehende LK-Werte ändern' using errcode='42501';
 end if;
 if p_lk is null or p_lk<1.0 or p_lk>25.0 then
   raise exception 'LK-Wert muss zwischen 1.0 und 25.0 liegen';
 end if;
 select user_id,is_test into strict target_user,target_is_test
  from public.pyramid_entries where id=p_entry for update;
 if target_is_test then
   update public.pyramid_entries set lk_rating=p_lk where id=p_entry;
 else
   update public.pyramid_entries set lk_rating=p_lk where user_id=target_user;
   update public.profiles set tennis_lk_rating=p_lk,tennis_lk_declared_at=now()
    where id=target_user;
 end if;
end;
$$;
revoke all on function public.pyramid_set_lk(uuid,numeric) from public,anon;
grant execute on function public.pyramid_set_lk(uuid,numeric) to authenticated;

do $$
declare target_ladder uuid; base_position integer;
begin
 select id into strict target_ladder
 from public.pyramid_ladders
 where title='Herren' and season_label='Sommer 2027' and active;

 select coalesce(max(position),0) into base_position
 from public.pyramid_entries
 where ladder_id=target_ladder and withdrawn_at is null;

 insert into public.pyramid_entries(
   ladder_id,user_id,display_name,position,provisional,qualified,lk_rating,is_test
 )
 select target_ladder,null,'Test'||seed.number,
        base_position+row_number() over(order by seed.number),
        false,true,seed.lk,true
 from (values
   (1,15.2),(2,9.6),(3,18.1),(4,13.4),(5,20.7),(6,11.8),
   (7,16.5),(8,7.9),(9,14.6),(10,22.1),(11,12.7),(12,17.3),
   (13,10.5),(14,19.2),(15,15.8),(16,8.8),(17,13.9),(18,21.4),
   (19,16.9),(20,6.7),(21,14.1),(22,18.7),(23,11.2),(24,23.0),
   (25,15.5),(26,9.1),(27,17.8),(28,12.2),(29,20.0),(30,13.1)
 ) as seed(number,lk)
 where not exists(
   select 1 from public.pyramid_entries existing
   where existing.ladder_id=target_ladder and existing.is_test
     and existing.display_name='Test'||seed.number
 );
end;
$$;
