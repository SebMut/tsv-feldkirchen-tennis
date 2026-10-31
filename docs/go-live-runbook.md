# TSV Feldkirchen Tennis – Go-live-Runbook (nur nach separater Freigabe)

**Status: vorbereitet, NICHT ausgeführt.**

Dieses Runbook ist für den späteren, ausdrücklich freigegebenen Übergang von der bestehenden WordPress-Seite zur Astro-/Supabase-Website bestimmt. **Niemals** aus der Erstellung dieses Dokuments eine Freigabe ableiten.

## 0. Technische Grenzen

- GitHub: `SebMut/tsv-feldkirchen-tennis`.
- Supabase: ausschließlich `eaurnufdochjapfzqwvm`.
- Vorschau: <https://sebmut.github.io/tsv-feldkirchen-tennis/>.
- Produktion: <https://www.tennis-tsvfeldkirchen.de/>.
- Keine neue Datenbank, keine neuen fremden Hostingziele und kein stillschweigender Wechsel des Produktivbranchs.

## 1. Freigabekriterien (alle zwingend)

- [ ] Betreiber nimmt Phase 7 schriftlich und ausdrücklich ab; insbesondere Funktionalität auf Mobilgerät, Redaktion, Live-Ticker mit zwei Geräten und Benutzerrechte.
- [ ] Ansprechpartner und rechtliche Freigabe für Bilder/Personen, Kontaktangaben, Impressum/Datenschutz und WordPress-Altinhalte liegen vor.
- [ ] Supabase Auth-Konfiguration geprüft: nur vorgesehene Zugangswege und Passwortschutz, keine anonyme Schreibberechtigung.
- [ ] Backup der bisherigen WordPress-Dateien **und** WordPress-Datenbank erstellt und Wiederherstellung getestet.
- [ ] Zusätzlich Export-/Wiederherstellungsplan für die bestehenden Supabase-Vereinsdaten dokumentiert.
- [ ] Bisherige WordPress-URLs und Weiterleitungen durchgesprochen; Ranglisten-Ausnahme ggf. geklärt.
- [ ] GitHub-Actions-Build und GitHub-Pages-Vorschau des konkret freizugebenden Commits vollständig erfolgreich.
- [ ] United-Domains-Zielverzeichnis und aktive Webserver-/PHP-/Apache-Konfiguration durch Hosting-Verantwortliche bestätigt, insbesondere die Wirkung von `.htaccess`.
- [ ] Sichere Entscheidung getroffen, wie alte WordPress-Dateien im produktiven Webroot archiviert bzw. getrennt werden. **Der aktuelle SFTP-Workflow löscht keine Altdateien und macht kein Cleanup.**
- [ ] Die spätere Umstellung wurde für alle Vereinsverantwortlichen angekündigt.

## 2. Explizite Deploy-Freigabe

Die Workflow-Datei `.github/workflows/deploy-united-domains.yml` besitzt absichtlich eine mehrteilige Sperre:

1. Feature-Branch erst **nach separater schriftlicher Freigabe** kontrolliert nach `main` übernehmen.
2. Im GitHub-Repository unter **Settings → Environments → production** benötigte Prüfer („Required reviewers“) konfigurieren, soweit verfügbar.
3. Erst nach Freigabe unter **Settings → Secrets and variables → Actions → Variables** die Repository-Variable `TSV_GO_LIVE_APPROVED=true` setzen.
4. Erst dann `Deploy to United Domains` aus **Actions** manuell auf `main` auslösen und als `final_approval` exakt `TSV-FELDKIRCHEN-GO-LIVE` eintragen.
5. Nach erfolgreichem Abschluss die Variable sofort wieder deaktivieren/entfernen; keine Dauerfreigabe.

Ohne Branch, exakte Eingabe und aktivierte Variable wird der Job übersprungen. Die Repository-Variable und Umgebungs-Reviewer werden nicht automatisch durch ChatGPT eingerichtet. Die Produktiv-SFTP-Zugangsdaten dürfen ausschließlich als GitHub-Secrets hinterlegt sein, nie im Code oder Chat.

