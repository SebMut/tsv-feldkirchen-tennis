# Phase 8 – Bedienkomfort, Vereinsbrett und Spieltage 2.0

**Stand: 31.10.2026 · Entwicklungsbranch `feature/astro-supabase-foundation` · technische Umsetzung, praktische Abnahme offen**

Verbindlich: ausschließlich GitHub `SebMut/tsv-feldkirchen-tennis` und Supabase `eaurnufdochjapfzqwvm`. **Kein Merge auf `main`, kein Go-live, keine Änderung an der Produktivdomain.**

Die acht gewünschten Verbesserungen wurden so weit wie im Entwicklungsbranch sicher möglich umgesetzt, ohne bestehende Rollen, veröffentlichte Termine oder Live-Spielstände zu überschreiben.

## 8.1 Spieltags-Cockpit 2.0

- Bestehende Begegnungskacheln, TSV-Spieler-Auswahl, Gegner-Platzhalter, Heim/Auswärts, Ergebnis-Buttons und Zurücksetzen beibehalten.
- Auf jedem Spieltag ist jetzt eine Fortschrittsanzeige mit `x von 9` (6 Einzel/3 Doppel) bzw. `x von 6` (4 Einzel/2 Doppel), laufenden Begegnungen und TSV-/Gegner-Zwischenstand sichtbar.
- Keine erfundenen Ergebnisse; Fortschritt wird aus `match_encounters.status`, der Zwischenstand aus `match_live_state` abgeleitet.

Implementierung: `src/scripts/admin.ts`, `src/styles/global.css`.

**Praxistest offen:** beide Spielformate, Live-Updates und Korrekturen mit zwei echten Geräten und einem Ticker-Login. Die vorhandene „Zurücksetzen“-Funktion ermöglicht gezielte Korrektur; ein versionsbasierter „Ein-Klick-Rollback“ früherer Werte wurde **nicht** implementiert, da dies bei parallelen Live-Eingaben zu unkontrollierten Überschreibungen führen könnte.

## 8.2 Persönliches „Mein TSV“

- Zusätzliche hervorgehobene Karte „Mein nächster Spieltag“ mit Mannschaft, Gegner, Heim-/Auswärtsspiel, Beginn und Direktaktion zum Spieltags-Cockpit.
- Daten auf die zugelassenen Teams/Spielzeiten begrenzt; bestehende rollenbasierte Teamnavigation bleibt maßgeblich.
- Wenn kein Spiel eingetragen ist, kein erfundenes Datum.

Implementierung: `src/pages/admin/index.astro`, `src/scripts/phase8.ts`. Keine Änderung der RLS-Rollen.

**Praxistest offen:** SuperAdmin, Editor, Manager und Ticker mit mehreren bzw. ohne Teamzuordnungen.

## 8.3 Kalender-Wochenansicht und Favoriten

- Umschalter Monat/Woche, Tageswahl, Woche Montag bis Sonntag, vorige/nächste Woche.
- Auswahl einer Lieblingsmannschaft; auf Wunsch dauerhaft auf dem **eigenen Gerät** in `localStorage` gespeichert. Keine Übertragung auf ein serverseitiges Profil.
- Farbpunkte für Herren, Damen, Jugend und Veranstaltungen weiter vorhanden.
- Für einen ausgewählten Termin jetzt eine herunterladbare einzelne `.ics`-Datei, zusätzlich zu den bestehenden fortlaufenden ICS-Abos.
- Uhrzeiten in der UI in `Europe/Berlin`; der einzelne ICS-Termin wird in UTC gespeichert.

Implementierung: `src/pages/termine/index.astro`, `src/scripts/public.ts`, CSS.

**Wichtig:** Eine heruntergeladene `.ics`-Datei ist ein einzelner Stand, kein synchronisierendes Abonnement. Für laufende Aktualisierungen weiterhin „Kalender abonnieren“ benutzen.

## 8.4 Installierbare Web-App

- Basisabhängiges `manifest.webmanifest` (Vorschau und spätere Produktionsdomain).
- App-Symbol als SVG und Build-generierte PNGs in 192x192 sowie 512x512.
- Öffentliche Service-Worker-Offlinehülle für Startseite, Teams, Spieltag, Kalender. **Keine** Speicherung von Supabase-API-Antworten, Login, privaten Adminseiten oder Navigations-URLs mit Parametern.
- Installationshinweis auf Startseite und Spieltagszentrale; unterstützte Browser erhalten einen optionalen Installationsbutton.
- Der PWA-Installationshinweis drängt nicht zu Push- oder anderen Berechtigungen.

Implementierung: `src/pages/manifest.webmanifest.ts`, `src/pages/sw.js.ts`, `src/lib/app-icon.ts`, `src/pages/icon-192.png.ts`, `src/pages/icon-512.png.ts`, `public/app-icon.svg`, `src/layouts/MainLayout.astro`, `src/scripts/phase8.ts`, Seiten und CSS. Build-Audit prüft Manifest-Basis, PNG-Maße und Worker.

**Abgrenzung:** Keine Push-Benachrichtigungen versenden – dafür wäre ein eigener Opt-in-/Versanddienst mit Datenschutzprüfung nötig. Offline werden keine Live-Ergebnisse aktualisiert. Installation auf Android/iOS im echten Browser prüfen.

## 8.5 Mannschaftsseiten mit Saisonstatistik

- Saisonüberblick zeigt Anzahl Spiele, Heimspiele, Auswärtsspiele, Anzahl **digital abgeschlossener** Spiele sowie Siege/Unentschieden/Niederlagen aus deren erfassten Ergebnissen.
- Offizieller BTV-Spielplan ist bei vorhandener URL verlinkt; es werden keine externen Tabellenplätze vorgetäuscht.
- Archiv-Saisonauswahl bleibt funktionsfähig; Statistik bezieht sich auf die gerade gewählte Saison.
- Bei historischen Matchdaten ohne `finished`-Status lautet die Statistik ausdrücklich „digital erfasste Ergebnisse“ statt fehlende Resultate als Niederlagen zu zählen.

