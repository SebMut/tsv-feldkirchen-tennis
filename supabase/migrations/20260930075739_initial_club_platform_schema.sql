-- Applied migration: initial_club_platform_schema
-- Project: eaurnufdochjapfzqwvm
-- Created 2026-09-30

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text,
  avatar_path text,
  global_role text not null default 'user' check (global_role in ('user','super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year integer not null unique check (year between 2000 and 2100),
  starts_on date, ends_on date,
  is_current boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.team_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0
);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text,
  category_id uuid references public.team_categories(id) on delete set null,
  gender text check (gender in ('men','women','mixed','youth')),
  age_group text, description text, image_path text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.team_seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  league text, group_name text, btv_url text, summary text, team_image_path text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, season_id)
);
create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  role text not null default 'editor' check (role in ('manager','editor','ticker')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, team_id)
);
create table public.players (
  id uuid primary key default gen_random_uuid(),
  first_name text, last_name text,
  display_name text not null,
  photo_path text, bio text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.team_players (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  sort_order integer not null default 0,
  is_captain boolean not null default false,
  public_visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique(team_season_id, player_id)
);
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  slug text,
  match_type text not null default 'league' check (match_type in ('league','friendly','tournament','other')),
  opponent text not null,
  is_home boolean not null default true,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text, venue_address text, external_url text, notes text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_season_id, starts_at, opponent)
);
create table public.match_live_state (
  match_id uuid primary key references public.matches(id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished','cancelled')),
  home_score integer not null default 0 check (home_score >= 0),
  away_score integer not null default 0 check (away_score >= 0),
  started_at timestamptz, finished_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.live_ticker_entries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  entry_type text not null default 'update' check (entry_type in ('update','score','info')),
  message text not null check (char_length(message) between 1 and 2000),
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.news (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text, body text not null default '',
  team_id uuid references public.teams(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  hero_image_path text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  author_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  category text not null default 'club',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location_name text, address text,
  team_id uuid references public.teams(id) on delete set null,
  status text not null default 'published' check (status in ('draft','published','cancelled','archived')),
  external_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null, url text, logo_path text, description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.sponsor_placements (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  placement text not null check (placement in ('home','live','team','match','sponsors')),
  team_id uuid references public.teams(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  starts_on date, ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.officials (
  id uuid primary key default gen_random_uuid(),
  name text not null, title text not null,
  email text, phone text, photo_path text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null default '',
  meta_title text, meta_description text,
  published boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.facility_status (
  id boolean primary key default true check (id = true),
  status text not null default 'open' check (status in ('open','limited','closed')),
  message text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  status text not null default 'open' check (status in ('open','limited','closed')),
  status_message text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  team_id uuid references public.teams(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (team_id is not null or match_id is not null)
);
create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  storage_path text not null,
  alt_text text, caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index team_memberships_user_idx on public.team_memberships(user_id) where active;
create index team_memberships_team_idx on public.team_memberships(team_id) where active;
create index team_seasons_team_idx on public.team_seasons(team_id);
create index team_players_team_season_idx on public.team_players(team_season_id);
create index team_players_player_idx on public.team_players(player_id);
create index matches_team_season_starts_idx on public.matches(team_season_id, starts_at);
create index matches_starts_idx on public.matches(starts_at) where is_published;
create index ticker_match_created_idx on public.live_ticker_entries(match_id, created_at desc) where deleted_at is null;
create index news_published_idx on public.news(published_at desc) where status = 'published';
create index events_starts_idx on public.events(starts_at) where status = 'published';
create index galleries_team_idx on public.galleries(team_id);
create index galleries_match_idx on public.galleries(match_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger teams_touch before update on public.teams for each row execute function public.touch_updated_at();
create trigger team_seasons_touch before update on public.team_seasons for each row execute function public.touch_updated_at();
create trigger players_touch before update on public.players for each row execute function public.touch_updated_at();
create trigger matches_touch before update on public.matches for each row execute function public.touch_updated_at();
create trigger match_live_state_touch before update on public.match_live_state for each row execute function public.touch_updated_at();
create trigger ticker_touch before update on public.live_ticker_entries for each row execute function public.touch_updated_at();
create trigger news_touch before update on public.news for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
create trigger sponsors_touch before update on public.sponsors for each row execute function public.touch_updated_at();
create trigger officials_touch before update on public.officials for each row execute function public.touch_updated_at();
create trigger pages_touch before update on public.pages for each row execute function public.touch_updated_at();
create trigger site_settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();
create trigger facility_status_touch before update on public.facility_status for each row execute function public.touch_updated_at();
create trigger courts_touch before update on public.courts for each row execute function public.touch_updated_at();
create trigger galleries_touch before update on public.galleries for each row execute function public.touch_updated_at();

create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id=(select auth.uid()) and global_role='super_admin'); $$;

create or replace function private.can_edit_team(target_team uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_super_admin() or exists (
  select 1 from public.team_memberships
  where user_id=(select auth.uid()) and team_id=target_team and active and role in ('manager','editor')
); $$;

create or replace function private.can_tick_team(target_team uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_super_admin() or exists (
  select 1 from public.team_memberships
  where user_id=(select auth.uid()) and team_id=target_team and active and role in ('manager','editor','ticker')
); $$;

create or replace function private.can_edit_any_team()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_super_admin() or exists (
  select 1 from public.team_memberships where user_id=(select auth.uid()) and active and role in ('manager','editor')
); $$;

create or replace function private.can_edit_team_season(target_team_season uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.team_seasons where id=target_team_season and private.can_edit_team(team_id)); $$;

create or replace function private.can_tick_match(target_match uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.matches m join public.team_seasons ts on ts.id=m.team_season_id
  where m.id=target_match and private.can_tick_team(ts.team_id)
); $$;

create or replace function private.can_edit_player(target_player uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_super_admin() or exists (
  select 1 from public.team_players tp join public.team_seasons ts on ts.id=tp.team_season_id
  where tp.player_id=target_player and private.can_edit_team(ts.team_id)
); $$;

create or replace function private.can_manage_gallery(target_gallery uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_super_admin() or exists (
  select 1 from public.galleries g where g.id=target_gallery and (
    (g.team_id is not null and private.can_edit_team(g.team_id)) or
    (g.match_id is not null and private.can_tick_match(g.match_id))
  )
); $$;

revoke all on function private.is_super_admin() from public;
revoke all on function private.can_edit_team(uuid) from public;
revoke all on function private.can_tick_team(uuid) from public;
revoke all on function private.can_edit_any_team() from public;
revoke all on function private.can_edit_team_season(uuid) from public;
revoke all on function private.can_tick_match(uuid) from public;
revoke all on function private.can_edit_player(uuid) from public;
revoke all on function private.can_manage_gallery(uuid) from public;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.can_edit_team(uuid) to authenticated;
grant execute on function private.can_tick_team(uuid) to authenticated;
grant execute on function private.can_edit_any_team() to authenticated;
grant execute on function private.can_edit_team_season(uuid) to authenticated;
grant execute on function private.can_tick_match(uuid) to authenticated;
grant execute on function private.can_edit_player(uuid) to authenticated;
grant execute on function private.can_manage_gallery(uuid) to authenticated;

create or replace function private.create_match_live_state()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  insert into public.match_live_state(match_id) values(new.id) on conflict(match_id) do nothing;
  return new;
end; $$;
revoke all on function private.create_match_live_state() from public;
create trigger matches_create_live_state after insert on public.matches for each row execute function private.create_match_live_state();

alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.team_categories enable row level security;
alter table public.teams enable row level security;
alter table public.team_seasons enable row level security;
alter table public.team_memberships enable row level security;
alter table public.players enable row level security;
alter table public.team_players enable row level security;
alter table public.matches enable row level security;
alter table public.match_live_state enable row level security;
alter table public.live_ticker_entries enable row level security;
alter table public.news enable row level security;
alter table public.events enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsor_placements enable row level security;
alter table public.officials enable row level security;
alter table public.pages enable row level security;
alter table public.site_settings enable row level security;
alter table public.facility_status enable row level security;
alter table public.courts enable row level security;
alter table public.galleries enable row level security;
alter table public.gallery_items enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id=(select auth.uid()) or private.is_super_admin());
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id=(select auth.uid()) and global_role='user');
create policy profiles_update on public.profiles for update to authenticated using (id=(select auth.uid()) or private.is_super_admin()) with check (id=(select auth.uid()) or private.is_super_admin());

create policy seasons_public_read on public.seasons for select to anon,authenticated using (true);
create policy seasons_admin_write on public.seasons for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy categories_public_read on public.team_categories for select to anon,authenticated using (true);
create policy categories_admin_write on public.team_categories for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());

create policy teams_public_read on public.teams for select to anon using (active);
create policy teams_authenticated_read on public.teams for select to authenticated using (active or private.can_tick_team(id));
create policy teams_insert_admin on public.teams for insert to authenticated with check (private.is_super_admin());
create policy teams_update_editor on public.teams for update to authenticated using (private.can_edit_team(id)) with check (private.can_edit_team(id));
create policy teams_delete_admin on public.teams for delete to authenticated using (private.is_super_admin());

create policy team_seasons_public_read on public.team_seasons for select to anon using (is_published);
create policy team_seasons_authenticated_read on public.team_seasons for select to authenticated using (is_published or private.can_tick_team(team_id));
create policy team_seasons_insert_editor on public.team_seasons for insert to authenticated with check (private.can_edit_team(team_id));
create policy team_seasons_update_editor on public.team_seasons for update to authenticated using (private.can_edit_team(team_id)) with check (private.can_edit_team(team_id));
create policy team_seasons_delete_editor on public.team_seasons for delete to authenticated using (private.can_edit_team(team_id));
create policy memberships_read on public.team_memberships for select to authenticated using (user_id=(select auth.uid()) or private.is_super_admin() or private.can_edit_team(team_id));

create policy players_public_read on public.players for select to anon using (
  active and exists(select 1 from public.team_players tp join public.team_seasons ts on ts.id=tp.team_season_id where tp.player_id=players.id and tp.public_visible and ts.is_published)
);
create policy players_authenticated_read on public.players for select to authenticated using (active or private.can_edit_player(id) or private.is_super_admin());
create policy players_insert_editor on public.players for insert to authenticated with check (private.can_edit_any_team());
create policy players_update_editor on public.players for update to authenticated using (private.can_edit_player(id)) with check (private.can_edit_player(id));
create policy players_delete_editor on public.players for delete to authenticated using (private.can_edit_player(id));

create policy team_players_public_read on public.team_players for select to anon using (
  public_visible and exists(select 1 from public.team_seasons ts where ts.id=team_players.team_season_id and ts.is_published)
);
create policy team_players_authenticated_read on public.team_players for select to authenticated using (public_visible or private.can_edit_team_season(team_season_id));
create policy team_players_insert_editor on public.team_players for insert to authenticated with check (private.can_edit_team_season(team_season_id));
create policy team_players_update_editor on public.team_players for update to authenticated using (private.can_edit_team_season(team_season_id)) with check (private.can_edit_team_season(team_season_id));
create policy team_players_delete_editor on public.team_players for delete to authenticated using (private.can_edit_team_season(team_season_id));

create policy matches_public_read on public.matches for select to anon using (is_published);
create policy matches_authenticated_read on public.matches for select to authenticated using (is_published or private.can_edit_team_season(team_season_id));
create policy matches_insert_editor on public.matches for insert to authenticated with check (private.can_edit_team_season(team_season_id));
create policy matches_update_editor on public.matches for update to authenticated using (private.can_edit_team_season(team_season_id)) with check (private.can_edit_team_season(team_season_id));
create policy matches_delete_editor on public.matches for delete to authenticated using (private.can_edit_team_season(team_season_id));

create policy live_state_public_read on public.match_live_state for select to anon using (exists(select 1 from public.matches m where m.id=match_live_state.match_id and m.is_published));
create policy live_state_authenticated_read on public.match_live_state for select to authenticated using (exists(select 1 from public.matches m where m.id=match_live_state.match_id and m.is_published) or private.can_tick_match(match_id));
create policy live_state_insert_ticker on public.match_live_state for insert to authenticated with check (private.can_tick_match(match_id));
create policy live_state_update_ticker on public.match_live_state for update to authenticated using (private.can_tick_match(match_id)) with check (private.can_tick_match(match_id));

create policy ticker_public_read on public.live_ticker_entries for select to anon using (deleted_at is null and exists(select 1 from public.matches m where m.id=live_ticker_entries.match_id and m.is_published));
create policy ticker_authenticated_read on public.live_ticker_entries for select to authenticated using ((deleted_at is null and exists(select 1 from public.matches m where m.id=live_ticker_entries.match_id and m.is_published)) or private.can_tick_match(match_id));
create policy ticker_insert on public.live_ticker_entries for insert to authenticated with check (private.can_tick_match(match_id) and author_id=(select auth.uid()));
create policy ticker_update on public.live_ticker_entries for update to authenticated using (private.can_tick_match(match_id)) with check (private.can_tick_match(match_id));
create policy ticker_delete on public.live_ticker_entries for delete to authenticated using (private.can_tick_match(match_id));

create policy news_public_read on public.news for select to anon using (status='published' and published_at is not null and published_at<=now());
create policy news_authenticated_read on public.news for select to authenticated using ((status='published' and published_at is not null and published_at<=now()) or private.is_super_admin() or (team_id is not null and private.can_edit_team(team_id)));
create policy news_insert on public.news for insert to authenticated with check (private.is_super_admin() or (team_id is not null and private.can_edit_team(team_id)));
create policy news_update on public.news for update to authenticated using (private.is_super_admin() or (team_id is not null and private.can_edit_team(team_id))) with check (private.is_super_admin() or (team_id is not null and private.can_edit_team(team_id)));
create policy news_delete on public.news for delete to authenticated using (private.is_super_admin() or (team_id is not null and private.can_edit_team(team_id)));

create policy events_public_read on public.events for select to anon using (status='published');
create policy events_authenticated_read on public.events for select to authenticated using (status='published' or private.is_super_admin() or (team_id is not null and private.can_edit_team(team_id)));
create policy events_insert on public.events for insert to authenticated with check (private.is_super_admin() or (team_id is not null and private.can_edit_team(team_id)));
create policy events_update on public.events for update to authenticated using (private.is_super_admin() or (team_id is not null and private.can_edit_team(team_id))) with check (private.is_super_admin() or (team_id is not null and private.can_edit_team(team_id)));
create policy events_delete on public.events for delete to authenticated using (private.is_super_admin() or (team_id is not null and private.can_edit_team(team_id)));

create policy sponsors_public_read on public.sponsors for select to anon,authenticated using (active);
create policy sponsors_admin_write on public.sponsors for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy placements_public_read on public.sponsor_placements for select to anon,authenticated using (active and (starts_on is null or starts_on<=current_date) and (ends_on is null or ends_on>=current_date));
create policy placements_admin_write on public.sponsor_placements for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy officials_public_read on public.officials for select to anon,authenticated using (published);
create policy officials_admin_write on public.officials for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy pages_public_read on public.pages for select to anon using (published);
create policy pages_authenticated_read on public.pages for select to authenticated using (published or private.is_super_admin());
create policy pages_admin_write on public.pages for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy settings_public_read on public.site_settings for select to anon using (is_public);
create policy settings_authenticated_read on public.site_settings for select to authenticated using (is_public or private.is_super_admin());
create policy settings_admin_write on public.site_settings for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy facility_public_read on public.facility_status for select to anon,authenticated using (true);
create policy facility_admin_write on public.facility_status for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy courts_public_read on public.courts for select to anon,authenticated using (active);
create policy courts_admin_write on public.courts for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());

create policy galleries_public_read on public.galleries for select to anon using (published);
create policy galleries_authenticated_read on public.galleries for select to authenticated using (published or private.can_manage_gallery(id));
create policy galleries_insert on public.galleries for insert to authenticated with check (private.is_super_admin() or (team_id is not null and private.can_edit_team(team_id)) or (match_id is not null and private.can_tick_match(match_id)));
create policy galleries_update on public.galleries for update to authenticated using (private.can_manage_gallery(id)) with check (private.can_manage_gallery(id));
create policy galleries_delete on public.galleries for delete to authenticated using (private.can_manage_gallery(id));
create policy gallery_items_public_read on public.gallery_items for select to anon using (exists(select 1 from public.galleries g where g.id=gallery_items.gallery_id and g.published));
create policy gallery_items_authenticated_read on public.gallery_items for select to authenticated using (exists(select 1 from public.galleries g where g.id=gallery_items.gallery_id and g.published) or private.can_manage_gallery(gallery_id));
create policy gallery_items_insert on public.gallery_items for insert to authenticated with check (private.can_manage_gallery(gallery_id));
create policy gallery_items_update on public.gallery_items for update to authenticated using (private.can_manage_gallery(gallery_id)) with check (private.can_manage_gallery(gallery_id));
create policy gallery_items_delete on public.gallery_items for delete to authenticated using (private.can_manage_gallery(gallery_id));

grant select on public.seasons,public.team_categories,public.teams,public.team_seasons,public.players,public.team_players,public.matches,public.match_live_state,public.live_ticker_entries,public.news,public.events,public.sponsors,public.sponsor_placements,public.officials,public.pages,public.site_settings,public.facility_status,public.courts,public.galleries,public.gallery_items to anon;
grant select,insert on public.profiles to authenticated;
grant update(display_name,email,avatar_path) on public.profiles to authenticated;
grant select on public.team_memberships to authenticated;
grant select,insert,update,delete on public.seasons,public.team_categories,public.teams,public.team_seasons,public.players,public.team_players,public.matches,public.match_live_state,public.live_ticker_entries,public.news,public.events,public.sponsors,public.sponsor_placements,public.officials,public.pages,public.site_settings,public.facility_status,public.courts,public.galleries,public.gallery_items to authenticated;
