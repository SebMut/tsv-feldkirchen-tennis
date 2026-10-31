# TSV Feldkirchen Tennis – BTV/tennis.de-Import-Audit

**Prüftag:** 31.10.2026 · **Status:** Bestandsaufnahme/Dry-Run, kein Vollimport  
**Einziges Zielsystem:** Supabase-Projekt `eaurnufdochjapfzqwvm`  
**Quellenpriorität:** BTV/nuLiga **und** tennis.de gemeinsam Priorität 1. Eine der beiden Quellen allein begründet noch keine Aussage über die Vollständigkeit. Für amtliche Satzdetails und Aufstellungen gilt der genau zugeordnete BTV-Spielbericht.

## Tatsächlich geprüfter Datenbankstand

| Saison | Teamsaisons | interne Begegnungen | mit `btv_result_text` | Heim | Auswärts | BTV-Snapshots |
|---|---:|---:|---:|---:|---:|---:|
| Sommer 2026 | 20 | 121 | 107 | 62 | 59 | 120 |
| Winter 2026/27 | 3 | 15 | 4 | 6 | 9 | 15 |
| Sommer 2027 | 0 | 0 | 0 | 0 | 0 | 0 |

**Nicht als Saisonvollständigkeit missverstehen:** `official_meeting_reports` enthält vier Teilberichte (`partial`); `official_report_rubbers` enthält 0 Positionen. `official_season_sources` und `official_team_season_refs` sind noch leer. Nach dem geprüften, ausschließlich ergänzenden Audit-Write sind in `official_import_issues` **25 ungelöste Einträge**: 14 `missing_official_result`, vier `report_rubbers_not_imported`, drei `unmapped_btv_snapshot` und vier `internal_fixture_without_btv_snapshot`.

### Quell- und Sicherheitsprüfung

- Die offizielle BTV-Vereinsseite bezeichnet TSV Feldkirchen als Verein **01012**. Bestehende Sommer-2026-Importerläufe in `btv_import_runs` verweisen auf den öffentlichen BTV/nuLiga-Vereinsspielplan mit `club=23391` und **Saison-ID `18105`**, 120 Quellzeilen. Das ist ein dokumentierter früherer erfolgreicher Importlauf, **kein** erneuter Live-PDF-Abruf dieses Audits.
- Die Quellenlinks und Gruppen-IDs sind in den bestehenden `team_seasons.btv_url` hinterlegt. Das Winter-Herrenporträt hat einen bereits gespeicherten tennis.de-Link; andere `tennis_de_portrait_url`-Felder sind noch leer.
- **Live-Quellenlücke:** Die dynamischen tennis.de-Inhalte und die nuLiga-PDF-URLs ließen sich in der aktuellen Webabfrage nicht vollständig öffnen. Daher wurden weder neue Meeting-IDs erraten noch neue Ergebnisse aus ungesicherten Fremdquellen geschrieben.
- BTV- und tennis.de-Informationen dürfen später nur nach belegtem Meeting-/Teamsaison-Matching synchronisiert werden.
- RLS ist bei den fünf privaten offiziellen Tabellen aktiviert. Die Tabellen `official_meeting_reports`, `official_report_rubbers` und `official_import_issues` gewähren `anon` keine Tabellenprivilegien; selektive Lese-Policies für `authenticated` prüfen die Teamsaison-Berechtigung. Kein Jugendname wurde in diesem Audit exportiert.

## Präzisierte Erklärung der Abweichung 121:120

Die gespeicherte Sommer-2026-Sollmenge hat **120** eindeutige Snapshotzeilen. Davon sind **117** direkt mit einem internen Match verknüpft, **3** noch nicht. Umgekehrt existieren **4** interne Matches ohne Snapshot-Matchreferenz. Daraus folgen `117 + 3 = 120` und `117 + 4 = 121`. Eine fachliche Bereinigung ist **nicht** belegt.

### Drei amtliche BTV-Snapshotzeilen ohne interne Zuordnung

