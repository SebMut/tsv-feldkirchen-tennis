-- Der gemeinsame Beitragseditor benötigt einen eigenen Kurztext auch für Veranstaltungen.
-- Bestehende veröffentlichte Veranstaltungen, RSVPs und RLS-Policies bleiben unverändert.
alter table public.events add column if not exists excerpt text;
comment on column public.events.excerpt is 'Kurztext für die öffentliche Veranstaltungsübersicht; Langtext bleibt in description.';

-- Den im gemeldeten Admin-Screenshot dokumentierten Platzabbau-Kurztext wiederherstellen.
-- Nur den eindeutig identifizierten Termin und ausschließlich bei leerem Kurztext.
update public.events
set excerpt = 'Ab **10:30 Uhr** machen wir unsere Tennisplätze gemeinsam winterfest. Dafür freuen wir uns über viele helfende Hände – denn zusammen geht’s schneller und macht mehr Spaß! 💪'
where slug = 'platzabbau-2026-11-07'
  and title like '%Platzabbau%'
  and (excerpt is null or btrim(excerpt) = '');
