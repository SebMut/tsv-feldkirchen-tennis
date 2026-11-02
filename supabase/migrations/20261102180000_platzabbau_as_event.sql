-- Correctly classify the 07 November 2026 Platzabbau as an event.
-- The existing event is reused to preserve its UUID, timestamp, status and image.
-- The former news excerpt and body are combined BEFORE the news duplicate is removed.
-- Idempotent on re-application; all changes happen within one transaction.
do $$
declare
  original_news public.news%rowtype;
  existing_event public.events%rowtype;
begin
  select * into existing_event from public.events
    where id = 'bfdb94ef-44c1-4b86-ac3d-42dba1a95bb0'::uuid for update;
  if not found then
    raise exception 'Platzabbau-Veranstaltung nicht gefunden';
  end if;

  select * into original_news from public.news
    where id = '2b808763-aae9-4aec-ab05-135a8b738447'::uuid for update;

  if original_news.id is null and existing_event.external_url is null then
    return; -- already converted
  end if;
  if original_news.id is null or
     existing_event.external_url is distinct from 'news:2b808763-aae9-4aec-ab05-135a8b738447' or
     existing_event.starts_at::date <> date '2026-11-07' then
    raise exception 'Platzabbau-Datensätze haben sich geändert; keine automatische Umstellung';
  end if;
  if exists (
    select 1 from public.btv_schedule_changes
    where news_id = original_news.id
  ) then
    raise exception 'News-Eintrag wird an anderer Stelle referenziert';
  end if;

  update public.events set
    slug = 'platzabbau-2026-11-07',
    description = concat_ws(E'\n\n',
      nullif(btrim(original_news.excerpt), ''),
      nullif(btrim(original_news.body), '')),
    hero_image_path = coalesce(existing_event.hero_image_path, original_news.hero_image_path),
    external_url = null
  where id = existing_event.id;

  delete from public.news where id = original_news.id;
  if not found then
    raise exception 'Doppelter News-Eintrag konnte nicht entfernt werden';
  end if;
end;
$$;