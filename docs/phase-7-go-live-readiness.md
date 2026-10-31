# Phase 7 – Technische Abnahme und Go-live-Bereitschaft

**Stand: 31.10.2026 – technisch vorbereitet, Freigabe und praktische Abnahme offen.**

## Verbindliche Projektgrenzen

- Ausschließlich Repository `SebMut/tsv-feldkirchen-tennis`, Branch `feature/astro-supabase-foundation`.
- Ausschließlich Supabase `eaurnufdochjapfzqwvm`.
- Testseite: <https://sebmut.github.io/tsv-feldkirchen-tennis/>.
- Produktivseite: <https://www.tennis-tsvfeldkirchen.de/> – **nicht umgestellt**.
- Kein Merge auf `main`, kein produktives Deployment, keine Änderung an der Domain oder produktiven Hostingdaten ohne *separate ausdrückliche Freigabe*.

## 7.1 Öffentliche Website, Smartphone und Barrierefreiheit

**Technisch überprüft**

- Astro-/TypeScript-Check und statischer Build in GitHub Actions.
- Automatische Auditdatei `scripts/audit-built-site.mjs`: wichtige Astro-Routen, vorhandene HTML-Titel, Beschreibungen, `lang=de`, Canonicals, interne statische Links, Sitemap und Preview-Noindex.
- Mobil optimierte Komponenten, Monatskalender mit heute als Starttag, Farbmarkierungen Herren/Damen/Jugend/Veranstaltungen.

**Abnahme noch offen**

- [ ] Alle öffentlichen Seiten auf realem Smartphone und Desktop visuell prüfen (mindestens kleine Smartphone-Breite und großes Display).
- [ ] Tastaturnavigation, Kontrast, Focus, Screenreader-Grundfunktionen, mobile Menüs und Schaltflächengrößen praktisch kontrollieren.
- [ ] Logo, Hero-Bild, Sponsorlogos, Galerien, Kader und Leer-/Fehlerzustände visuell ansehen.
- [ ] Nach absichtlichem Supabase-Verbindungsfehler sicherstellen, dass keine Endlos-Ladeanzeige verbleibt.
- [ ] Kalender über Monatsgrenze und Zeitumstellung testen.

Die öffentliche Website kann in dieser Chat-Sitzung nicht mit einem echten Smartphone und einem authentifizierten Browser gesteuert werden. Ein erfolgreicher Build ist dafür **kein** Ersatz.

## 7.2 Authentifizierung, Rollen und Bearbeitung

**Technisch überprüft**

- Bestehende RLS-Policies und Supabase Security Advisor geprüft.
- Externe anonyme Ausführung von `public.ensure_match_encounters(uuid)` und `public.configure_match_encounters(uuid,text)` durch Migration `20261031110000_phase7_revoke_anon_match_rpcs.sql` gesperrt.
- Anschließend nachgewiesen: `anon_allowed=false`, `authenticated_allowed=true`. Beide Funktionen enthalten zusätzlich die Spielberechtigungsprüfung `private.can_tick_match`.
- Es wurden keine echten Vereinsdaten für Tests erzeugt oder gelöscht.

**Abnahme noch offen**

- [ ] SuperAdmin: Anmeldung, Passwort-Reset, Benutzerverwaltung, Anlage, Sponsoren, Funktionäre, Termine, News und Platzierungen.
- [ ] Manager/Editor: nur zugewiesene Mannschaft, News, Kader und Spielberichte; kein Zugriff auf fremde Mannschaften.
- [ ] Nur-Ticker: zugewiesene Spiele bearbeiten, aber keine Anlage oder allgemeine Vereinsinhalte verwalten.
- [ ] Ausgeloggter Browser: darf weder Entwürfe/private Daten abrufen noch Änderungen speichern.
- [ ] Auth-Einstellungen: öffentliche Selbstregistrierung kontrolliert deaktivieren, sofern für den Betrieb gefordert. Von ChatGPT **nicht geändert**.

**Bekannte Security-Advisor-Resthinweise:** Zwei benötigte `SECURITY DEFINER`-RPCs sind für angemeldete Benutzer aufrufbar, prüfen intern aber `private.can_tick_match`; dies ist eine bewusst verbleibende, fachlich zu prüfende Warnung. Supabase meldet außerdem deaktivierte `Leaked Password Protection`; im Dashboard/Plan klären und nach Möglichkeit aktivieren. Details: <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>. Nicht als vollständig bestanden deklarieren, solange echte Rollenprüfungen ausstehen.

