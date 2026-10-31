-- Source of truth for publicly verified TSV team/group deep links.
-- Only official PDFs matching team, season and group qualify.
-- Target Supabase project: eaurnufdochjapfzqwvm.
create table if not exists public.verified_team_btv_links (
  team_season_id uuid primary key references public.team_seasons(id) on delete cascade,
  btv_url text not null check (
    btv_url ~ '^https://www[.]btv[.]de/de/spielbetrieb/tabelle-spielplan[.]html[?]groupid=[0-9]{7,8}$'
  ),
  group_number integer not null check (group_number between 1 and 2000),
  source_pdf_url text not null check (
    source_pdf_url ~ '^https://btv[.]liga[.]nu/cgi-bin/WebObjects/nuLigaDokumentTENDE[.]woa/wa/nuDokument[?]dokument=ScheduleReportFOP&group=[0-9]{7,8}$'
  ),
  verified_at timestamptz not null default now()
);
alter table public.verified_team_btv_links enable row level security;
revoke all on public.verified_team_btv_links from public, anon, authenticated;
grant select on public.verified_team_btv_links to anon, authenticated;
drop policy if exists verified_btv_links_public_read on public.verified_team_btv_links;
create policy verified_btv_links_public_read
on public.verified_team_btv_links for select to anon, authenticated
using (exists (
 select 1 from public.team_seasons ts
 where ts.id = team_season_id and ts.is_published = true
));

-- Verifiable 2026 sources, obtained from BTV ScheduleReportFOP.
with evidence(season_code,team_name,group_text,group_number,group_id) as (
 values
 ('sommer-2026','Bambini 12','Gr. 849',849,'2216734'),
 ('sommer-2026','Bambini 12 II','Gr. 852',852,'2216737'),
 ('sommer-2026','Bambini 12 III','Gr. 850',850,'2216736'),
 ('sommer-2026','Damen 40','Gr. 095 SU',95,'2165644'),
 ('sommer-2026','Herren','Gr. 021 SU',21,'2165579'),
 ('sommer-2026','Herren 40','Gr. 039 SU',39,'2165602'),
 ('winter-2026-2027','Herren','Gr. 018',18,'2257673'),
 ('winter-2026-2027','Herren 50','Gr. 166',166,'2257828'),
 ('winter-2026-2027','Herren II','Gr. 020',20,'2257681')
)
insert into public.verified_team_btv_links (
 team_season_id, btv_url, group_number, source_pdf_url)
select ts.id,
 'https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid='||e.group_id,
 e.group_number,
 'https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?dokument=ScheduleReportFOP&group='||e.group_id
from evidence e
join public.seasons s on s.code=e.season_code
join public.teams t on t.name=e.team_name
join public.team_seasons ts on ts.season_id=s.id and ts.team_id=t.id
where ts.group_name=e.group_text
  and ts.btv_url='https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid='||e.group_id
on conflict(team_season_id) do update set
 btv_url=excluded.btv_url,group_number=excluded.group_number,
 source_pdf_url=excluded.source_pdf_url,verified_at=now();
