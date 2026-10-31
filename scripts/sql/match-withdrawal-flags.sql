-- Competition withdrawal flags separate from official numeric results and live ticker.
-- Project: eaurnufdochjapfzqwvm; server-only writes; SuperAdmin-only reads.
create table if not exists public.match_withdrawal_flags (
  match_id uuid primary key references public.matches(id) on delete cascade,
  affected_side text not null check (affected_side in ('home','away','unknown')),
  source_kind text not null check (source_kind in ('club_report','btv_group_schedule')),
  verification_status text not null check (verification_status in ('reported','official_verified')),
  evidence_url text check(evidence_url is null or (length(evidence_url)<=1000 and evidence_url ~ '^https://[^[:space:]]+$')),
  evidence_summary text not null check(length(evidence_summary) between 5 and 360),
  official_withdrawal_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verification_status <> 'official_verified' or
    (source_kind='btv_group_schedule' and official_withdrawal_date is not null and evidence_url is not null)),
  check (source_kind<>'btv_group_schedule' or verification_status='official_verified')
);
alter table public.match_withdrawal_flags enable row level security;
revoke all on public.match_withdrawal_flags from public, anon, authenticated;
grant select on public.match_withdrawal_flags to authenticated;
create policy superadmin_view_withdrawal_flags on public.match_withdrawal_flags
for select to authenticated using (private.is_super_admin());
create index if not exists idx_withdrawal_flags_source on public.match_withdrawal_flags(source_kind,verification_status);
