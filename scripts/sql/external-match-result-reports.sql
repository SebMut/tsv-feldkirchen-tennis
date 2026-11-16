-- Verified public source, NOT an official BTV final score.
-- Project eaurnufdochjapfzqwvm.
-- Admin-only candidate information, kept separate from matches.btv_result_text.
create table if not exists public.external_match_result_reports (
  match_id uuid primary key references public.matches(id) on delete cascade,
  home_points integer not null check (home_points between 0 and 99),
  away_points integer not null check (away_points between 0 and 99),
  source_type text not null check (source_type in ('municipal_publication','club_publication','press_report')),
  source_url text not null check (length(source_url) between 12 and 1000 and left(source_url,8)='https://'),
  source_title text not null check (length(source_title) between 5 and 240),
  source_note text not null check (length(source_note) between 10 and 600),
  review_status text not null default 'pending_btv_confirmation'
    check (review_status in ('pending_btv_confirmation','disputed','reviewed')),
  recorded_at timestamptz not null default now()
);
alter table public.external_match_result_reports enable row level security;
revoke all on public.external_match_result_reports from public, anon, authenticated;
grant select on public.external_match_result_reports to authenticated;
drop policy if exists external_match_results_super_admin_only on public.external_match_result_reports;
create policy external_match_results_super_admin_only
on public.external_match_result_reports for select to authenticated
using (private.is_super_admin());