## 3. Produktiv-Upload und Apache-Weiterleitungen

Der Workflow baut eine statische Astro-Seite mit `npm ci`, `npm run build` und `npm run audit:site`. Nur danach beginnt der manuell freigegebene SFTP-Upload.

- Die generierten Dateien aus `dist/` werden auf den bestätigten Zielpfad kopiert.
- **Wichtig:** `dist/.htaccess` ist versteckt und wird deshalb zusätzlich explizit hochgeladen. Nur so können die vorbereiteten WordPress-301-Weiterleitungen auf Apache wirken.
- Der Upload entfernt **keine** vorhandenen Dateien, Datenbanken oder WordPress-Inhalte. Die Webroot-Bereinigung und etwaige Kollisionen mit verbliebenen WordPress-Routingregeln müssen vorab vom Hoster geplant werden.
- Das GitHub-Pages-Preview verwendet eine eigene `robots.txt` mit `Disallow: /`; die produktive Site verwendet dagegen die `public/robots.txt` mit gültigem Sitemap-Hinweis.

## 4. Sofortkontrolle nach ausdrücklich freigegebenem Upload

- [ ] Startseite erreichbar, echtes TSV-Tennis-Logo und Hero-Bild vorhanden.
- [ ] Hauptnavigation auf Mobil/Desktop; Mannschaften, Mannschaftsdetail, Spieltag, Kalender, News und Kontakt erreichbar.
- [ ] `/sitemap.xml` liefert tatsächlich XML (nicht HTML/Ordnerinhalt), `/robots.txt` erlaubt normale öffentliche Seiten.
- [ ] Canonical verweist auf die Produktionsdomain; Live-Seiten haben kein allgemeines `noindex`; Admin und rechtliche Brückenseiten bleiben `noindex`.
- [ ] Alte WordPress-URLs geben die vorgesehenen 301-Weiterleitungen zurück, z. B. `/spielplaene/`, `/herrenmannschaften/`, `/kalender-downloaden/`.
- [ ] Courtbooking kann extern geöffnet werden, ICS-Abos bleiben erreichbar.
- [ ] „Mein TSV“ Login, Rollen und Platzstatus funktionieren, aber keine unbefugten Adminaktionen.
- [ ] Liveticker Live-/Realtime-Ansicht funktioniert bei einem berechtigten Testspiel.
- [ ] Fehler-/Ladezustände und mobil lesbare Navigation okay.
- [ ] Öffentliches Monitoring sowie Vereinssupport nach dem Wechsel erreichbar.

## 5. Rückfallverfahren

**Bei kritischen Defekten keinen weiteren unkontrollierten Upload durchführen.**

1. Den dokumentierten letzten funktionsfähigen Stand und die WordPress-Backups bereithalten.
2. Bei Bedarf durch die dazu berechtigte Hostingperson die **vorherigen** WordPress-Dateien, Datenbank und Webserverkonfiguration einschließlich der alten `.htaccess` aus dem Backup wiederherstellen.
3. Falls DNS-/Domain-Einstellungen ausdrücklich geändert wurden, deren zuvor erfasste Werte zurückstellen. DNS-Änderungen sind **nicht** Bestandteil des automatischen Workflows.
4. Datenkonsistenz zwischen WordPress und Supabase fachlich prüfen; keine Supabase-Inhalte blind löschen.
5. `TSV_GO_LIVE_APPROVED` wieder deaktivieren und Vorfall dokumentieren.

## Dokumentation

- Phase-7-Status: `docs/phase-7-go-live-readiness.md`.
- Technischer Betrieb: `docs/operations.md`.
- WordPress-Migration: `docs/migration-status.md`.
- Projektvorschau: <https://sebmut.github.io/tsv-feldkirchen-tennis/>.

**Bis zur ausdrücklichen Go-live-Freigabe sind diese Schritte reine Vorbereitung.**
