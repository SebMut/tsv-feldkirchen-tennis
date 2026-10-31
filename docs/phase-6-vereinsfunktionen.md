# Phase 6 – Vereinsfunktionen und Courtbooking

Status: **technisch weitgehend umgesetzt – fachliche und visuelle Abnahme offen** (31. Oktober 2026).

## Verbindliche Umgebung

- GitHub: ausschließlich `SebMut/tsv-feldkirchen-tennis`, Branch `feature/astro-supabase-foundation`.
- Supabase: ausschließlich `eaurnufdochjapfzqwvm`.
- Produktionsdomain und aktueller Go-live-Stand wurden **nicht** verändert.
- Bestehende Astro-/Supabase-/RLS-/Liveticker-Architektur erhalten.

## 6.1 Courtbooking – sichere externe Integration

- Der bereits vorhandene direkte Link `https://tsvfeldkirchen.courtbooking.de/` bleibt der einzige Buchungsweg (Header Desktop/Mobil, Startseite, Spieltag).
- Im Anlagenstatus ist der externe Buchungsweg mit dem Hinweis auf Verfügbarkeit sichtbar; die Admin-Anlage weist ausdrücklich darauf hin, dass sie **keine** Live-Buchungsbelegung darstellt.
- Die öffentliche Courtbooking-Webseite und Hersteller-FAQ bestätigen die browserbasierte, anmeldegeschützte Buchung und eigenständige Platz-/Buchungsregeln.
- Keine dokumentierte öffentlich nutzbare API/SSO-Schnittstelle für dieses Vereinsmandat verifiziert. Deshalb **keine** nachgebaute Platzbuchung, **kein** Embedding oder unautorisierte Anmeldung.
- Externe Prüfung: `https://courtbooking.de/faq`, `https://tsvfeldkirchen.courtbooking.de/login.php`.
- Offen: Technische Schnittstelle und gebuchtes Modul durch Vereinsadministrator/Hersteller klären, nur falls eine stärkere Integration tatsächlich gewünscht ist.

## 6.2 Anlagenstatus – implementiert

- Gesamtstatus und Einzelplatzstatus in `src/pages/admin/index.astro` / `src/scripts/admin.ts` gepflegt.
- „Unbekannt“ als eigene Option ergänzt, Zeitpunkt der letzten Meldung sichtbar und nach dem Speichern aktualisiert.
- Bei öffentlichen Datenfehlern, fehlendem Status oder Meldungen älter als 14 Tage keine unbelegte „Plätze geöffnet“-Behauptung; externer Courtbooking-Link als sichere Alternative.
- RLS bleibt auf SuperAdmin beschränkt.
- Datenabgleich: 1 Anlagenstatus `unknown`, acht Plätze `open`; **keine Änderungen an diesen echten Vereinsdaten** während der Umsetzung.
- Offen: Praktische Speichern-/Auslesen-Prüfung mit einem angemeldeten SuperAdmin auf Smartphone.

## 6.3 Kalender und Veranstaltungen – implementiert

- `src/pages/termine/index.astro` und `src/scripts/public.ts`: zusätzliche Zeitfilter (alle, kommende, Kalenderjahr, letzte 90 Tage) neben Art/Team/Kategorie.
- ICS-Abos bleiben erhalten. **Wichtig:** Der Zeitfilter wirkt nur auf die Ansicht; der ICS-Link berücksichtigt weiterhin Team/Art/Kategorie und enthält alle Zeiträume. Die UI weist im Auswahl-Link darauf hin.
- `src/pages/admin/index.astro` und `src/scripts/admin.ts`: Bestehende Veranstaltung bearbeiten, Entwurf, Veröffentlichung, Absage, Archivierung, Speichern und Abbrechen; Datumsreihenfolge und erkennbare Dubletten bei Neuerstellung prüfen.
- Teambezogene Rechte bleiben serverseitig durch die vorhandenen RLS-Regeln geschützt. Keine automatischen Matchdaten überschreiben.
- Die vorhandene `calendar-feed`-Edge-Funktion selektiert veröffentlichte Mannschaftsspiele und Veranstaltungen; nicht veröffentlichte Datensätze bleiben ausgeschlossen.
- Offen: Realen ICS-Import in Apple/Outlook und vollständigen Terminworkflow mit angemeldeten Rollen testen. Trainings-Einzeltermine sind nur vorhanden, wenn sie als zulässige Veranstaltungen gepflegt werden.

