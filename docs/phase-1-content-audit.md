# Phase 1 – Inhalte und Datenbestand

Status: **abgeschlossen**

## Übernommene Inhalte

- Kontakt
- Mitglied werden inklusive aktuellem Link zu den Formularen des Hauptvereins
- Training inklusive Tennisschule Alex Braun
- Impressum
- Datenschutz
- 4 allgemeine Vereins-News
- 3 allgemeine Vereinsveranstaltungen
- 8 Funktionäre
- 9 Sponsoren / Unterstützer
- zentrale Vereinsdaten in `site_settings`

## Spielbetrieb

- 20 aktive Mannschaften
- 20 Saison-Zuordnungen für 2026
- Liga für alle 20 Mannschaften vorhanden
- BTV-Link für alle 20 Mannschaften vorhanden
- 124 Punktspiele für 2026
- kein Spiel ohne Gegner
- kein Spiel ohne Startzeit
- Zeitraum der importierten Punktspiele: 01.05.2026 bis 19.07.2026

## Bewusste Migrationsentscheidung

Die alte WordPress-Seite erzeugt zusätzlich einzelne News-Beiträge aus Punktspielen
(z. B. "Damen 30: Heimspiel gegen ..."). Diese werden **nicht zusätzlich als News
dupliziert**, weil die Begegnungen bereits strukturiert in `matches` vorhanden sind.
Auf der neuen Plattform erscheinen sie über Spielplan, Mannschaftsseite und Spieltag.

Damit vermeiden wir doppelte Pflege und doppelte Inhalte.

## Medien

Die für Phase 1 relevanten öffentlichen Medien liegen bereits in Supabase Storage:

- Tennis-Logo
- 4 News-/Veranstaltungsbilder
- 9 Sponsorlogos
- 3 vorhandene Mannschafts-Kategoriebilder (Herren, Damen, Jugend)

Die veröffentlichten News verweisen auf die Dateien im Storage und sind damit nicht mehr
von WordPress-`wp-content` abhängig.

**Phase 2** übernimmt anschließend die mannschaftsbezogenen Medien:
konkrete Mannschaftsfotos, Spielerbilder und spätere Galerien.

## Phase-1-Abnahmekriterien

- alle öffentlichen Kerndaten sind in Supabase vorhanden
- Mannschafts- und Spielplandaten sind vollständig strukturiert
- zentrale Kontaktdaten und Kennzahlen sind konsistent
- keine doppelten Slugs bei News oder Veranstaltungen
- bestehende WordPress-Punktspiel-Posts werden bewusst nicht dupliziert
- Phase 2 kann ohne weitere Schema- oder Inhaltsgrundlagen beginnen
