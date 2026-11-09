-- Winner and loser protection timestamps are derived from currently valid
-- finished matches. Cancelling or changing a result must remove stale locks.
create or replace function private.pyramid_refresh_entry_protection(p_entry uuid)
 returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_entry is null then return; end if;
 update public.pyramid_entries e set
  last_win_at=(select max(c.resolved_at) from public.pyramid_challenges c
    where c.winner_id=p_entry and c.status in ('completed','forfeit')),
  last_loss_at=(select max(c.resolved_at) from public.pyramid_challenges c
    where c.status in ('completed','forfeit') and c.winner_id is distinct from p_entry
      and p_entry in (c.challenger_id,c.defender_id))
 where e.id=p_entry;
end;
$$;
revoke all on function private.pyramid_refresh_entry_protection(uuid) from public,anon,authenticated;

create or replace function private.pyramid_refresh_protection_after_challenge_change()
 returns trigger language plpgsql security definer set search_path = '' as $$
begin
 perform private.pyramid_refresh_entry_protection(case when tg_op='DELETE' then old.challenger_id else new.challenger_id end);
 perform private.pyramid_refresh_entry_protection(case when tg_op='DELETE' then old.defender_id else new.defender_id end);
 if tg_op='UPDATE' then
  if old.challenger_id not in (new.challenger_id,new.defender_id) then perform private.pyramid_refresh_entry_protection(old.challenger_id); end if;
  if old.defender_id not in (new.challenger_id,new.defender_id) then perform private.pyramid_refresh_entry_protection(old.defender_id); end if;
 end if;
 return null;
end;
$$;
revoke all on function private.pyramid_refresh_protection_after_challenge_change() from public,anon,authenticated;

drop trigger if exists pyramid_challenge_refresh_protection on public.pyramid_challenges;
create trigger pyramid_challenge_refresh_protection
 after insert or update of status,winner_id,resolved_at,challenger_id,defender_id or delete
 on public.pyramid_challenges for each row
 execute function private.pyramid_refresh_protection_after_challenge_change();

-- Repair already stale protection timestamps once during deployment.
update public.pyramid_entries e set
 last_win_at=(select max(c.resolved_at) from public.pyramid_challenges c
   where c.winner_id=e.id and c.status in ('completed','forfeit')),
 last_loss_at=(select max(c.resolved_at) from public.pyramid_challenges c
   where c.status in ('completed','forfeit') and c.winner_id is distinct from e.id
     and e.id in (c.challenger_id,c.defender_id));
