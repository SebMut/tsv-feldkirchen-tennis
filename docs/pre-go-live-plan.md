# Pre-Go-Live Plan

Die produktive Domain und United Domains bleiben bis zur finalen Abnahme unangetastet.

## Phase 1 – Inhalte und Datenbestand
Status: **abgeschlossen**

Siehe `docs/phase-1-content-audit.md`.

## Phase 2 – Mannschaften und Medien
Status: **abgeschlossen**

- Übergangsbilder für alle Mannschaften eingerichtet
- Mannschaftsfoto-Upload vorhanden
- Kader-/Spielerverwaltung erweitert
- öffentliche Sichtbarkeit je Spieler
- Spielerbilder
- Sponsorlogos vorhanden
- Galerien inkl. Entwurf/Veröffentlichen/Löschen
- Bildoptimierung auf WebP

Reale Mannschaftsfotos, Kaderdaten und Spielerbilder werden künftig redaktionell über **Mein TSV** gepflegt und blockieren den weiteren Projektfortschritt nicht.

## Phase 3 – Admin und Rechte
Status: **technisch abgeschlossen / Praxistest offen**

- SuperAdmin vorhanden
- sichere serverseitige Einladungen
- Benutzerstatus und letzte Anmeldung
- mehrere Mannschaften pro Nutzer
- Rolle je Mannschaft
- Editor/Manager vs. Nur-Liveticker in der Oberfläche getrennt
- RLS bleibt die verbindliche Berechtigungsebene
- Passwort-Reset
- Benutzerzugänge löschbar
- letzter SuperAdmin geschützt

Noch offen: einen echten zweiten Benutzer einladen und die Testmatrix aus `docs/phase-3-auth-roles.md` praktisch abnehmen.

## Phase 4 – Spieltag und Liveticker
- Testspiel durchführen
- zwei Browser / Endgeräte
- Smartphone-Abnahme

## Phase 5 – Kalender, Anlage und Courtbooking
- ICS-Feeds extern gegenprüfen
- Anlagenstatus testen
- Courtbooking-Anbindung finalisieren

## Phase 6 – Recht, SEO und Weiterleitungen
- alte WordPress-URLs prüfen
- Redirects finalisieren
- Rechtstexte vor Go-Live abgleichen

## Phase 7 – Technische Abnahme
- öffentliche Seiten
- Auth
- CRUD
- mobile Darstellung
- Performance
- Barrierefreiheit