Implementierung: `src/pages/mannschaften/[slug].astro`, `src/scripts/public.ts`, CSS.

## 8.6 Digitales Vereinsbrett

- Neue Tabelle `public.club_notices` mit Überschrift, Inhalt, Art, Sortierung, Anfang, optionalem Ende und Veröffentlichungsschalter.
- Auf Startseite und Spieltagszentrale werden **nur freigegebene, im Zeitfenster aktive** Meldungen eingeblendet; bei null Meldungen kein leerer Block.
- SuperAdmin kann im neuen „Mein TSV“-Panel Mitteilungen anlegen, bearbeiten, aktivieren und deaktivieren.
- RLS: öffentliche Leser sehen nur freigegebene und zeitlich aktuelle Mitteilungen; nur SuperAdmin darf schreiben. Bearbeitung ist nicht für Ticker/Editor freigegeben.
- **Keine Test-/Fake-Vereinsmitteilungen veröffentlicht.**

SQL-Migration: `supabase/migrations/20261031131000_phase8_notices_audit.sql`. UI: `src/scripts/phase8.ts` und Seiten.

**Praxistest offen:** redaktioneller Zeitfilter, Freigabe, Änderung, Ausblenden und Responsive-Darstellung.

## 8.7 Änderungsverlauf

- Neue Audit-Tabelle `public.club_change_log` mit Zeit, Bereich, Datensatz, Operation, Nutzer-ID und **nur den Namen** geänderter relevanter Felder.
- Trigger für `matches`, `match_encounters`, `match_live_state`, `live_ticker_entries`, `news`, `events`, `facility_status` und `club_notices`.
- **Keine** alten/freien Nachrichten-, Spielernamen- oder Bildinhalte in der Audit-Tabelle. Angezeigte Nutzerzuordnung nur für SuperAdmins.
- Neues „Mein TSV“-Panel „Änderungsverlauf“: letzte 80 Einträge mit manuellem Aktualisieren.
- Read-only für SuperAdmin, keine öffentlichen Rechte, keine Frontend-Schreibfunktion. Triggerfunktion unter `private`.
- Historische Änderungen **vor** Phase 8 sind nicht nachträglich verfügbar.
- Ein geschützter Restore früherer Werte ist nicht Bestandteil dieses ersten Audit-Systems.

SQL und UI wie unter 8.6. **Praxistest offen:** tatsächliche Statusänderungen mit zwei Rollen und Überprüfung der Actor-ID, insbesondere bei RPC- und Systemupdates.

## 8.8 Spielberichte und Fotogalerien aufwerten

- Neuer Button „Spielbericht mit Ergebnissen erstellen“ direkt am zu bearbeitenden Mannschaftsspiel.
- Öffnet die bestehende News-Redaktion, wählt das Spiel, setzt den Beitragsstatus auf `Entwurf` und füllt nach Verfügbarkeit Ergebnis, Gegner, Mannschaft und vorhandene Tickermeldungen vor.
- Eigener Text und ein Beitragsbild können ergänzt werden. Die vorhandene Galerie bleibt weiterhin separat je Spiel pflegbar.
- Beim späteren Bearbeiten eines schon veröffentlichten Newsbeitrags bleibt das ursprüngliche `published_at` erhalten.
- Teamzuordnungsprüfung vor Speichern und bestehende RLS-Rechte bleiben unverändert.

Implementierung: `src/scripts/admin-advanced.ts`, `src/scripts/admin.ts`. **Praxistest offen:** Bericht erzeugen, Bild hochladen, Entwurf privat halten, veröffentlichen, archivieren.

## Technische Verifikation

- Astro TypeScript-/Build und GitHub-Pages-Publish werden durch die vorhandenen CI-Workflows geprüft; den endgültigen SHA-/Workflow-Status immer bei Abnahme aktuell erneut abrufen.
- Neuer statischer Audit prüft außerdem `manifest.webmanifest`, `sw.js` und PNG-Bildgröße.
- Supabase: SQL-Migration `phase8_notices_audit` angewendet. Per SQL bestätigt: beide neuen Tabellen haben RLS, `club_change_log` ist für `anon` nicht les-/schreibbar, `club_notices` erlaubt `anon` nur SELECT, und acht Trigger sind angelegt.
- Keine echten Termine, Spielstände, Mannschaftsdaten oder veröffentlichten Vereinsmitteilungen für automatisierte End-to-End-Tests verändert.
- Authentifizierte UI-Praxistests, Push-freier PWA-Installationsablauf und Zwei-Geräte-Test sind **nicht** durch einen erfolgreichen Build ersetzt.

## Noch vor der Freigabe

1. Alle acht Module mit echten Vereinsrollen praktisch durchklicken; dabei keine echten Livespiele manipulieren.
2. Vereinsbrett: Testentwurf erzeugen, veröffentlichen, ausblenden; RLS im anonymen Browser prüfen.
3. Live-Ticker-/Audit-Berechtigungen auf zwei Geräten testen und kontrolliert zurücksetzen.
4. Installierbarkeit auf Android und iOS, Wochenansicht/ICS sowie Saisonarchiv überprüfen.
5. Bilder, Rechtstexte, Hosting und Backups aus Phase 7 freigeben.
6. Erst danach eine **separate ausdrückliche Produktivfreigabe** erwägen.

**Die vorhandene Produktivwebsite bleibt unverändert.**