## 7.3 Spieltage und Liveticker

- [ ] Testspiel mit Format 6 Einzel / 3 Doppel anlegen und vollständig prüfen.
- [ ] Ausnahmeformat 4 Einzel / 2 Doppel prüfen.
- [ ] Nur TSV-Spieler zuordnen, Gegner 1 bis Gegner 6 korrekt und anonym anzeigen.
- [ ] Heim- und Auswärtsspiel, Vereinslogo, Ergebnisfortschritt und Spielstatus prüfen.
- [ ] Liveticker auf **zwei echten Geräten** öffnen, Änderungen zeitnah synchronisieren.
- [ ] Schreibrechte für unberechtigte Nutzer verifizieren.
- [ ] Testdaten rückstandsfrei entfernen bzw. in einer kontrollierten Transaktion zurückrollen.

Datenlogik ist vorhanden; **Zwei-Geräte-Test ist noch offen**.

## 7.4 Kalender, Anlagenstatus, Courtbooking, Medien

- [x] Keine simulierte Courtbooking-API; externer Buchungsweg beibehalten.
- [x] Neuer öffentlicher Kalender mit Tagesfokus und vier farblichen Markern.
- [x] Öffentliche ICS-Feeds werden über `scripts/smoke-public-services.mjs` auf Status, Inhaltstyp, korrektes VCALENDAR/VEVENT-Format und eindeutige UIDs geprüft. Keine fest kodierten/veralteten Spielanzahlen mehr.
- [x] Öffentlicher Courtbooking-Zugang im Smoke-Test erreichbar.
- [x] TSV-Logo, Hero und drei Kategorie-Standardbilder im Storage vorhanden. Automatisierter HTTP-Smoke-Test hinzugefügt.
- [ ] Kalenderabonnement in Apple Kalender und Outlook praktisch testen.
- [ ] Terminänderung/-absage über „Mein TSV“ mit passender Rolle ausprobieren.
- [ ] Anlagenstatus am Smartphone setzen, speichern und öffentlich verifizieren.
- [ ] Medien-/Bilderupload mit echten, berechtigten Konten testen.
- [ ] Saisonarchiv und Spielberichte manuell ansehen.

## 7.5 SEO, Recht, WordPress-Weiterleitungen

- [x] Sitemap auf **echten Astro-Endpunkt** `src/pages/sitemap.xml.ts` korrigiert. Die frühere `.astro`-Seite erzeugte fehlerhaft `/sitemap.xml/index.html`.
- [x] `robots.txt` aus `public/` für Produktion; Preview erhält beim GitHub-Pages-Publish zusätzlich `User-agent: * / Disallow: /`.
- [x] Preview-Markup enthält `noindex,nofollow`; Canonicals zeigen weiterhin zur späteren Produktionsdomain.
- [x] Bestehende WordPress-Weiterleitungen in `public/.htaccess` erhalten und produktiven Upload so korrigiert, dass die versteckte Datei ausdrücklich mit übertragen wird.
- [ ] Redirects auf dem tatsächlichen United-Domains-Hosting nach Freigabe und Upload prüfen (Apache-Konfiguration/Hosting).
- [ ] Rechtliche Gültigkeit von Impressum, Datenschutz und externen Hauptvereinsseiten von Vereinsverantwortlichen bestätigen lassen.
- [ ] Finale Text- und Bildfreigabe, inklusive Personenabbildungen und Spielerdaten.
- [ ] Tannebaum-Ranglisten-Inhalte und Ziel-URL fachlich klären.
- [ ] Nach Go-live Canonical-/Sitemap-Indizierung unter der echten Domain verifizieren.

## 7.6 Stabilität und Sicherheit

