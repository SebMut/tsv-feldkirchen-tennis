-- Phase 1: final public content adjustments before media migration.

update public.pages
set body = 'Die Mitgliedschaft in der Tennisabteilung setzt eine Mitgliedschaft im Hauptverein voraus.

Hauptverein:
Erwachsene: 50,00 € pro Jahr
Kinder und Jugendliche bis 18 Jahre: 20,00 € pro Jahr

Tennisabteilung:
Erwachsene Erstzahler: 190,00 € pro Jahr
Erwachsene Zweitzahler: 140,00 € pro Jahr
Studenten/Auszubildende ab 18 Jahren: 120,00 € pro Jahr
Jugendliche bis 18 Jahre: 90,00 € pro Jahr
Kinder bis 14 Jahre: 65,00 € pro Jahr

Anträge und Formulare des Hauptvereins:
https://tsvfeldkirchen.de/downloads',
    updated_at = now()
where slug = 'mitglied-werden';

update public.pages
set body = 'Das Training beim TSV Feldkirchen wird gemeinsam mit der Tennisschule Alex Braun organisiert.

Die Tennisschule betreut Kinder, Jugendliche und Erwachsene vom Einstieg bis zum leistungsorientierten Mannschaftstraining. Angeboten werden unter anderem Sommertraining, Wintertraining, Einzel- und Gruppentraining sowie Tenniscamps.

Informationen und Anmeldung:
https://www.tennisschule-alexbraun.de/tsv-feldkirchen/',
    updated_at = now()
where slug = 'training';

update public.news
set hero_image_path = 'https://www.tennis-tsvfeldkirchen.de/wp-content/uploads/2026/03/schnuppertag_TSVFeldkirchen.png',
    updated_at = now()
where slug = 'schnuppertag' and hero_image_path is null;
