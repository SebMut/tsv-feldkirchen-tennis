-- One official BTV club PDF covers all 20 teams.
-- Snapshots are private, initialized on first sync; changes only trigger
-- announcements after the initial baseline has been established.
create table if not exists public.btv_fixture_snapshots (
  season_year integer not null check (season_year between 2025 and 2100),
  source_key text not null,
  team_season_id uuid not null references public.team_seasons(id),
  match_id uuid references public.matches(id) on delete set null,
  opponent text not null,
  is_home boolean not null,
  starts_at timestamptz not null,
  source_url text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (season_year,source_key)
);
create index if not exists btv_fixture_snapshots_match_idx on public.btv_fixture_snapshots(match_id);
alter table public.btv_fixture_snapshots enable row level security;
drop policy if exists btv_fixture_snapshots_admin_read on public.btv_fixture_snapshots;
create policy btv_fixture_snapshots_admin_read on public.btv_fixture_snapshots
  for select to authenticated using (private.is_super_admin());
revoke all on table public.btv_fixture_snapshots from public,anon,authenticated;
grant select on table public.btv_fixture_snapshots to authenticated;
grant select,insert,update,delete on table public.btv_fixture_snapshots to service_role;

create table if not exists public.btv_schedule_changes (
  id uuid primary key default gen_random_uuid(),
  season_year integer not null,
  source_key text not null,
  match_id uuid references public.matches(id) on delete set null,
  old_starts_at timestamptz not null,
  new_starts_at timestamptz not null,
  detected_at timestamptz not null default now(),
  status text not null check (status in ('published','protected','unmatched','historical')),
  reason text,
  news_id uuid references public.news(id) on delete set null
);
create index if not exists btv_schedule_changes_detected_idx on public.btv_schedule_changes(detected_at desc);
alter table public.btv_schedule_changes enable row level security;
drop policy if exists btv_schedule_changes_admin_read on public.btv_schedule_changes;
create policy btv_schedule_changes_admin_read on public.btv_schedule_changes
  for select to authenticated using (private.is_super_admin());
revoke all on table public.btv_schedule_changes from public,anon,authenticated;
grant select on table public.btv_schedule_changes to authenticated;
grant select,insert,update,delete on table public.btv_schedule_changes to service_role;

alter table public.btv_import_runs
  add column if not exists rescheduled_count integer not null default 0,
  add column if not exists news_count integer not null default 0,
  add column if not exists conflicts_count integer not null default 0;

-- All effects of one source date change are atomic: save the next snapshot,
-- update the matching game only when no manual edits/live ticker conflict,
-- and publish ONE TSV news announcement. First insert never creates news.
create or replace function private.btv_snapshot_reschedule()
returns trigger language plpgsql security definer
set search_path = ''
as $fn$
declare
  game public.matches%rowtype;
  team_name text;
  club_team_id uuid;
  old_local text;
  new_local text;
  post_id uuid;
  shift_status text;
  shift_reason text;
begin
  if old.starts_at is not distinct from new.starts_at then
    return new;
  end if;
  if old.match_id is null or new.match_id is null or old.match_id <> new.match_id then
    shift_status := 'unmatched';
    shift_reason := 'No unambiguous existing match linked across both snapshots';
  elsif greatest(old.starts_at,new.starts_at) <= now() then
    shift_status := 'historical';
    shift_reason := 'Historical correction, not a current match postponement';
  else
    select * into game from public.matches where id = old.match_id for update;
    if not found or game.team_season_id <> new.team_season_id
      or game.is_home is distinct from new.is_home
      or not game.is_published or game.match_type <> 'league' then
      shift_status := 'protected';
      shift_reason := 'Match missing, unpublished or incorrectly linked';
    elsif game.starts_at is distinct from old.starts_at then
      shift_status := 'protected';
      shift_reason := 'Match time changed manually since last BTV snapshot';
    elsif exists (
      select 1 from public.match_live_state
      where match_id=game.id and status in ('live','finished','cancelled')
    ) or exists (
      select 1 from public.match_encounters
      where match_id=game.id and status in ('live','finished')
    ) then
      shift_status := 'protected';
      shift_reason := 'Match has live/finished/cancelled data';
    else
      update public.matches
        set starts_at = new.starts_at,
            ends_at = case when ends_at is not null then ends_at + (new.starts_at - old.starts_at) else null end,
            btv_last_synced_at = now()
        where id=game.id;
      select ts.team_id,t.name into club_team_id,team_name
      from public.team_seasons ts join public.teams t on t.id=ts.team_id
      where ts.id=new.team_season_id;
      old_local := to_char(timezone('Europe/Berlin',old.starts_at),'DD.MM.YYYY HH24:MI')||' Uhr';
      new_local := to_char(timezone('Europe/Berlin',new.starts_at),'DD.MM.YYYY HH24:MI')||' Uhr';

      -- Archive only prior automatically generated *rescheduling* news for
      -- the same match, never any ordinary editorial story.
      update public.news n set status='archived', updated_at=now()
      where n.id in (select ch.news_id from public.btv_schedule_changes ch
         where ch.match_id=game.id and ch.status='published' and ch.news_id is not null);

      insert into public.news
        (slug,title,excerpt,body,team_id,match_id,status,published_at)
      values (
        'btv-spielverlegung-'||substr(md5(new.source_key||gen_random_uuid()::text),1,22),
        'Spielverlegung: '||team_name||' gegen '||game.opponent,
        'Neuer Spieltermin: '||new_local||' (bisher '||old_local||').',
        'Der Bayerische Tennis-Verband hat den Termin für '||team_name||
        ' gegen '||game.opponent||' aktualisiert.'||E'\n\n'||
        'Bisheriger Termin: '||old_local||E'\n'||
        'Neuer Termin: '||new_local||E'\n'||
        'Spielort: '||(case when new.is_home then 'Heimspiel' else 'Auswärtsspiel' end)||E'\n\n'||
        'Quelle: Öffentlicher BTV-Vereinsspielplan des TSV Feldkirchen (01012).',
        club_team_id,game.id,'published',now()
      ) returning id into post_id;
      shift_status := 'published';
      shift_reason := 'Fixture time and linked news updated automatically';
    end if;
  end if;
  insert into public.btv_schedule_changes
    (season_year,source_key,match_id,old_starts_at,new_starts_at,status,reason,news_id)
  values (new.season_year,new.source_key,coalesce(old.match_id,new.match_id),
          old.starts_at,new.starts_at,shift_status,shift_reason,post_id);
  return new;
end;
$fn$;
revoke all on function private.btv_snapshot_reschedule() from public,anon,authenticated;
drop trigger if exists btv_snapshot_update_news on public.btv_fixture_snapshots;
create trigger btv_snapshot_update_news
after update of starts_at on public.btv_fixture_snapshots
for each row execute function private.btv_snapshot_reschedule();

-- The BTV writer can access private import tables, not anonymous users.
