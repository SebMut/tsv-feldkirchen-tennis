-- Identify season *type* for each private BTV snapshot / import / news audit.
-- Backfill previously collected Sommer 2026 records, without changing keys.
alter table public.btv_fixture_snapshots add column if not exists season_code text;
update public.btv_fixture_snapshots set season_code='sommer-'||season_year where season_code is null;
alter table public.btv_fixture_snapshots alter column season_code set not null;
alter table public.btv_fixture_snapshots alter column season_code set default 'sommer-2026';
create index if not exists btv_snapshots_season_code_idx on public.btv_fixture_snapshots(season_code);

alter table public.btv_import_runs add column if not exists season_code text;
update public.btv_import_runs set season_code='sommer-'||season_year where season_code is null;
alter table public.btv_import_runs alter column season_code set not null;
alter table public.btv_import_runs alter column season_code set default 'sommer-2026';

alter table public.btv_schedule_changes add column if not exists season_code text;
update public.btv_schedule_changes set season_code='sommer-'||season_year where season_code is null;
alter table public.btv_schedule_changes alter column season_code set not null;
alter table public.btv_schedule_changes alter column season_code set default 'sommer-2026';

-- Keep the existing protected rescheduling logic, now recording correct season.
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
    (season_year,season_code,source_key,match_id,old_starts_at,new_starts_at,status,reason,news_id)
  values (new.season_year,new.season_code,new.source_key,coalesce(old.match_id,new.match_id),
          old.starts_at,new.starts_at,shift_status,shift_reason,post_id);
  return new;
end;
$fn$;

