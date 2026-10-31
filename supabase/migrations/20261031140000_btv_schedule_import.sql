-- BTV schedule import: provenance and guarded sync, without changing existing matches.
alter table public.matches
  add column if not exists btv_source_key text,
  add column if not exists btv_imported boolean not null default false,
  add column if not exists btv_last_synced_at timestamptz,
  add column if not exists btv_result_text text;

create unique index if not exists matches_btv_source_key_unique
  on public.matches(btv_source_key) where btv_source_key is not null;

create table if not exists public.btv_import_runs (
  id uuid primary key default gen_random_uuid(),
  season_year integer not null check (season_year between 2025 and 2100),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running','success','failed','blocked')),
  source_url text not null,
  source_fixture_count integer not null default 0,
  existing_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text
);
alter table public.btv_import_runs enable row level security;
create policy btv_import_runs_admin_read on public.btv_import_runs
  for select to authenticated using (private.is_super_admin());
revoke all on table public.btv_import_runs from public, anon, authenticated;
grant select on table public.btv_import_runs to authenticated;
grant select,insert,update,delete on table public.btv_import_runs to service_role;

-- No RLS change to public.matches. The external sync is server-side only.
-- Anon/service roles retain earlier least-privilege rules.
