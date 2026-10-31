insert into public.news (slug,title,excerpt,body,hero_image_path,status,published_at)
values
(
  'schnuppertag',
  'Schnuppertag',
  'Schnuppertag der Tennisabteilung am 12. April 2026.',
  'Am 12. April 2026 findet von 10:00 bis 17:00 Uhr der Schnuppertag der Tennisabteilung statt. Die Anmeldung erfolgt über die Tennisschule Alex Braun.',
  'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/schnuppertag_TSVFeldkirchen.png',
  'published',
  '2026-03-30 09:14:26 Europe/Berlin'
),
(
  'kalender-fuer-alle-mannschaften',
  'Kalender für alle Mannschaften',
  'Spieltermine abonnieren und automatisch aktuell halten.',
  'Für alle Mannschaften stehen abonnierbare Kalender zur Verfügung. Änderungen an Spielterminen sollen dadurch automatisch in den abonnierten Kalender übernommen werden. Die neue Website stellt die Kalender zentral im Bereich Termine bereit. Spieltermine bitte zusätzlich mit der offiziellen BTV-Vereinsseite abgleichen.',
  'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/kalender_beitrag-e1774133597168.png',
  'published',
  '2026-03-21 22:53:38 Europe/Berlin'
),
(
  'jahreshauptversammlung-2026',
  'Jahreshauptversammlung für die Geschäftsjahre 2024 und 2025',
  'Jahreshauptversammlung mit Neuwahlen am 27. März 2026.',
  'Die Jahreshauptversammlung für die Geschäftsjahre 2024 und 2025 des TSV Feldkirchen bei München von 1912 e.V. findet am Freitag, 27. März 2026, im Sportlerwirt „Pomod’oro“ an der Olympiastraße 1 statt. Beginn ist um 19:00 Uhr.',
  'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/jhv-e1773388201203.png',
  'published',
  '2026-03-13 08:48:20 Europe/Berlin'
),
(
  'aufbau-der-plaetze',
  'Aufbau der Plätze',
  'Gemeinsamer Platzaufbau zum Start in die Tennissaison 2026.',
  'Am 28. März 2026 werden die Tennisplätze gemeinsam für die neue Saison vorbereitet. Nach getaner Arbeit ist ein gemeinsamer Ausklang mit Leberkäs-Essen auf der Anlage vorgesehen. Helfende Hände sind willkommen.',
  'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/platz-aufbau-e1773267028120.png',
  'published',
  '2026-03-13 08:45:20 Europe/Berlin'
)
on conflict (slug) do update
set title=excluded.title,
    excerpt=excluded.excerpt,
    body=excluded.body,
    hero_image_path=excluded.hero_image_path,
    status='published',
    published_at=excluded.published_at,
    updated_at=now();
