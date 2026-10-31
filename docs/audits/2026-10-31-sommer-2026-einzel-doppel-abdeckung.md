# TSV Feldkirchen – Einzel-/Doppel-Spielberichtabdeckung, Sommer 2026

*Ermittelt aus dem ausschließlich erlaubten Supabase-Projekt `eaurnufdochjapfzqwvm` am 31.10.2026. Nur Sommer 2026, keine Vorjahre.*

## Bedeutung

Die vollständig importierten Mannschaftsergebnisse **sind nicht** gleichzusetzen mit einer vollständigen Einzel- und Doppelaufstellung. Echte Spielberichte benötigen eine eindeutig zur Begegnung passende amtliche BTV-Meeting-ID. Es werden keine Spieler aus Kaderlisten als tatsächlich eingesetzte Aufstellung geschätzt.

- **124** intern gespeicherte Begegnungen (davon **120** zuordenbare amtliche Sommer-2026-Snapshots).
- **4** vollständig aus `MeetingReportFOP` geprüfte Einzel-/Doppelspielberichte.
- **27** echte Einzel-/Doppelpaarungen aus diesen vier Berichten: **18 Einzel**, **9 Doppel**.
- **120** interne Begegnungen haben noch keinen vollständig amtlich geprüften Detailbericht. Dies schließt Fälle mit Mannschaftsrückzügen und anderen Sonderwertungen ein, bei denen eventuell kein normaler Spielbericht existiert.
- Die vier validierten Berichte stehen in den RLS-geschützten Tabellen `official_meeting_reports` und `official_report_rubbers` und sind in `Mein TSV → Einzel & Doppel 2026` nur für Superadmins sichtbar. Die zugehörigen offiziell bestätigten `meeting`-IDs lauten **12695005, 12696831, 12702107, 12742553**. Keine erratenen Meeting-IDs.

## Vollständige Mannschaftsliste

| Mannschaft | Sommer-2026-Begegnungen | Vollständig geprüfte Einzel-/Doppelberichte | Ohne vollständig geprüften Bericht |
| --- | ---: | ---: | ---: |
| Bambini 12 | 6 | 0 | 6 |
| Bambini 12 II | 5 | 0 | 5 |
| Bambini 12 III | 5 | 0 | 5 |
| Damen | 7 | 0 | 7 |
| Damen 30 | 4 | 0 | 4 |
| Damen 40 | 7 | 0 | 7 |
| Damen 50 | 7 | 0 | 7 |
| Herren | 7 | 0 | 7 |
| Herren 40 | 7 | 0 | 7 |
| Herren 40 II | 7 | 1 | 6 |
| Herren 50 | 6 | 0 | 6 |
| Herren 50 II | 6 | 1 | 5 |
| Herren II | 7 | 0 | 7 |
| Herren III | 7 | 0 | 7 |
| Junioren 18 | 7 | 1 | 6 |
| Junioren 18 II | 7 | 0 | 7 |
| Kleinfeld U9 | 5 | 0 | 5 |
| Knaben 15 | 6 | 0 | 6 |
| Knaben 15 II | 6 | 0 | 6 |
| Mädchen 15 | 5 | 1 | 4 |
| **Gesamt** | **124** | **4** | **120** |

## Technische Umsetzung und Belegbarkeit

- `scripts/btv-meeting-rubbers-parser.mjs` unterscheidet 6+3, 4+2 und ausdrücklich gekennzeichnete kampflose Wertungen. Reguläre Sätze und Match-Tiebreaks werden nur aus amtlichen Zeilen übernommen. Er prüft jede Einzel- und Doppelposition samt tatsächlicher Personenzuordnung und das komplette Mannschaftsergebnis.
- `scripts/btv-meeting-rubbers-import-2026.mjs` validiert Saison, Club `01012`, Gegner, Heim/Auswärts, Meeting-ID, Original-PDF und Summen. Er schreibt nur im erlaubten Supabase-Projekt, nicht in den öffentlichen Liveticker. Nur `main` darf mit vorhandenen GitHub-Secrets schreiben.
- `.github/workflows/btv-meeting-rubbers-sync.yml` läuft montags, mittwochs und freitags (UTC 03:17) für bekannte verifizierte Meeting-IDs.
- `src/scripts/official-reports-admin.ts` und die Seite `/admin/?panel=official-rubbers` zeigen die vollständigen amtlichen Berichte sowie einen Filter für noch fehlende Berichte **nur nach SuperAdmin-Login**. Jugendspieler werden nicht ungeprüft auf der öffentlichen Homepage veröffentlicht.
- Quellen: `https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?dokument=MeetingReportFOP&meeting=<verifizierte-id>`. Niemals neue IDs, GroupIDs oder PDF-URLs aus vergangenen Saisons extrapolieren.

## Warum der Import nicht als fertig gelten darf

Die BTV-Tabelle und der TSV-Vereinsspielplan enthalten 2026 alle Mannschaftsresultate, aber typischerweise **nicht** die tatsächlichen Meeting-IDs der Einzel-/Doppelberichte. Die BTV-Gruppenseiten laden den Spielplan in einem dynamischen Widget nach. Dieses lieferte bei den durchgeführten CI-Quellenprüfungen nur einen Cookie-Dialog und keine belastbare vollständige Meeting-ID-Liste. Ein Abruf der alten nuLiga-Vereinsseite lieferte zudem HTTP 403. Dieser Zugriff wird nicht umgangen.

Nächste Quelle ist der regulär zugängliche BTV/tennis.de-Spielbericht pro Begegnung bzw. ein ausdrücklich autorisierter Export des BTV-Vereinscockpits. Vorhandene Spielberichte von Gastvereinen müssen pro Spiel nach Verein, Tag und Heim/Gast geprüft werden; **TSV Feldkirchen `01012` ist nicht TV Feldkirchen `02091`**. Nach einem autorisierten Quellenfund weitere Meeting-IDs speichern und den dreiwöchentlichen Import erneut ausführen. Für jede nach fünf unabhängigen Suchwegen noch nicht verfügbare Begegnung gilt eine offen ausgewiesene Prüfungslücke, nicht eine erfundene Aufstellung.

Dieser Audit-Stand dokumentiert ausdrücklich die verbleibenden Lücken, statt die 27 tatsächlich importierten Partien fälschlich als alle Sommer-2026-Einzel-/Doppelergebnisse auszugeben.
