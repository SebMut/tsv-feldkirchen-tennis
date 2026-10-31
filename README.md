# TSV Feldkirchen Tennis

Neue Vereinswebsite und Verwaltungsplattform für die Tennisabteilung TSV Feldkirchen.

## Architektur

- Astro 7 (statischer Build, TypeScript)
- Supabase Postgres, Auth, Storage und Realtime
- GitHub Actions für Build und GitHub-Pages-Vorschau
- United Domains als späteres Produktivhosting
- Courtbooking bleibt das externe Platzbuchungssystem

**Projektgrenzen:**
- GitHub-Repository: `SebMut/tsv-feldkirchen-tennis`
- Einziges Supabase-Projekt: `eaurnufdochjapfzqwvm`
- Entwicklungsbranch: `feature/astro-supabase-foundation`
- Vorschau: <https://sebmut.github.io/tsv-feldkirchen-tennis/>
- Produktion: <https://www.tennis-tsvfeldkirchen.de/> (**nicht ohne separate Freigabe umstellen**)

## Lokale Entwicklung

Node.js gemäß `.nvmrc` verwenden.

```bash
npm ci
npm run dev
```

## Build und technische Prüfung

```bash
npm run build
npm run audit:site
node scripts/smoke-public-services.mjs
```

- `npm run build` umfasst den Astro-/TypeScript-Check und die statische Generierung.
- `audit:site` prüft lokale Seiten, Links, Meta-Angaben, Preview-Noindex und `sitemap.xml` im erzeugten `dist/`.
- Der Smoke-Test prüft veröffentlichte ICS-Feeds, Courtbooking und öffentlich erreichbare Vereinsbilder ohne Testdaten zu schreiben.
- CI und GitHub-Pages-Vorschau laufen auf dem Feature-Branch automatisch.
- Ein produktives SFTP-Deployment wird ausschließlich nach **separater schriftlicher Freigabe** manuell ausgelöst; der Workflow benötigt zusätzlich Branch- und Freigabe-Checks.

## Konfiguration

Es werden ausschließlich öffentliche Supabase-Publishable-Keys im Browser verwendet. Vertrauliche Admin-/Service-Keys dürfen nie im Frontend oder Repository liegen. Siehe `.env.example`.

## Design

- Öffentliche Website: Konzept **03 – Modern Premium**
- Spieltagszentrale und Liveticker: Konzept **05 – Matchday Dashboard**
- Helles Layout, Original-TSV-Tennis-Logo, Rot `#e30613`

## Projektstatus und Go-live

- Technischer Umsetzungsstand: `docs/pre-go-live-plan.md`
- Phase 7 / noch offene Abnahme: `docs/phase-7-go-live-readiness.md`
- Nur nach Freigabe: `docs/go-live-runbook.md`
- Bestehende Betriebshinweise: `docs/operations.md`

Der eigentliche Go-live ist **kein Bestandteil** der laufenden technischen Vorbereitungsarbeiten.

## Phase 8 – zusätzliche Vereinsfunktionen

Der Entwicklungsbranch enthält jetzt Spieltags-Cockpit 2.0, personalisierte „Mein TSV“-Karte, Wochenkalender mit Favoriten, installierbare Web-App-Grundlage, Mannschaftsstatistik, Vereinsbrett, Änderungsprotokoll und erleichterte Spielberichte. Siehe `docs/phase-8-vereinskomfort.md` für den konkreten Umsetzungsstand und die **noch offenen Praxistests**.

Die produktive Domain bleibt bis zur separaten ausdrücklichen Go-live-Freigabe unverändert.
