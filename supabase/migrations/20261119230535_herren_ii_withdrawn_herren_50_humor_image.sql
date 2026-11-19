-- TSV Feldkirchen Tennis, Winter 2026/2027: withdrawn Herren II and humorous 50+ illustration.
-- The AVIF is uploaded and validated in the existing Supabase media bucket before this migration.
do $$
begin
  if not exists (select 1 from storage.objects
    where bucket_id='media' and name='teams/32956024-41ca-4a69-b26f-d8d8ea097d36/herren50-humor-20261119.avif') then
    raise exception 'Required Herren 50 artwork missing from Supabase media';
  end if;

  update public.teams set
    image_path='teams/32956024-41ca-4a69-b26f-d8d8ea097d36/herren50-humor-20261119.avif'
    where id='32956024-41ca-4a69-b26f-d8d8ea097d36' and slug='herren-50'
      and image_path='teams/32956024-41ca-4a69-b26f-d8d8ea097d36/archiv-optimiert-1793815096146-545bc3d6-0965-4998-b14f-5c469cb7351e.webp';
  if not found then raise exception 'Herren 50 team image was changed in the meantime'; end if;

  update public.team_seasons set
    summary='Mannschaft zurückgezogen. Herren II nimmt in der Winterrunde 2026/2027 nicht mehr am Spielbetrieb teil.',
    updated_at=now()
    where id='b8deac3d-67f8-43fa-a6f4-fb5e875b9827'
      and team_id='92dccc1d-9850-4bf6-ac08-3735639b8f54'
      and summary is null;
  if not found then raise exception 'Herren II season data was changed in the meantime'; end if;
end $$;