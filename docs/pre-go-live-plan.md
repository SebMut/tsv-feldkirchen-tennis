# Vor-Go-live-Plan – aktueller Projektphasenstand

**Stand: 31. Oktober 2026. Die Produktionswebsite bleibt unangetastet.**

Dieses Dokument verwendet die *aktuellen* Phasenbezeichnungen des Website-Rebuilds. Frühere Import-/Migrationsnotizen in `docs/migration-status.md` benutzen teilweise eine ältere Zählung; die dortigen einzelnen Prüfpunkte bleiben als historische Checkliste relevant.

## Phase 1 – Bestandsaufnahme und Datenmigration

Status: **abgeschlossen**, redaktionelle Nachpflege einzelner Daten weiterhin möglich. Siehe `docs/phase-1-content-audit.md` und `docs/migration-status.md`.

## Phase 2 – Mannschaften und Medien

Status: **technisch abgeschlossen**. Mannschaftsseiten, Bilder, Kaderverwaltung und Galerien sind vorhanden. Reale Kader und Bilder werden durch berechtigte Mannschaftsverantwortliche gepflegt.

## Phase 3 – Benutzerkonten und Rechte

Status: **technisch abgeschlossen**, praktische End-to-End-Abnahme der aktuellen Gesamtversion noch erforderlich. Serverbasierte Einladungen, SuperAdmin, Manager, Editor, Nur-Ticker und RLS sind vorhanden.

## Phase 4 – Spieltagszentrale und Liveticker

Status: **implementiert, Zwei-Geräte-Praxistest offen**. 6 Einzel/3 Doppel, optional 4 Einzel/2 Doppel, Heim-/Auswärtslogik, TSV-Logo, Gegner-Platzhalter, Punkte und Echtzeitfunktionen vorhanden. Siehe `docs/phase-4-matchday-live.md`.

## Phase 5 – Öffentliches Frontend

Status: **technisch umgesetzt, visuelle Abnahme offen**. Startseite, Spieltage, News, Mannschaften, Galerie, Anlagenstatus und Fallbacks überarbeitet. Siehe `docs/phase-5-frontend-finish.md`.

## Phase 6 – Vereinsfunktionen

Status: **technisch weitgehend umgesetzt, fachliche Abnahme offen**. Courtbooking-Weiterleitung, Monatskalender mit farbigen Herren-/Damen-/Jugend-/Veranstaltungsmarkern, Anlagenstatus, News, Funktionäre, Sponsoren, Saisonarchiv und Mein TSV. Siehe `docs/phase-6-vereinsfunktionen.md`.

## Phase 7 – Technische Qualitätsprüfung und Go-live-Bereitschaft

Status: **technische Vorbereitung umgesetzt, Abnahme offen**.

- [x] CI-/SEO-/Sitemap-/Linkaudits erweitert
- [x] Öffentliche Service-, ICS-, Courtbooking- und Medien-Smoke-Tests
- [x] Unnötige anonyme RPC-Berechtigung entfernt
- [x] Supabase-Fremdschlüssel-Indizes ergänzt
- [x] Preview-Crawler-Sperre und Build-Schutz
- [x] Produktionsdeployment mit ausdrücklicher mehrstufiger Freigabesperre
- [x] Separater Go-live- und Rollback-Plan dokumentiert
- [ ] Reale Browser-/Smartphone-Abnahme
- [ ] Live-Ticker-Praxis mit zwei Geräten
- [ ] Echte Rollen-/CRUD-End-to-End-Tests
- [ ] Rechtliche/Inhaltliche Freigabe, Produktionsbackup und Hosting-Preflight
- [ ] Separates schriftliches Go-live-Einverständnis

**Verbindliche Detaildokumente:**
- `docs/phase-7-go-live-readiness.md`
- `docs/go-live-runbook.md`

**Es findet ohne ausdrückliche separate Go-live-Freigabe weder ein Merge auf `main` noch eine Produktivumstellung statt.**
