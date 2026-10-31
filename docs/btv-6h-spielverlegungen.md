# BTV-Spielplan: automatischer Sechs-Stunden-Abgleich mit News-Meldungen

**Stand: 31. Oktober 2026 · Implementierung vorbereitet, produktiver Cron noch nicht aktiviert**

## Was wird abgerufen?

Offizieller öffentlich abrufbarer **BTV-Vereinsspielplan TSV Feldkirchen (Vereinsnummer 01012)**. Die Mannschaftsliste umfasst 20 Mannschaften. Der bestätigte öffentliche Sommer-2026-PDF-Spielplan ist drei Seiten lang und enthält **120** zuordenbare Begegnungen.

Das PDF enthält bereits den Plan aller Mannschaften. Wir laden daher **eine Vereins-PDF pro Abgleich** statt 20 Mannschaftsseiten oder zahlreiche nuLiga-Abfragen abzurufen. Es gibt keine Anmeldung, kein Crawling privater Daten, keine Umgehung von Captchas/Sperren und keine automatischen Retry-Schleifen. Bei HTTP 403/429, unerwartetem PDF, fehlender Saison/Vereinsnummer oder verändertem Layout wird der Lauf abgebrochen und nichts importiert.

Offizielle, für 2026 bestätigte Kennungen: nuLiga Club `23391`, BTV Vereinsnummer `01012`, Saison `18105`. Der BTV hat für **2027 noch keine von uns verifizierte Saisonkennung** im Code; 2027 darf nicht auf Basis einer geratenen ID importiert werden. Pro Saison muss die Kennung in `scripts/btv-schedule.mjs` überprüft und konfiguriert werden.

## Wie oft?

GitHub Actions `.github/workflows/btv-club-sync.yml`:

```yaml
schedule:
  - cron: '17 */6 * * *'
```

Prüftermine: **00:17, 06:17, 12:17 und 18:17 UTC**, entsprechend 01:17/07:17/13:17/19:17 MEZ oder 02:17/08:17/14:17/20:17 MESZ. GitHub kann Läufe verzögert starten; es handelt sich nicht um eine sekundengenaue Ausführung.

**Ganz entscheidend:** GitHub-Actions-Events vom Typ `schedule` laufen nur auf dem **Standardbranch** des Repositorys. Die Implementierung liegt derzeit ausdrücklich nur auf `feature/astro-supabase-foundation`. Sie ist deshalb noch **kein aktiver, automatisch schreibender Zeitplan**. Für die spätere Freigabe ist ein separat autorisierter Merge/Release des Workflows auf den Standardbranch notwendig. Die eigentliche Produktionswebsite wird dadurch nicht automatisch veröffentlicht; ihr separater Go-live-Workflow bleibt gesperrt.

## Wann wird eine Spielverlegung veröffentlicht?

