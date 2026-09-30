# Migrations- und Abnahmestatus

Produktive Domain: **noch nicht umstellen**.

## Phase 1 – Inhalte

- [x] WordPress-Snapshot versioniert
- [x] 124 Punktspiele 2026 als strukturierte Matches importiert
- [x] 3 Vereinsveranstaltungen importiert
- [x] 4 redaktionelle Beiträge importiert
- [x] Mitgliedschaft, Kontakt und Training als verwaltete Seiten vorhanden
- [x] Funktionäre und Unterstützer importiert
- [ ] Tannebaum-Ranglisten fachlich prüfen; der öffentliche WordPress-REST-Export enthält keinen verwertbaren Seiteninhalt

## Phase 2 – Mannschaften und Medien

- [x] 20 Mannschaften für Saison 2026
- [x] Liga, Gruppe und BTV-Link hinterlegt
- [x] Vereinslogo, Sponsorlogos, Newsbilder und Kategorie-Bilder nach Supabase Storage migriert
- [x] Legacy-Medienimport nach erfolgreichem Lauf wieder gesperrt
- [ ] Kader und Spielernamen: keine verlässliche strukturierte Quelle in WordPress; durch Mannschaftsverantwortliche pflegen

## Phase 3 – Admin und Rechte

- [x] RLS aktiv
- [x] öffentliche Leser sehen nur veröffentlichte Inhalte
- [x] keine anonymen Schreib-Policies
- [x] Rollen SuperAdmin / Manager / Editor / Ticker technisch vorhanden
- [x] Benutzer-Einladungen serverseitig über Edge Function
- [ ] erster realer SuperAdmin
- [ ] reale Mannschaftsnutzer und Mehrfach-Team-Zuordnung testen

## Phase 4 – Spieltag und Liveticker

- [x] Spieltagsseite im Design 05
- [x] Startseite im Design 03
- [x] scheduled -> live -> finished technisch getestet
- [x] Tickermeldung und Score-Änderung technisch getestet
- [x] Test vollständig zurückgerollt; keine Fake-Ergebnisse gespeichert
- [ ] Bedienung mit realem Team-Nutzer auf Smartphone testen

## Phase 5 – Kalender, Anlage und Courtbooking

- [x] 8 Plätze angelegt
- [x] Anlagenstatus startet neutral als unknown
- [x] Courtbooking bleibt externes Buchungssystem
- [x] ICS-Gesamtfeed getestet: 124 Punktspiele
- [x] ICS-Herrenfeed getestet: 7 Punktspiele
- [x] Courtbooking-Verbindung im Smoke-Test erreichbar
- [x] alte ICS-URLs auf neue Feeds vorbereitet

## Phase 6 – Recht, SEO und Redirects

- [x] Impressum, Datenschutz und Satzung führen zum Hauptverein
- [x] lokale Brückenseiten noindex
- [x] noindex-Seiten aus Sitemap entfernt
- [x] alte Mannschafts- und Spielplan-URLs erhalten 301-Ziele
- [x] alte Termin- und Match-URLs erhalten 301-Ziele
- [x] Canonical, OpenGraph, robots.txt, Sitemap und 404 vorhanden
- [ ] Tannebaum-Ranglisten-URL final festlegen, sobald Inhalt geklärt ist

## Phase 7 – Abnahme

- [x] Astro CI-Build
- [x] GitHub-Pages-Preview-Deployment
- [x] Supabase Security Advisor ohne Findings
- [x] Public-Service-Smoke-Test
- [ ] erster SuperAdmin + Login
- [ ] Team-Nutzer-End-to-End-Test
- [ ] Smartphone-Abnahme mit echten Accounts
- [ ] finale Inhaltsfreigabe
- [ ] erst danach United Domains / Produktivdomain
