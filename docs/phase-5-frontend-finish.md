# Phase 5 – Frontend-Finish

Status: **in Abnahme** — die Arbeitspakete 5.1 bis 5.4 sind implementiert; 5.5 technisch geprüft. Eine echte visuelle Smartphone-/Desktop-Abnahme steht noch aus.

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


## Umsetzungsstand (31.10.2026)

### 5.1 Startseite – implementiert

- Existierenden hellen Premium-Hero erhalten und mit bereits vorhandenem Bild `news/platzaufbau.png` aus dem eigenen Supabase-Medienbucket dezent hinterlegt.
- LIVE-Bereich weiterhin nur bei tatsächlich laufenden Punktspielen sichtbar; bei LIVE werden Mannschaft, Ergebnis, Liveticker und Anzahl laufender Einzel/Doppel angezeigt.
- „Heute beim TSV“ zeigt LIVE-/heutige Begegnungen und ansonsten die nächsten angekündigten Punktspiele statt nur einen leeren Tag.
- Anlagenstatus bei fehlenden oder fehlerhaften Daten ausdrücklich **unbekannt** statt unbelegt „offen“, mit Link zur Buchung.
- Aktuelle Nachrichten begrenzt; Sponsorplatzierungen unverändert, Fehler- und Leerzustände verbessert.
- Polling während laufender Spiele dichter, bei ausgeblendeter Seite seltener.

### 5.2 Spieltag – implementiert

- Spieltagszentrale mit LIVE-/Heute-Bereich, zusätzlichen nächsten Punktspielen und letzten **bestätigt beendeten** Punktspielen.
- Das echte TSV-Tennis-Logo ersetzt das bisherige typografische Hero-Zeichen.
- Bestehende gemeinsame Match- und Live-Ticker-Datenlogik wird genutzt, keine parallele Ergebnisberechnung.

### 5.3 Mannschaften und Matchdetails – implementiert

- Mannschaftskarten erhalten Mannschaftsfoto, Liga/Gruppe, Saison und nächstes oder laufendes Punktspiel.
- Mannschaftsdetailseiten zeigen LIVE, kommende Spiele und vergangene Spiele in getrennten Gruppen.
- Im hervorgehobenen Mannschaftsspiel wird das TSV-Tennis-Logo auch bei Heim/Auswärts eingesetzt.
- Matchdetailseiten bieten zusätzlich zu Einzel/Doppel, Score und Galerie ein Archiv der letzten Tickermeldungen; laufende Matchdetails aktualisieren sich periodisch.

### 5.4 Weitere Seiten – implementiert

- Kalender: bevorstehende Termine zuerst, vergangene Termine ausklappbar, ICS-Links weiterhin vorhanden, öffentliche Spiele nur wenn veröffentlicht.
- Aktuelles, Training/verwaltete Inhalte, Funktionäre und Sponsoren: zeitlich begrenzte Ladeanzeigen und klarere Fehler-/Leerzustände.
- Sponsorlogos auf Übersichtsseite als `object-fit: contain` statt abgeschnittenem 16:9-Crop.
- Responsives CSS für Matchday, Mannschaftskarten, Buttons, Hero und Fokuszustände; Kalenderfilter mit Accessible Names.

### 5.5 Technische Qualität – geprüft, visuelle Abnahme ausstehend

- GitHub Actions: **Astro-Check/Build erfolgreich**, zuletzt bei `4a6b988f284aed59b61d2e085e2188f5fa03cda2`.
- GitHub Pages Preview-Veröffentlichung dieses Standes: **erfolgreich**.
- Statische Links in Startseite, Spieltag, Mannschaftsübersicht, Kalender, Header und Footer gegen Astro-Routen geprüft: **keine unbekannten internen Ziele**.
- Verbundene Browser-Vorschau `/aktuelles/` lieferte Seiteninhalt, Bilder und funktionale interne Ziel-URLs. Für die anderen Seiten war kein interaktiver Browser-Test in dieser Sitzung möglich.
- Supabase-Projekt `eaurnufdochjapfzqwvm`: **ACTIVE_HEALTHY**; aktuelle Datenprüfung: 121 veröffentlichte Spiele, 0 kommende Spiele, 0 laufende Spiele, 4 veröffentlichte News. Daher können LIVE-Ansichten zurzeit nur über Code/Bestandslogik und nicht an einem echten Live-Spiel geprüft werden.
- Die beiden verwendeten TSV-Medienpfade (Logo und Hero) existieren im eigenen Medienbucket.
- Es wurden **keine Datenbank- oder Produktionsänderungen** vorgenommen, keine Testdaten gespeichert.

### Verbleibende Abnahmepunkte

- Vorschau auf **echten Smartphones und Desktop** visuell prüfen (mehrere Bildschirmbreiten, mobile Navigation, Bilder, Touchflächen, Scroll- und Umbruchverhalten).
- Öffentliche LIVE-Ansichten bei einem tatsächlichen laufenden Spiel nochmals vollständig durchspielen.
- Aus CI-Installationslogs bekannte Dependency-Audit-Hinweise separat auf sichere Updatepfade untersuchen; funktionierendes Frontend nicht durch unkontrollierte Major-Upgrades destabilisieren.

**Phase 5 nicht endgültig als abgeschlossen markieren, bevor diese nicht automatisierbaren Abnahmen tatsächlich erfolgt sind.** Die Implementierung selbst ist auf dem Entwicklungsbranch vorhanden; keine Produktivschaltung ohne Freigabe.
