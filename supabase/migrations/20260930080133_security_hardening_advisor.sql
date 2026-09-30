-- Applied migration: security_hardening_advisor
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

create index if not exists teams_category_idx on public.teams(category_id);
create index if not exists team_seasons_season_idx on public.team_seasons(season_id);
create index if not exists events_team_idx on public.events(team_id);
create index if not exists news_team_idx on public.news(team_id);
create index if not exists news_match_idx on public.news(match_id);
create index if not exists gallery_items_gallery_idx on public.gallery_items(gallery_id);
create index if not exists sponsor_placements_sponsor_idx on public.sponsor_placements(sponsor_id);
create index if not exists sponsor_placements_team_idx on public.sponsor_placements(team_id);
create index if not exists sponsor_placements_match_idx on public.sponsor_placements(match_id);
