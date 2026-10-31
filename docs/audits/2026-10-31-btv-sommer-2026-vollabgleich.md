# TSV Feldkirchen – amtlicher BTV-Vollabgleich Sommer 2026

## Abschluss 31.10.2026 – letzte zwei BTV-Endstände bestätigt

Die beiden zuletzt noch unbelegten Sommer-2026-Ergebnisse konnten durch erneuten **aktuellen Live-PDF-Abruf** mit eindeutiger Zuordnung nach Club (01012), Mannschaft, Gegner, Heim/Auswärts, Saison, Gruppe und Datum gefunden und in der TSV-Supabase-Datenbank als BTV-Endstand gespeichert werden:

| Spiel | Datum / Zeit | Offizielles Ergebnis Heim:Gast | Quelle |
| --- | --- | ---: | --- |
| ETC Siegertsbrunn II – TSV Feldkirchen Herren 50 II | 16.05.2026, 09:00 | **3:3** | [Aktueller BTV-TSV-Vereinsspielplan Sommer 2026](https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?club=23391&dokument=ScheduleReportFOP&season=18105) |
| STK Garching – TSV Feldkirchen Knaben 15 II | 10.07.2026, 15:00 | **5:1** | [Aktueller BTV-TSV-Vereinsspielplan](https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?club=23391&dokument=ScheduleReportFOP&season=18105), [BTV-STK-Garching-Vereinsspielplan](https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?club=23376&dokument=ScheduleReportFOP&season=18105) |

**Datenbankstand nach dem Import:** 124 interne Sommer-2026-Begegnungen, davon 120 mit BTV-Fixture-Snapshot, 118 mit numerischem amtlichem BTV-Endstand. **0 unbearbeitete Begegnungen**, wenn die sechs Fälle mit bereits dokumentiertem, aber teilweise noch nicht amtlich abschließend bewerteten Sonderstatus/externem Nachweis berücksichtigt werden. Numerisch unbelegt bleiben u. a. zwei vom TSV gemeldete Rückzüge, zwei offiziell dokumentierte Mannschaftsrückzüge, ein manueller Nachtrag und ein extern belegtes Ergebnis mit BTV-Prüfvorbehalt. Diese dürfen nicht als amtlich numerisch gewertete BTV-Ergebnisse bezeichnet werden.

**Wichtige Verwechslungsgefahr:** Der vom Nutzer gefundene öffentliche BTV-Bericht [Gruppe 2226499](https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?dokument=ScheduleReportFOP&group=2226499) betrifft `Herren 40 Südliga 4 Gr. 349` mit `TV Feldkirchen II (02091)` – **nicht** TSV Feldkirchen Herren 50 II (01012), Gr. 396. Dieser Link darf nicht als Quelle für TSV-Herren-50-II-Werte oder als deren Mannschaftslink gespeichert werden.

**Behobener wiederkehrender Fehler:** Der offizielle Endergebnisimport wurde zuvor nur bei ausgewählten GitHub-Main-Änderungen ausgeführt, nicht regelmäßig. Die neue [BTV-Ergebnis-Workflowregel](https://github.com/SebMut/tsv-feldkirchen-tennis/blob/main/.github/workflows/btv-results-private-import.yml) prüft den amtlichen Sommer-2026-Spielplan seit PR #60 auf `main` automatisch viermal täglich (UTC 01:23, 07:23, 13:23 und 19:23); neue numerische Resultate werden ausschließlich bei eindeutiger Paarung übernommen. Die geplanten Läufe greifen ausschließlich auf **Sommer 2026** zu.

**Alle folgenden älteren Zwischenstände bleiben ausschließlich als historische Audit-Chronologie dokumentiert.**

---

## Aktualisierung 31.10.2026 – ergänzter Gruppen- und Presseabgleich

Dieser Abschnitt ist der **neueste Datenstand**. Die Zahlen in der ursprünglichen Vollprüfung weiter unten dokumentieren den vorherigen Zwischenstand.

- **124** interne Begegnungen, davon **120** mit amtlichem BTV-Snapshot verknüpft.
- **116** numerische BTV-Ergebnisse; davon wurde **TC Malgersdorf – TSV Feldkirchen Herren 40, 5:4** am 13.06.2026 aus dem offiziellen [BTV-Gruppenspielplan Gr. 039 SU](https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?dokument=ScheduleReportFOP&group=2165602) ergänzend übernommen.
- **2 weitere amtlich belegte Rückzüge ohne numerisches Spielergebnis:** SV DJK Taufkirchen (10.04.2026) für Herren 50 II, [BTV-Vereins-Gruppeneinteilung](https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?club=23391&dokument=ResultReportFOP&season=18105&type=group), und TSV Oberpframmern II (09.04.2026) für Bambini 12, [BTV-Gruppenspielplan Gr. 849](https://btv.liga.nu/cgi-bin/WebObjects/nuLigaDokumentTENDE.woa/wa/nuDokument?dokument=ScheduleReportFOP&group=2216734). Beide wurden in `match_withdrawal_flags` mit `official_verified` gespeichert; **kein 0:0 erfunden**.
- **1 extern belegter, noch nicht amtlich bestätigter Endstand:** TC Oberding – Damen am 14.06.2026 **4:2**, Quelle [Gemeindeanzeiger Oberding/Eitting vom 19.06.2026](https://www.vg-oberding.de/fileadmin/Gemeinde/Amtsblatt/2026/Nr._24_-_19.06.2026.pdf). Der Eintrag steht **nur** in `external_match_result_reports` als `pending_btv_confirmation`, ausdrücklich **nicht** in `matches.btv_result_text`. Superadmins sehen den Beleg im Ergebniseditor.
- **2 TSV-seitig gemeldete Rückzüge ohne BTV-Einzelwertung:** TC Moosburg (Spiel 19.06.2026) und VfB Forstinning (04.07.2026). Hinzu kommt **1 manueller Rückzugsnachtrag** gegen TC Unterföhring. Die nachgewiesene spätere Moosburger Mannschaftsabmeldung am 07.07.2026 darf nicht rückwirkend als Spielwertung vom 19.06.2026 interpretiert werden.

**Noch ohne jede konkrete Ergebnis-/Rückzugsquelle bleiben genau zwei Begegnungen:**

1. **16.05.2026, 09:00 – ETC Siegertsbrunn II – TSV Feldkirchen Herren 50 II**, Gr. 396.
2. **10.07.2026, 15:00 – STK Garching – TSV Feldkirchen Knaben 15 II**, Gr. 646.

Beide stehen im offiziellen BTV-Vereinsspielplan ohne numerische Wertung. Die alten zugehörigen BTV-Gruppen-PDF-Links antworteten beim unabhängigen Live-Abruf mit HTTP 500. Es ist daher noch nicht seriös möglich, eine Ergebniszahl oder einen Rückzug einzutragen.

Datenschutz: Ausschließlich öffentliche Mannschaftsbegegnungen und Endstände, keine individuellen Jugendspieler.

---

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
