-- A news article can refer either to a team's match or to an existing event.
-- Event links use the event's team_id for the editor's dependent selector.
alter table public.news
  add column if not exists related_event_id uuid references public.events(id) on delete set null;

create index if not exists news_related_event_id_idx on public.news (related_event_id)
  where related_event_id is not null;

alter table public.news
  add constraint news_only_one_reference_chk
  check (match_id is null or related_event_id is null);