## 6.4 News und Spielberichte – implementiert

- Vorhandene Newsform um Bearbeiten, Abbrechen, lokale Textvorschau, Entwurf, Veröffentlichen und Archivieren erweitert.
- Zuordnung zur Mannschaft und zu einem tatsächlich zugehörigen Spiel wird vor dem Speichern überprüft; RLS begrenzt Schreibzugriffe.
- Optionale Bilder per bestehendem Supabase Storage und Bildoptimierung hochladen/ersetzen.
- Öffentliche Matchdetails lesen die zugeordneten **veröffentlichten** Spielberichte zusätzlich zu den Tickermeldungen und Einzel/Doppel-Daten.
- Offen: Redaktionelle E2E-Abnahme mit echten Editor-/Managerrollen. Veröffentlichungsdatum wird beim erneuten Speichern eines veröffentlichten Beitrags derzeit erneuert; ggf. redaktionell entscheiden, ob dies erwünscht ist.

## 6.5 Vereinsverwaltung – implementiert

- Sponsor- und Funktionärsverwaltung auf bestehenden Tabellen um Bearbeiten, Sortieren, Freigeben/Ausblenden und Logo-/Foto-Upload erweitert.
- Neue Funktionäre werden nicht ohne explizite Freigabe öffentlich sichtbar.
- Sponsorplatzierungen können geändert oder deaktiviert werden, statt Datensätze zu löschen. Bestehende Platzierungen und Zuordnungen bleiben erhalten.
- Bestehende verwaltete Seiten, Benutzerverwaltung, Mannschaftszuteilungen und SuperAdmin-Navigation bleiben erhalten.
- **RLS-Fix:** Vier explizite zusätzliche `SELECT TO authenticated USING(private.is_super_admin())`-Policies für `sponsors`, `officials`, `sponsor_placements`, `courts`, damit SuperAdmins auch ausgeblendete/inaktive Inhalte zur Bearbeitung abrufen können. Vorhandene öffentliche Policies unverändert.
- SQL-Migration: `supabase/migrations/20261031092000_phase6_superadmin_catalog_read.sql`, in Supabase angewendet und per `pg_policies` mit vier Ergebnissen überprüft.
- Offen: Authentifizierten End-to-End-Test aller Bild-/Form-Workflows und Mannschaftsrollen durchführen.

## 6.6 Saisonarchiv – implementiert

- Vorhandenes Admin-Saisonmanagement (Anlegen, Archivieren, Reaktivieren, Saisonwechsel) erhalten.
- Bisher nicht verdrahtete Saisonauswahl auf Mannschaftsdetailseiten aktiviert. Queryparameter `?season=<uuid>` zeigt den öffentlichen Kader und Spielplan der gewählten veröffentlichten Saison.
- Bei ausgewählter Archiv-Saison keine nächsten Spiele aus anderen Saisons in der hervorgehobenen Spielkarte verwenden.
- Matchdetailseiten enthalten vorhandene archivierte Ergebnisse, Einzel/Doppel, Galerie und zugeordnete Spielberichte.
- Kein automatischer Wechsel der echten aktuellen Saison und keine historischen Datensätze verändert.
- Einschränkung: Allgemeine Mannschaftsgalerien sind nicht eindeutig einer Saison zugeordnet; sie werden nicht künstlich historisiert.

## 6.7 Qualität / Sicherheitsprüfung

- Github-Actions-Workflow `Build Astro` wird als technische Build-Prüfung verwendet. Zwischenzeitliche TypeScript-Fehler in den Redaktionserweiterungen wurden repariert; CI-Status ist bei Abnahme erneut am **letzten** Commit zu prüfen.
- Datenbankschema, Tabellenconstraints und RLS-Policies für Anlage, Termine, News, Sponsoren, Funktionäre, Platzierungen und Saisons geprüft.
- Alle vorhandenen Statuswerte für `news`, `events`, `facility_status`, `courts` gegen die aktuellen CHECK-Constraints berücksichtigt.
- Supabase-Migration ohne Löschung bestehender Daten.
- Neue Listeneinträge und Formularaktionen auf Touchbedienung ausgelegt; CSS in `src/styles/global.css`.
- Der tatsächliche öffentliche Preview-Render war über externen Website-Abruf nicht zuverlässig erreichbar. GitHub-Actions-Veröffentlichung ist die technische Kontrolle.
- **Nicht behaupten:** Reale Smartphone-Screenshots, visuelle Desktop-Abnahme, echte eingeloggte CRUD-Durchläufe, tatsächlicher laufender Liveticker, ICS-Import in Fremd-Apps, vollständige Authentifizierung-/RLS-End-to-End-Prüfung.