- [x] CI wurde von `npm install` auf reproduzierbares `npm ci` umgestellt; Build-Workflow benötigt nur `contents: read` und schreibt keinen Lockfile-Commit.
- [x] Neuer statischer Seiten-/Link-/SEO-Audit ist Teil der CI, der Preview- und des künftigen produktiven Build-Workflows.
- [x] Drei Supabase-Foreign-Key-Indizes (`match_encounters`, zwei Spielerreferenzen und `updated_by`) über additive Migration `20261031112000_phase7_match_encounters_fk_indexes.sql` eingerichtet, Existenz per SQL nachgewiesen.
- [x] Supabase Security und Performance Advisor abgefragt. Die fehlenden Fremdschlüssel-Indizes sind behoben; verbleiben `unused_index`-Infos und mehrere permissive SELECT/UPDATE-Policies. Indizes ohne Nutzungsdaten **nicht** vorschnell löschen.
- [ ] Authentifizierte praktische Berechtigungstests und vollständiger Bild-/Realtime-Durchlauf.
- [ ] Aussagekräftiger Lighthouse-/Performance-Bericht mit echtem Browser, dann ggf. Verbesserungen.
- [ ] Vor Go-live bestätigte Backups der WordPress-Dateien, Datenbank und Supabase-Daten, einschließlich dokumentierter Wiederherstellung.
- [ ] Monitoring, Betreiberkontakte und Störungs-/Fallback-Prozess festlegen.

## 7.7 Explizite Freigabeschranke

Der Workflow `.github/workflows/deploy-united-domains.yml` bleibt **rein manuell** und enthält drei Bedingungen, bevor der produktive Upload auch nur beginnt:

1. Er wird ausdrücklich auf `main` manuell gestartet.
2. Eingabe `final_approval` muss exakt `TSV-FELDKIRCHEN-GO-LIVE` sein.
3. GitHub-Repository-Variable `TSV_GO_LIVE_APPROVED` muss explizit `true` sein. Fehlt sie oder ist sie anders gesetzt, bleibt der Job gesperrt.

Zusätzlich ist `environment: production` aktiv; erforderliche Reviewer müssen **im GitHub-Repository** konfiguriert werden (die Workflow-Datei allein konfiguriert sie nicht). Die Variable wurde in dieser Phase **nicht** auf true gesetzt, der Workflow nicht gestartet und `main` nicht verändert.

**Separater Go-live-Schritt:** erst nach schriftlicher Freigabe durch den Vereinsverantwortlichen gemäß `docs/go-live-runbook.md`.

## Ergänzender Sicherheits- und Betriebscheck (31.10.2026)

- [x] **23/23 öffentliche Tabellen mit RLS** per SQL nachgewiesen.
- [x] Gefährliche Alt-Grants gefunden: `anon` hatte SQL-Tabellenprivilegien einschließlich **TRUNCATE** (RLS kontrolliert TRUNCATE nicht).
- [x] Migration `supabase/migrations/20261031120000_phase7_least_privilege_table_grants.sql` angewendet und kontrolliert: `anon` hat **0 Schreib-/TRUNCATE-/REFERENCES-/TRIGGER-Rechte** auf aktuellen öffentlichen Tabellen; angemeldete Nutzer behalten RLS-geschützte DML-Rechte, aber kein TRUNCATE.
- [x] Öffentliche und private SELECT-Policies anhand von News, Terminen, Profilen, Mitgliedschaften und Spielern stichprobenartig überprüft.
- [x] Medien-Bucket überprüft: öffentlich lesbar, Bildformate, 8-MiB-Grenze.
- [x] Verständlicher, rollenbezogener Abnahmebogen für Vereinsmitarbeiter unter `docs/phase-7-abnahme-vereinsmitarbeiter.md` erstellt.
- [x] Technischer Befund, Lesekontrollen und laufende Betriebsaufgaben unter `docs/phase-7-sicherheits-und-betriebscheck.md` dokumentiert.
- [ ] Sicherheit bei **zukünftig** angelegten Tabellen/Default-Privileges erneut überprüfen; aktuelle Migrationskorrektur wirkt auf vorhandene Tabellen.
- [ ] Echte Rollen-/Endgeräte-/Hosting-/Backup-Abnahme bleibt offen. Es gibt **keine** finale Go-live-Freigabe.

## Abnahmeentscheidung

**Phase 7 technisch vorbereitet; finale fachliche, visuelle und produktive Abnahme noch offen.** Für die eigentliche Go-live-Freigabe müssen alle oben mit `[ ]` gekennzeichneten Sicherheits- und Betriebsblocker geklärt sein. Keine automatische Freigabe auf Grundlage grüner CI-Checks.
