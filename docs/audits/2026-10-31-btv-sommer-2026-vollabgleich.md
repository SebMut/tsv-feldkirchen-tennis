# TSV Feldkirchen – amtlicher BTV-Vollabgleich Sommer 2026

Stand: 31.10.2026. **Ausschließlich Sommer 2026**; frühere Saisons sind ausdrücklich nicht Gegenstand dieses Audits.

## Verbindliche öffentliche Quelle

- BTV/nuLiga TSV Feldkirchen (01012), Verein `23391`: [Vereinsspielplan Sommer 2026](https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?club=23391&dokument=ScheduleReportFOP&season=18105)
- Saisonkennung `sommer-2026`, BTV `season=18105`.
- Abruf ergab 3 PDF-Seiten, **120 offizielle TSV-Begegnungen**, davon 109 mit numerischem Endstand im Vereinsspielplan.
- Die verlinkte [BTV-Archivsuche Südbayern](https://www.btv.de/de/spielbetrieb/region-suedbayern.html) wird durch diesen dokumentierten 2026-Vereinsspielplan ersetzt, wenn ihr dynamisches Suchfenster keinen auswertbaren Inhalt liefert.
- Keine Einzelspieler-, Jugendspieler- oder privaten Kontaktdaten werden verarbeitet.

## Quellenabgleich und tatsächlich vorgenommene Korrekturen

Der BTV-Abgleich wurde anhand von Team-Slug, Heim-/Auswärts-Zuordnung, vollständigem Gegnernamen und offiziellen Terminen durchgeführt. Numerische Ergebnisse wurden **nicht** aus Tabellenpunkten, Fehlstellen oder Rückzugslegenden geschätzt.

1. Vier zuvor fehlende numerische BTV-Endstände übernommen:
   - Knaben 15 II auswärts gegen TS Jahn München II: 25.07.2026, 09:00, **4:2** (Heim:Gast). Zuvor 02.05.
   - Bambini 12 II auswärts gegen TS Jahn München II: 26.07.2026, 09:00, **5:1**. Zuvor 09.05.
   - Herren III auswärts gegen SV Heimstetten: 12.07.2026, 09:00, **3:6**.
   - Herren III auswärts gegen Team München: 19.07.2026, 09:00, **0:9**.
2. 13 weitere Spiele anhand der aktuellen BTV-Quelle auf die verlegten offiziellen Daten und Uhrzeiten korrigiert. Vorhandene bestätigte Ergebnisse wurden **nicht** überschrieben; vorhandene Endzeiten wurden um dieselbe Zeitdifferenz verschoben. BTV-Neudaten reichen bis 01.08.2026.
3. Drei zuvor vollständig fehlende offizielle Begegnungen mit eindeutiger Quelle neu angelegt und mit den schon vorhandenen BTV-Fixture-Snapshots verknüpft:
   - 05.07.2026 09:00 Polizei SV Haar – Herren II **0:9**
   - 12.07.2026 09:00 Herren II – TC Erding II **6:3**
   - 12.07.2026 10:00 Herren – HC Wacker München **7:2**
4. Alle 120 amtlichen `btv_fixture_snapshots` für `sommer-2026` haben nun eine Match-ID.

## Nachgewiesener Datenbankstand (31.10.2026)

| Kennzahl | Wert |
| --- | ---: |
| Offizielle BTV-Begegnungen im Vereinsspielplan | 120 |
| Mit Match-ID verknüpfte offizielle BTV-Snapshots | 120 |
| Interne Begegnungen inkl. vier zusätzlicher Sonderfälle | 124 |
| Interne Begegnungen mit numerischem BTV-Endstand | 115 |
| Ohne amtlich numerischen Endstand | 9 |
| Davon TSV-gemeldeter Rückzug, ohne BTV-Bestätigung | 2 |
| Davon manueller Rückzugsnachtrag, amtlich offen | 1 |
| Weitere noch zu klärende Fälle | **6** |

Die 115 gespeicherten Endstände können zusätzlich die individuelle BTV-Gruppenseite als Quelle haben; ein Ergebnis fehlt im Vereinsspielplan nicht automatisch in sämtlichen BTV-Quellen. Ein fehlender numerischer Endstand ist nicht gleich Rückzug.

**Sechs offene Prüfungen:**

| TSV-Team | Datum | Gegner | Heim/Auswärts | Stand |
| --- | --- | --- | --- | --- |
| Herren 50 II | 16.05.2026 09:00 | ETC Siegertsbrunn II | Auswärts | Offizieller Vereinsspielplan ohne numerisches Ergebnis |
| Herren 40 | 13.06.2026 14:00 | TC Malgersdorf | Auswärts | Offizieller Vereinsspielplan ohne numerisches Ergebnis |
| Damen | 14.06.2026 09:00 | TC Oberding | Auswärts | Offizieller Vereinsspielplan ohne numerisches Ergebnis |
| Herren 50 II | 04.07.2026 14:00 | SV DJK Taufkirchen | Auswärts | Nicht im aktuellen BTV-Vereinsspielplan; Sonderwertung prüfen |
| Knaben 15 II | 10.07.2026 15:00 | STK Garching | Auswärts | Offizieller Vereinsspielplan ohne numerisches Ergebnis |
| Bambini 12 | 11.07.2026 09:00 | TSV Oberpframmern II | Auswärts | Nicht im aktuellen BTV-Vereinsspielplan; Sonderwertung prüfen |

Drei weitere Fälle sind bereits intern als **bearbeitet, aber nicht amtlich bestätigt** gekennzeichnet: Knaben 15 gegen TC Moosburg, Herren 40 II gegen VfB Forstinning (jeweils TSV-gemeldeter Rückzug) sowie Knaben 15 gegen TC Unterföhring (manueller Rückzugsnachtrag). Die vier internen Extras gegenüber den 120 BTV-Zeilen sind TC Moosburg, VfB Forstinning, SV DJK Taufkirchen und TSV Oberpframmern II.

## Fehlerursachen und Prävention

- Zuvor wurde bei der Ergebnispaarung eine Datumsabweichung über 45 Tage verworfen. Eindeutig nachweisbare 2026-Verlegungen über zwei Monate wurden daher nicht gefunden. **PR #54** erhöht ausschließlich für Sommer 2026 das zulässige Zeitfenster auf 120 Tage. Die vollständige eindeutige Zuordnung nach Mannschaft, Gegner, Heim/Auswärts bleibt Voraussetzung.
- Der ältere 6-Stunden-Sync verwaltete in erster Linie BTV-Fixturniere/Snapshots und veröffentlichte nicht automatisch sämtliche fehlenden offiziellen Endstände. Die neuen Standings dürfen nicht mit erfundenen Punktständen aufgefüllt werden.
- Es gibt keine 2026-Quelle, die einen numerischen Endstand für jeden der sechs offenen Fälle belegt. Weiterführende BTV-Spielberichte sind deshalb als Quellen nötig, bevor eine amtliche Korrektur erfolgt.

## Prüfbar

- Supabase ausschließlich `eaurnufdochjapfzqwvm`; GitHub ausschließlich `SebMut/tsv-feldkirchen-tennis`.
- `scripts/inspect-2026-missing-results.mjs` und `.github/workflows/inspect-2026-missing-results.yml` lesen ausschließlich BTV **Sommer 2026** und dienen zur Nachkontrolle der vor der Reparatur erfassten 13 offenen Ausgangsfälle.
- Keine Änderung an privaten Spielern, Tickerdaten, manuellen Rückzugsnachweisen, früheren Saisons oder Winter 2026/27.