| Datum | TSV-Team | Gegner | Status |
|---|---|---|---|
| 05.07.2026 | Herren II | Polizei SV Haar | `snapshot.match_id IS NULL` |
| 12.07.2026 | Herren II | TC Erding II | `snapshot.match_id IS NULL` |
| 12.07.2026 | Herren | HC Wacker München | `snapshot.match_id IS NULL` |

### Vier interne Sommerbegegnungen ohne BTV-Snapshotzuordnung

| Datum | TSV-Team | Gegner | Heim/Auswärts | Status |
|---|---|---|---|---|
| 19.06.2026 | Knaben 15 | TC Moosburg | Heim | BTV-Sonderstatus „zurückgezogen“ separat nachprüfen |
| 04.07.2026 | Herren 40 II | VfB Forstinning | Heim | 0:0/Rückzug, kein Unentschieden fingieren |
| 04.07.2026 | Herren 50 II | SV DJK Taufkirchen | Auswärts | offiziellen Gruppenbericht ermitteln |
| 11.07.2026 | Bambini 12 | TSV Oberpframmern II | Auswärts | offiziellen Gruppenbericht ermitteln |

**Nächste Prüfung für alle sieben Fälle:** Aktuellen offiziellen BTV-Gruppenspielplan und tennis.de-Teamspielplan je Teamsaison abrufen, Gegner/Heimrecht/verschobenes Datum/Meeting-ID vergleichen; keine automatische Löschung, Zuordnung oder Duplikatanlage ohne eindeutigen Beleg.

## 14 Sommer-2026-Matches ohne gespeicherten BTV-Endstand

| Interner Termin | TSV-Team | Gegner | Rolle | Prüfauftrag / bekannter früherer Quellhinweis |
|---|---|---|---|---|
| 02.05.2026 | Knaben 15 II | TS Jahn München II | Auswärts | Früher BTV 2:4; Termin-/Meeting-ID prüfen |
| 09.05.2026 | Bambini 12 II | TS Jahn München II | Auswärts | Früher BTV 1:5; Termin-/Meeting-ID prüfen |
| 16.05.2026 | Herren 50 II | ETC Siegertsbrunn II | Auswärts | Auswärts-Spielbericht suchen |
| 13.06.2026 | Bambini 12 III | TC Rot-Weiß Poing | Auswärts | Auswärts-Spielbericht suchen |
| 13.06.2026 | Herren 40 | TC Malgersdorf | Auswärts | Auswärts-Spielbericht suchen |
| 14.06.2026 | Damen | TC Oberding | Auswärts | Auswärts-Spielbericht suchen |
| 19.06.2026 | Knaben 15 | TC Moosburg | Heim | 1:5 und zurückgezogen: Sonderwertung verifizieren |
| 04.07.2026 | Herren 40 II | VfB Forstinning | Heim | 0:0 und zurückgezogen: Sonderwertung verifizieren |
| 04.07.2026 | Herren 50 II | SV DJK Taufkirchen | Auswärts | Auswärts-Spielbericht suchen |
| 10.07.2026 | Knaben 15 | TC Unterföhring | Heim | 0:0 ohne verifizierte amtliche Endwertung |
| 10.07.2026 | Knaben 15 II | STK Garching | Auswärts | Auswärts-Spielbericht suchen |
| 11.07.2026 | Bambini 12 | TSV Oberpframmern II | Auswärts | Auswärts-Spielbericht suchen |
| 12.07.2026 | Herren III | SV Heimstetten | Auswärts | Früher BTV 6:3, Liveticker `finished 0:0`: offiziell prüfen |
| 19.07.2026 | Herren III | Team München | Auswärts | Früher BTV 9:0, Liveticker `finished 0:0`: offiziell prüfen |

**Hinweis:** Die vier im Masterprompt/Audit erwähnten Ergebniszahlen sind ältere, bislang nicht erneut auf amtliche Meeting-ID verifizierte Hinweise; deshalb wurde `btv_result_text` für keinen dieser 14 Datensätze verändert.

## Vier vorhandene Teil-Spielberichte ohne Paarungsimport

