insert into public.news (slug,title,excerpt,body,hero_image_path,status,published_at)
values
(
  'hallenplaetze-in-der-naehe',
  'Hallenplätze in der Nähe',
  'Freie Tennis-Hallenplätze bei fünf Anlagen mit einer Suche vergleichen.',
  'Unser Hallenfinder bündelt die verfügbaren Hallenzeiten von Aschheim, TC Ismaning, Sporttraum, Racket-Park TSV Haar und TC Kirchheim. Zeitraum und Uhrzeit auswählen, freie Plätze vergleichen und anschließend direkt beim jeweiligen Anbieter buchen. Zum Hallenfinder: https://www.tennis-tsvfeldkirchen.de/hallenplaetze/',
  'https://www.tennis-tsvfeldkirchen.de/images/news/hallenplaetze-in-der-naehe-1773x885.webp',
  'published',
  now()
),
(
  'forderungspyramide-sommer-2027',
  'Forderungspyramide für den Sommer 2027',
  'Fordere heraus, spiele fair und klettere in der Vereinsrangliste nach oben.',
  'Zur Sommersaison 2027 startet unsere digitale Forderungspyramide. Nach der Anmeldung und Freigabe durch den Superadmin kannst du passende Gegner fordern, Spieltermine abstimmen und Ergebnisse bestätigen. Die Rangliste aktualisiert sich nach den festgelegten Regeln. Jetzt mitmachen: https://www.tennis-tsvfeldkirchen.de/forderungspyramide/',
  'https://www.tennis-tsvfeldkirchen.de/images/news/forderungspyramide-sommer-2027-1773x885.webp',
  'published',
  now() - interval '1 second'
)
on conflict (slug) do update
set title=excluded.title,
    excerpt=excluded.excerpt,
    body=excluded.body,
    hero_image_path=excluded.hero_image_path,
    status='published',
    published_at=excluded.published_at,
    updated_at=now();
