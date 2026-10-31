# Phase 5 – Frontend-Finish

Status: **in Arbeit**

## Ziel

Die öffentliche TSV-Feldkirchen-Tennis-Website wird nach Abschluss der technischen Spieltagsbasis für den späteren Go-live visuell und funktional fertiggestellt. Bestehende, funktionierende Datenlogik und das freigegebene helle TSV-Design bleiben erhalten; Phase 5 konzentriert sich auf Klarheit, Mobile-UX, Lade-/Leerzustände und konsistente öffentliche Seiten.

## Arbeitspakete

### 5.1 Startseite

- Hero und Hauptaktionen auf Desktop und Smartphone prüfen und verfeinern.
- Live-Spiel sichtbar, aber nicht aufdringlich priorisieren.
- „Heute beim TSV“ für Live-, heutige und kommende Spiele klar strukturieren.
- Anlagenstatus ohne störende dauerhafte Ladeanzeige darstellen.
- News und Schnellzugriffe vereinheitlichen.
- Sponsorenbereich sauber in die Startseite integrieren.

### 5.2 Spieltag

- Matchday-Zentrale als zentrale öffentliche Spieltagsansicht fertigstellen.
- Live / Heute / Nächste Spiele visuell eindeutig unterscheiden.
- TSV-Logo, Gegner, Heim/Auswärts und Ergebnis konsistent anzeigen.
- Direkte Wege zu Liveticker, Matchdetail und Galerie sicherstellen.
- Smartphone-Ansicht mit großen Touch-Zielen und wenig Scroll-/Suchaufwand optimieren.

### 5.3 Mannschaften und Matchdetails

- Mannschaftsübersicht und Mannschaftsdetailseiten auf konsistente Karten, Abstände und Zustände prüfen.
- Nächstes Spiel und laufendes Spiel priorisieren.
- Matchdetail mit Gesamtstand, Einzel/Doppel, Galerie und Liveticker konsistent halten.
- Fehlende Bilder mit vorhandenen Fallbacks abfangen.

### 5.4 Weitere öffentliche Seiten

- Termine/Kalender, Training, Aktuelles, Funktionäre und Sponsoren auf konsistente Lade-, Leer- und Fehlerzustände prüfen.
- Mobile Lesbarkeit und Navigation vereinheitlichen.
- Keine funktionierende Supabase-Datenlogik unnötig umbauen.

### 5.5 Qualitätsrunde

- Öffentliche Hauptseiten im GitHub-Pages-Preview prüfen.
- Mobile Layouts und Touch-Ziele prüfen.
- Keine dauerhaft sichtbaren „Wird geladen …“-Zustände nach erfolgreichem Laden.
- Links, Bilder, Logo und Hero kontrollieren.
- Astro-Build muss erfolgreich sein.

## Reihenfolge

1. Startseite
2. Spieltag
3. Mannschaften und Matchdetails
4. Termine/Training/Aktuelles/Funktionäre/Sponsoren
5. gemeinsame Mobile- und Qualitätsrunde

## Abgrenzung

- Kein Produktions-Go-live in Phase 5.
- Keine Umstellung der Produktionsdomain ohne ausdrückliche Freigabe.
- Courtbooking wird nur mit tatsächlich verfügbaren/gebuchten Funktionen integriert.
- Datenbankänderungen erfolgen nur, wenn sie für das Frontend zwingend erforderlich sind.
