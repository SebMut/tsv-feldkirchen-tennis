-- Verified public source, NOT an official BTV final score.
-- Project eaurnufdochjapfzqwvm, Sommer 2026 only.
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

-- Exactly one grounded, non-BTV source: local Gemeindeanzeiger reporting
-- the TC Oberding women's fixture vs TSV Feldkirchen on 14 June 2026.
-- The published 4:2 is home (Oberding) : away (TSV Feldkirchen).
with verified_match as (
  select m.id from public.matches m
  join public.team_seasons ts on ts.id=m.team_season_id
  join public.teams t on t.id=ts.team_id
  join public.seasons s on s.id=ts.season_id
  where m.id='30261461-6e38-4835-ad37-06dc9691052a'::uuid
    and s.code='sommer-2026' and t.name='Damen'
    and m.opponent='TC Oberding' and m.is_home=false
    and (m.starts_at at time zone 'Europe/Berlin')::date=date '2026-06-14'
    and nullif(btrim(m.btv_result_text),'') is null
    and not exists(select 1 from public.manual_match_results x where x.match_id=m.id)
    and not exists(select 1 from public.match_withdrawal_flags x where x.match_id=m.id)
)
insert into public.external_match_result_reports
(match_id,home_points,away_points,source_type,source_url,source_title,source_note)
select id,4,2,'municipal_publication',
'https://www.vg-oberding.de/fileadmin/Gemeinde/Amtsblatt/2026/Nr._24_-_19.06.2026.pdf',
'Gemeindeanzeiger Oberding/Eitting, Ausgabe 24 vom 19.06.2026',
'Vereinsmeldung TC Oberding: Damen – TSV Feldkirchen 4:2; Heim/Gast und Termin 14.06.2026 mit BTV-Vereinsspielplan abgeglichen. Amtliches BTV-Endergebnis weiterhin nicht veröffentlicht.'
from verified_match
on conflict(match_id) do nothing;