| Meeting-ID | Team | Datum | Gegner | Heim:Gast | Verifikation |
|---|---|---|---|---|---|
| 12695005 | Herren 50 II | 02.05.2026 | TC Höhenkirchen | 3:3 | `partial` |
| 12696831 | Junioren 18 | 02.05.2026 | MTTC Iphitos München | 0:6 | `partial` |
| 12702107 | Mädchen 15 | 15.05.2026 | TC Topspin | 4:2 | `partial` |
| 12742553 | Herren 40 II | 02.05.2026 | WB Fideliopark München II | 7:2 | `partial` |

Der bestehende lesende GitHub-Audit prüft die PDF-Struktur, importiert aber **keine** Einzel-/Doppelaufstellungen oder Sätze. In der Datenbank stehen für diese vier Berichte weiterhin **0** `official_report_rubbers`-Zeilen.

## Verbindlicher Fortsetzungsplan

1. **Offizielle Quellen sichern:** Für Sommer 2026 und Winter 2026/27 alle BTV-Gruppen, tennis.de-Porträts, Begegnungs-URLs und Meeting-IDs eindeutig erfassen; die drei offiziellen Snapshot-Lücken und vier internen Zuordnungslücken manuell gegen Originalquellen abgleichen.
2. **Dynamische Saison-Discovery:** Sommer 2027, Winter 2027/28 und folgende nur bei vorhandenen offiziellen Saison-IDs/Teamsaison-IDs übernehmen. Bestehende historische Saisonreferenzen erhalten.
3. **Vollständigen Spielberichtparser entwickeln:** Einzel/Doppel inklusive tatsächlicher Spieler auf beiden Seiten, Satzfolge, Match-Tiebreaks, w.o., Rückzug und Kleinfeld/Motorik aus amtlichen Meeting-Reports validieren; private Datensätze RLS-geschützt speichern. Vorher separate Tests mit Erwachsenen- und Jugendberichten.
4. **Dry-Run plus Backup:** Vor Datenbank- oder produktiven Website-Änderungen Backups/Rollback, Privatsphäre, Matching und RLS kontrollieren. Nur eindeutige amtliche Änderungen übernehmen; Liveticker, Hallen- und Heim-/Auswärtszuordnung erhalten.
5. **Abnahmekriterien:** Anzahl offizieller Begegnungen = eindeutige interne Zuordnungen + dokumentierte Konflikte; alle laut Bericht vorhandenen Einzel/Doppel vollständig und mathematisch korrekt, ohne öffentliche Minderjährigennamen; keine bloße `0:0`-Wertung als Ergebnis.

## Änderungsumfang dieses Auditlaufs

Es wurden **keine** Matchresultate, Aufstellungen, Jugendlichen-Daten, Hallen, Liveticker, RLS-Regeln, Cronjobs, privaten Berichte oder Produktionsseiten geändert. **Sieben interne Prüfaufgaben wurden neu in die RLS-geschützte `official_import_issues`-Tabelle eingefügt** (3 BTV-Snapshots ohne Matchreferenz, 4 interne Begegnungen ohne Snapshotreferenz); anschließend wurde die neue Summe von **25 offenen Fällen** in Supabase verifiziert. Die übrigen 18 bestehenden Aufgaben wurden nicht verändert. Dies ist **kein** vollständiger amtlicher Import.

### Rückabwicklung des ergänzenden Prüfaufgaben-Imports

Nur die sieben neu angelegten, eindeutig markierten Audit-Einträge könnten im Bedarfsfall gezielt zurückgenommen werden. Die nachfolgende Anweisung **nicht** automatisch ausführen; sie ist ein dokumentierter Rollback-Pfad. Vor Anwendung zunächst Anzahl und fachlichen Stand nochmals prüfen.

```sql
SELECT issue_code, count(*)
FROM public.official_import_issues
WHERE details->>'audit_run'='chatgpt-btv-tennisde-20261031'
GROUP BY issue_code;

-- Rückabwicklung ausschließlich nach ausdrücklicher Kontrolle/Freigabe:
-- DELETE FROM public.official_import_issues
-- WHERE details->>'audit_run'='chatgpt-btv-tennisde-20261031'
--   AND issue_code IN ('unmapped_btv_snapshot',
--                      'internal_fixture_without_btv_snapshot');
```