1. **Erster erfolgreicher freigegebener Abgleich:** Alle offiziellen Termine und ihre Spielzuordnung werden als stumme Vergleichsbasis in `btv_fixture_snapshots` gespeichert. Bestehende 2026-Spiele bleiben erhalten. Es erscheinen keine künstlichen „neuen“ Verschiebungs-News.
2. **Nachfolgender Abgleich:** Für jede eindeutig zugeordnete Mannschaftsbegegnung wird der neue BTV-Starttermin mit der vorigen gespeicherten BTV-Version verglichen. Gegner, Heim/Auswärts und Mannschaft definieren die datumsunabhängige Identität.
3. **Bei echter Änderung eines relevanten zukünftigen Spieltermins** prüft die Datenbank, ob das bestehende Spiel noch exakt auf dem vorherigen BTV-Termin steht, veröffentlicht ist und noch nicht live oder abgeschlossen wurde.
4. Nur dann wird das Spiel einschließlich eines ggf. vorhandenen Endzeitpunkts angepasst. Die bestehende Live-Punktewertung und Einzel-/Doppel-Ergebnisse werden nicht verändert.
5. **In derselben Datenbanktransaktion** entsteht eine veröffentlichte News-Meldung „Spielverlegung: [Mannschaft] gegen [Gegner]“ mit dem alten und neuen Termin in **Europe/Berlin**, Heim-/Auswärtshinweis und BTV-Quellenangabe. Die News erscheinen in der bestehenden **/aktuelles/**-Liste und werden dort gesondert markiert.
6. Wird ein Spiel mehrfach verlegt, wird eine vorherige automatisch erzeugte Verschiebungs-News archiviert und durch die neueste Meldung ersetzt. Redaktionelle Vereinsberichte bleiben unberührt.
7. Kein Terminwechsel bedeutet **keinen neuen News-Eintrag** (Dublettenvermeidung). Frühere bereits gespielte Begegnungen lösen keine öffentlichen Verlegungsmeldungen mehr aus.

Nicht eindeutige Gegnerzuordnungen, manuell geänderte Spieltermine und laufende bzw. abgeschlossene Liveticker werden **nicht** überschrieben. Sie werden im geschützten Änderungsprotokoll unter **Mein TSV → BTV-Spielplan** angezeigt und müssen bei Bedarf fachlich geprüft werden. Wenn der BTV Termine entfernt oder Spiele absagt, wird **nicht automatisch** ein Spiel gelöscht; das wäre eine separate Funktion mit weiterer Quellenvalidierung.

## Benötigte Aktivierung (nicht jetzt ausgeführt)

- [ ] Separat genehmigen, den sechs-Stunden-Workflow auf dem GitHub-Standardbranch bereitzustellen. Der vorliegende Entwicklungsbranch allein kann nicht cron-gesteuert laufen.
- [ ] Im selben Repository eine **serverseitige** Actions-Secret `BTV_SUPABASE_SECRET_KEY` mit ausschließlich auf das zugelassene Supabase-Projekt bezogenem Schlüssel hinterlegen. **Nie** im Frontend, Code oder Chat veröffentlichen.
- [ ] Repository-Actions-Variable `BTV_IMPORT_ENABLED=true` erst nach Freigabe setzen. Ohne diesen Wert läuft der Import nicht schreibend. (Dies ist eine andere Variable als `TSV_GO_LIVE_APPROVED` für die produktive Website.)
- [ ] Die erste Aktivierung ohne Auslösen von News/Spieländerungen als Basislauf prüfen. Anschließend die vorhandenen 2026-Spieltermine mit der BTV-Quelle vergleichen.
- [ ] Für Sommer 2027 nach offizieller Veröffentlichung die korrekte BTV-Saisonkennung und die entsprechenden `seasons`/`team_seasons`-Zuordnungen in Supabase anlegen und prüfen.
- [ ] Test einer echten Spielverlegung mit nachfolgendem Abgleich, inklusive Kalender, ICS-Abonnement, News-Anzeige und kontrollierter Rücknahme.

## Implementiert und technisch geprüft

- `scripts/btv-schedule.mjs`: offizielles PDF mit nur einem Request, strenge Vereins- und Saisonprüfung, Zuordnung der 20 Teams.
- `scripts/check-btv-parser.mjs`: liest und prüft alle 20 Mannschaften, 120 Partien und 0 unzugeordnete Begegnungen für Sommer 2026.
- `scripts/sync-btv.mjs`: lesender Standardlauf; serverseitiger Schreibmodus nur mit zusätzlicher Freigabe/Secret; wiederholbarer Abgleich.
- `.github/workflows/btv-club-sync.yml`: Cron alle sechs Stunden, gleichzeitige Läufe gesperrt.
- `supabase/migrations/20261031140000_btv_schedule_import.sql`: Quellenidentität/Importberichte.
- `supabase/migrations/20261031150000_btv_reschedule_news.sql`: geschützte Vergleichsbasis, Änderungshistorie, atomare Match-/News-Aktualisierung.
- `src/scripts/public.ts`: Kennzeichnung der News-Meldungen.
- `src/scripts/phase8.ts` und `src/pages/admin/index.astro`: schreibgeschützte Import-/Änderungsübersicht für SuperAdmins.

Die Datenbankfunktion wurde in einer **einzigen zurückgerollten Transaktion** geprüft: stummer Erstimport, echte Datumsänderung mit korrigiertem Spiel und genau einer veröffentlichten News sowie duplikatfreier erneuter Abgleich. Nach `ROLLBACK` wurden **0** Testspiele und **0** Test-News gespeichert.

## Datenschutz, Rechte, Wartung

Die neuen Tabellen `btv_fixture_snapshots`, `btv_schedule_changes` und `btv_import_runs` sind per RLS geschützt und nur SuperAdmins lesbar. Der Server-Secret wird ausschließlich von GitHub Actions in einem genehmigten Lauf benutzt. Die allgemeine Website liest weiterhin nur die bereits veröffentlichte Vereinsdatenbank, nicht direkt nuLiga.

Die nuLiga-Seite darf nicht durch hohe Abfragefrequenz oder Umgehung von Schutzmaßnahmen belastet werden. Wenn sich ihr PDF-Format, Datenmodell oder Nutzungsbedingungen ändern, muss der Parser überprüft bzw. ausgesetzt werden. Die beschriebene Lösung ist ein eigenständiger technischer Import und **keine offizielle BTV-API**.

**Kein Website-Go-live und kein Schreib-Cron ohne separate Freigabe.**
