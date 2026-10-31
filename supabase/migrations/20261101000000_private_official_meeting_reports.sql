-- TSV Feldkirchen: official nuLiga meeting-report provenance, separate from public ticker.
-- ADDITIVE ONLY. Rollback if empty and not yet used: drop dependent tables in reverse order.
-- Deliberately NOT PUBLIC: official player names can include minors and opponent juniors.
create table if not exists public.official_season_sources (
  id uuid primary key default gen_random_uuid(),
  federation text not null default 'BTV' check (federation = 'BTV'),
  club_number text not null default '01012' check (club_number = '01012'),
  season_id uuid not null references public.seasons(id) on delete restrict,
  season_type text not null check (season_type in ('summer','winter','other')),
  official_season_code text not null,
  schedule_url text not null check (schedule_url like 'https://btv.liga.nu/%' or schedule_url like 'https://www.tennis.de/%'),
  source_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(federation, season_id, official_season_code)
);
create table if not exists public.official_team_season_refs (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  official_season_source_id uuid not null references public.official_season_sources(id) on delete restrict,
  official_group_id text not null,
  official_team_id text,
  group_url text check (group_url is null or group_url like 'https://btv.liga.nu/%' or group_url like 'https://www.tennis.de/%'),
  verified_at timestamptz not null default now(),
  unique (team_season_id, official_season_source_id, official_group_id)
);
create table if not exists public.official_meeting_reports (
  id uuid primary key default gen_random_uuid(),
  federation text not null default 'BTV' check (federation = 'BTV'),
  season_id uuid not null references public.seasons(id) on delete restrict,
  match_id uuid references public.matches(id) on delete set null,
  source_meeting_id bigint not null check (source_meeting_id > 0),
  source_group_id text,
  report_url text not null check (report_url ~ '^https://btv[.]liga[.]nu/'),
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  parser_version text,
  home_team text,
  away_team text,
  home_match_points integer check (home_match_points >= 0),
  away_match_points integer check (away_match_points >= 0),
  home_sets integer check (home_sets >= 0),
  away_sets integer check (away_sets >= 0),
  home_games integer check (home_games >= 0),
  away_games integer check (away_games >= 0),
  official_status text not null default 'unknown',
  verification_status text not null default 'pending'
    check (verification_status in ('pending','partial','verified','conflict','report_unavailable')),
  obtained_at timestamptz not null default now(),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(federation, season_id, source_meeting_id)
);
create index if not exists official_meeting_reports_match_idx on public.official_meeting_reports(match_id);
create index if not exists official_team_season_refs_team_idx on public.official_team_season_refs(team_season_id);
create table if not exists public.official_report_rubbers (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.official_meeting_reports(id) on delete cascade,
  discipline text not null check (discipline in ('single','double','motoric','other')),
  position integer not null check (position > 0),
  -- Arrays of {name, source_player_id?}; must never be exposed to anon.
  home_participants jsonb not null default '[]'::jsonb check (jsonb_typeof(home_participants) = 'array'),
  away_participants jsonb not null default '[]'::jsonb check (jsonb_typeof(away_participants) = 'array'),
  set_results jsonb not null default '[]'::jsonb check (jsonb_typeof(set_results) = 'array'),
  winner_side text check (winner_side in ('home','away','none')),
  special_status text not null default 'unknown',
  result_text text,
  source_section text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','partial','verified','conflict')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(report_id, discipline, position)
);
create index if not exists official_report_rubbers_report_idx on public.official_report_rubbers(report_id);
create table if not exists public.official_import_issues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  match_id uuid references public.matches(id) on delete set null,
  report_id uuid references public.official_meeting_reports(id) on delete set null,
  issue_code text not null,
  severity text not null default 'warning' check (severity in ('info','warning','error')),
  source_url text,
  -- NO raw report text, participant names or authenticated session values.
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists official_import_issues_season_idx on public.official_import_issues(season_id, resolved_at);

-- Explicit grants: newly created tables may not be in the Supabase Data API.
-- service_role can import; authenticated may only SELECT approved team seasons.
alter table public.official_season_sources enable row level security;
alter table public.official_team_season_refs enable row level security;
alter table public.official_meeting_reports enable row level security;
alter table public.official_report_rubbers enable row level security;
alter table public.official_import_issues enable row level security;
revoke all on public.official_season_sources, public.official_team_season_refs,
  public.official_meeting_reports, public.official_report_rubbers, public.official_import_issues
  from anon, authenticated;
grant select on public.official_team_season_refs, public.official_meeting_reports,
  public.official_report_rubbers, public.official_import_issues to authenticated;
grant all on public.official_season_sources, public.official_team_season_refs,
  public.official_meeting_reports, public.official_report_rubbers, public.official_import_issues
  to service_role;

create policy official_team_refs_editors_read
on public.official_team_season_refs for select to authenticated
using (private.can_edit_team_season(team_season_id));

create policy official_reports_editors_read
on public.official_meeting_reports for select to authenticated
using (match_id is not null and exists (
  select 1 from public.matches m
  where m.id = match_id and private.can_edit_team_season(m.team_season_id)
));

create policy official_rubbers_editors_read
on public.official_report_rubbers for select to authenticated
using (exists (
  select 1 from public.official_meeting_reports r
  join public.matches m on m.id = r.match_id
  where r.id = report_id and private.can_edit_team_season(m.team_season_id)
));

create policy official_issues_editors_read
on public.official_import_issues for select to authenticated
using (match_id is not null and exists (
  select 1 from public.matches m
  where m.id = match_id and private.can_edit_team_season(m.team_season_id)
));
