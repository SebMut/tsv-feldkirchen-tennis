# Winter 2026/2027 – technische Prüfung und laufende Überwachung

Stand: 02.11.2026. Geltungsbereich ausschließlich TSV Feldkirchen (01012), Supabase-Projekt eaurnufdochjapfzqwvm.

## Verifizierte BTV-Gruppen
- Herren: Südliga 2 Gr. 018, BTV groupid=2257673
- Herren II: Südliga 2 Gr. 020, BTV groupid=2257681
- Herren 50: Südliga 1 Gr. 166, BTV groupid=2257828

Offizielle Quellen sind die drei einseitigen BTV-Gruppe-/Spielplan-PDFs mit
`dokument=ScheduleReportFOP&group=<groupid>`.
Der read-only GitHub-Job `scripts/audit-winter-2026.mjs` vergleicht die
aktuellen öffentlichen PDF-Daten (Gegner, Mannschaft, Heim/Auswärts,
Beginn in Europe/Berlin, Zahl der Begegnungen) mit den veröffentlichten
Supabase-Spielen. Die PDF-Validierung ist streng: exakte Saison, Verein 01012,
drei Gruppen, fünf TSV-Begegnungen pro Gruppe und insgesamt 15 Begegnungen.

Erster erfolgreicher Abgleich: GitHub Actions BTV club fixture sync,
Run 41484351849: **15 von 15, 0 Fehler, 0 Warnungen**.

## Supabase-Stammdaten, überprüft
- 3 Mannschafts-Saisonzuordnungen, 15 Begegnungen, 5 pro Mannschaft.
- Pro Mannschaft: 2 offizielle Heim-, 3 Auswärtsbegegnungen.
- Alle 15 Spiele haben einen BTV-Gruppenlink der zugehörigen Mannschaft.
- Alle 15 Spiele haben einen tatsächlichen Spielort und eine Routenadresse.
- Alle verwenden im Winter das Format 4 Einzel / 2 Doppel.
- 135 Kaderzuordnungen, 0 tote Spielerreferenzen, 0 fehlende Spielernamen,
  pro Team genau 1 Mannschaftsführer.

### Nicht mit einer öffentlichen Quelle beweisbar
- **Halleneingänge und Hallenzuordnungen**: Die Vereinsadressen ersetzen
  keine Hallenbestätigung; zusätzlich die BTV-Hallenliste prüfen.
- **BC Attaching, Herren 50 gegen TC Rot-Weiß Freising, 28.11.2026**:
  Vereinsadresse Am Sportplatz 3, 85356 Freising-Attaching wurde anhand
  des offiziellen Vereinsprofils verknüpft. **Dies ist ausdrücklich noch
  keine bestätigte Tennishallenadresse.** Hinweis erscheint bei Route/Spielort.
- **Namentliche BTV-Mannschaftsmeldung (nMM)**: Die endgültige Gesamtmeldung
  ist laut BTV nur über den internen BTV-Zugang verfügbar. Daher wurde
  nur die Datenbank-Konsistenz geprüft, nicht die Übereinstimmung jedes Namens
  mit der offiziellen nMM. Keine Kaderdaten automatisch überschreiben.
- Herren und Herren II enthalten jeweils genau dieselben 57 Spieler.
  Das kann einer gemeinsamen Meldeliste entsprechen, muss aber durch
  die Mannschaftsführer anhand der endgültigen nMM bestätigt werden.
- Bei Herren 50 sind alle 21 Kaderzuordnungen `public_visible=false`;
  Öffentlichkeit und Datenschutz bleiben unverändert, Freigabe nur durch
  Berechtigte. Herren: 56 von 57 öffentlich, Herren II: 57 von 57.

## Monitoring
1. `btv-club-sync.yml` führt den unabhängigen PDF-/Datenbank-Abgleich
   schreibgeschützt bei Änderungen am Importer und bei manueller Ausführung aus.
2. `private.assert_winter_btv_health()` wird stündlich um :22 per
   `pg_cron` ausgeführt. Sie meldet kritische Fehler bei weniger/mehr
   als 15 Begegnungen, fehlenden Routen/BTV-Links oder >24 Stunden ohne
   erfolgreichen, konfliktfreien Import. Zwischen 8 und 24 Stunden
   wird eine Warnung erzeugt.
3. Der **SuperAdmin-Bereich „BTV-Spielplan“** zeigt echte DB-Importzeit,
   Datenalter, Begegnungen, fehlende Routen, Kader-Sichtbarkeit und Fehler.
4. Überwachung und Abgleich sind getrennt: pg_cron **ruft die BTV-PDFs
   nicht selbst ab** und startet keinen Import. Ein GitHub-Schedule läuft
   immer nur im Standardbranch, nicht automatisch in
   `feature/astro-supabase-foundation`. Die vorhandene Importfreigabe
   benötigt weiterhin eine separate gesicherte Ausführungsumgebung.
   Ein veralteter Import wird sichtbar, aber nicht heimlich aktiviert.

## Datenschutz
Keine BTV-Spielerlisten oder Zugangsdaten werden ins Repository kopiert,
keine Mannschaftssichtbarkeit stillschweigend geändert. Änderungen an
Bildern weiterhin ausschließlich via Supabase-Storage `media`.
