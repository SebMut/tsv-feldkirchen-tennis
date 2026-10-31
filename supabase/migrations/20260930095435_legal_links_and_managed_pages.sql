insert into public.site_settings(key,value,is_public)
values ('statutes_url',to_jsonb('https://tsvfeldkirchen.de/satzung'::text),true)
on conflict (key) do update set value=excluded.value,is_public=true,updated_at=now();

update public.pages
set body='Das rechtliche Impressum wird vom Hauptverein TSV Feldkirchen bei München von 1912 e.V. bereitgestellt. Zur aktuellen Fassung: https://tsvfeldkirchen.de/impressum',
    meta_title='Impressum | TSV Feldkirchen Tennis',
    meta_description='Impressum der Tennisabteilung des TSV Feldkirchen mit Verweis auf den Hauptverein.',
    updated_at=now()
where slug='impressum';

update public.pages
set body='Die aktuelle Datenschutzerklärung wird vom Hauptverein TSV Feldkirchen bei München von 1912 e.V. bereitgestellt. Zur aktuellen Fassung: https://tsvfeldkirchen.de/datenschutz-dsgvo',
    meta_title='Datenschutz | TSV Feldkirchen Tennis',
    meta_description='Datenschutzinformationen der Tennisabteilung des TSV Feldkirchen mit Verweis auf den Hauptverein.',
    updated_at=now()
where slug='datenschutz';
