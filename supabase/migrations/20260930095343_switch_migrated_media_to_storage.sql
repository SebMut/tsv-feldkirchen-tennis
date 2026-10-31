update public.officials
set photo_path='officials/placeholder.png',updated_at=now()
where photo_path like 'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/%/dummy_ueberuns.png';

update public.sponsors set logo_path='sponsors/aen.jpg',updated_at=now() where name='Allgeier Engineering';
update public.sponsors set logo_path='sponsors/hotelbauer.jpg',updated_at=now() where name='Hotel Bauer';
update public.sponsors set logo_path='sponsors/head.png',updated_at=now() where name='HEAD';
update public.sponsors set logo_path='sponsors/keil_ktm.png',updated_at=now() where name='Keil KTM';
update public.sponsors set logo_path='sponsors/landschaftsbau_may.png',updated_at=now() where name='May Landschaftsbau';
update public.sponsors set logo_path='sponsors/munig.png',updated_at=now() where name='Munich Premium Gin';
update public.sponsors set logo_path='sponsors/omv.png',updated_at=now() where name='OMV';
update public.sponsors set logo_path='sponsors/zehemerbraeu.png',updated_at=now() where name='Zehmerbräu';
update public.sponsors set logo_path='sponsors/smartwerk_logo.webp',updated_at=now() where name='Smartwerk.art';

update public.news set hero_image_path='news/schnuppertag.png',updated_at=now() where slug='schnuppertag';
update public.news set hero_image_path='news/kalender.png',updated_at=now() where slug='kalender-fuer-alle-mannschaften';
update public.news set hero_image_path='news/jhv.png',updated_at=now() where slug='jahreshauptversammlung-2026';
update public.news set hero_image_path='news/platzaufbau.png',updated_at=now() where slug='aufbau-der-plaetze';

insert into public.site_settings(key,value,is_public)
values
  ('logo_path',to_jsonb('branding/tennis-logo.png'::text),true),
  ('team_category_images',jsonb_build_object(
      'herren','teams/herren.png',
      'damen','teams/damen.png',
      'jugend','teams/jugend.png'
   ),true)
on conflict (key) do update
set value=excluded.value,is_public=true,updated_at=now();