## Verbindliche Abnahme vor Phase 7

1. Ein SuperAdmin prüft Anlage, Sponsoren, Funktionäre und Sponsorplatzierungen mit tatsächlichem Anlegen/Ändern/Deaktivieren/Wiederherstellen.
2. Ein Team-Editor erstellt einen Entwurf, bearbeitet einen Newsbeitrag, veröffentlicht ihn und bearbeitet einen Termin; ein ticker-only-Konto erhält keine zusätzlichen Rechte.
3. Browser-/Smartphone-Test für Navigation, Formulare, Sortierung, Nachrichten, Medien und Kalender.
4. ICS-Abos in Apple Kalender und Outlook mit realen Testabonnements überprüfen.
5. Archiv-Saison im Browser öffnen und Kader/Spielplan/Ergebnis kontrollieren.
6. Praxistest mit zwei Geräten bei einem echten Live-Spiel; die erhaltene Phase-4-Liveticker-Logik verifizieren.
7. Letzten CI- und GitHub-Pages-Status vor endgültiger Abnahme erneut prüfen.

**Keine Freigabe zur Produktionsumschaltung.** Phase 7 darf erst nach technischer und fachlicher Abnahme in den Go-live wechseln.


## Ergänzung: Interaktiver Monatskalender mit Fokus auf heute (31.10.2026)

Auf ausdrücklichen Wunsch wurde die bisherige listenbasierte Terminseite durch einen echten Monatskalender ersetzt.

- `src/pages/termine/index.astro`: Monatsraster mit sieben Wochentagen ab Montag, Monatsnavigation, „Heute“-Taste, Tagesagenda rechts und kompakter kommender Terminliste. Die bestehende vollständige Terminliste bleibt aufklappbar.
- `src/scripts/public.ts`: automatische Auswahl des aktuellen Tages beim Aufruf, Berechnung des Kalendertags in der Zeitzone `Europe/Berlin` (inklusive Zeitumstellung), Hervorhebung des heutigen und ausgewählten Tages, rote Punkte für Punktspiele und grüne Punkte für Veranstaltungen; Klick oder Pfeiltasten wechseln den gewählten Tag. Filter für Terminart, Mannschaft, Kategorie und Zeitraum wirken auf Monatsmarkierungen und Agenda. Auf jeder gewählten Tagesseite werden die echten Daten aus `matches` und `events` angezeigt.
- `src/styles/global.css`: eigenständiges helles, responsives Monatskalender-Layout; auf kleinen Smartphones folgt die Tagesagenda unter dem Raster.
- ICS-Abonnements bleiben vorhanden und verweisen weiterhin auf die bestehenden, serverseitig gefilterten Feeds. Der Zeitraumfilter verändert nur die UI-Ansicht, nicht die ICS-Historie.
- Bei fehlenden Daten oder langsamer Supabase-Antwort ist der Kalender bedienbar und zeigt ein erklärendes Status-/Leerfeld; keine frei erfundenen Termine.
- Verifikation Supabase zum 31.10.2026 (Europe/Berlin): 121 veröffentlichte Punktspiele, drei veröffentlichte Veranstaltungen, davon **heute 0 Punktspiele und 0 Veranstaltungen**. Daher ist die heutige Agenda derzeit erwartungsgemäß leer; vergangene Tage lassen sich über die Monatsnavigation ansehen.
- **Keine DB-/Berechtigungsänderungen** für den Monatskalender. Die produktive Domain wurde nicht verändert.
- Astro-Check und Build der Kalender-Implementierung bei Commit `da5e270f2b49d1880564c2a121355185dc8e92a7` erfolgreich; GitHub-Pages-Publish ebenfalls erfolgreich. Späterer Accessibility- und Watchdog-Fix in `2f9be10c4dedc29f6373b0badf6607d72a9a4c7b`; abschließenden CI-Status prüfen.
- Offen: Sichtkontrolle auf echten Smartphones und ein Klick-/Tastaturtest im Browser. Eine vollständige dynamische Browser-Vorschau war über die vorhandenen Werkzeuge nicht zugänglich.
