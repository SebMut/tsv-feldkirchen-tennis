# Phase 2 – Mannschaften und Medien

Status: **technisch abgeschlossen / Browserabnahme offen**

## 2.1 Bestandsprüfung

Die bestehende WordPress-Seite enthält keine individuellen Mannschaftsfotos.
Auf den Herren- und Jugendseiten wird dasselbe Dummybild verwendet. Öffentliche
Spielerkader sind dort ebenfalls nicht vorhanden.

Daher werden keine erfundenen Spieler oder Fotos migriert.

## 2.2 Mannschaftsbilder

- vorhandene Kategorie-Bilder in Supabase Storage:
  - `teams/herren.png`
  - `teams/damen.png`
  - `teams/jugend.png`
- alle 20 Mannschaften verwenden diese Bilder aktuell als Übergangsbild
- ein echtes Mannschaftsfoto kann im Admin pro Mannschaft hochgeladen werden
- Uploads werden clientseitig auf WebP optimiert und verkleinert
- ein echtes Teamfoto überschreibt das Übergangsbild automatisch

## 2.3 Kader und Spielerbilder

Im Bereich **Mein TSV → Kader** können berechtigte Nutzer:

- Spieler anlegen
- Anzeigenamen pflegen
- Spielerfoto hochladen
- Spieler als Mannschaftsführung markieren
- öffentliche Sichtbarkeit je Spieler steuern
- Spieler bearbeiten
- Spieler aus der Mannschaft entfernen

Neue Spieler werden aus Datenschutzgründen zunächst **intern** angelegt.
Erst nach bewusstem Aktivieren von `public_visible` erscheinen Name und ggf. Foto öffentlich.
Spielerbilder werden auf der öffentlichen Mannschaftsseite als Karten dargestellt.
Ohne Foto wird ein Initialen-Platzhalter verwendet.

## 2.4 Galerien

Im Bereich **Mein TSV → Bilder** können berechtigte Nutzer:

- mehrere Bilder gleichzeitig hochladen
- Galerie als Entwurf oder öffentlich anlegen
- Veröffentlichung später umschalten
- Galerie inklusive Storage-Dateien wieder löschen

Galeriebilder werden beim Upload auf WebP optimiert und verkleinert.
Allgemeine Mannschaftsgalerien erscheinen auf der Mannschaftsseite.
Punktspiel-Galerien erscheinen ausschließlich auf der Detailseite des jeweiligen Spiels.

## 2.5 Sicherheit

Die bestehenden RLS- und Storage-Policies begrenzen Schreibzugriffe auf
zugeordnete Mannschaften bzw. SuperAdmins. Öffentliche Kaderdaten und Galerien
sind zusätzlich über `public_visible` bzw. `published` eingeschränkt.

## Noch fehlender Inhalt

Die alte Website liefert keine echten Kader oder individuellen Mannschaftsfotos.
Diese Daten müssen daher über **Mein TSV** mit realen Vereinsdaten gepflegt werden.
Die technische Funktion ist vorhanden.


## 2.6 Punktspiel-Galerien

Galerien können jetzt zusätzlich einem konkreten Punktspiel zugeordnet werden.

Im Admin:
- Mannschaft wählen
- optional ein Punktspiel dieser Mannschaft wählen
- Galerie hochladen
- als Entwurf oder öffentlich speichern

Öffentlich:
- Spieleinträge führen auf `/spiel/?match=<id>`
- dort werden Mannschaft, Gegner, Datum, Ort und Ergebnis/Livestatus dargestellt
- veröffentlichte Galerien mit passender `match_id` erscheinen direkt auf dieser Spielseite
- wenn noch keine Galerie existiert, wird ein leerer Hinweis angezeigt
- bei Live-Spielen bleibt der Liveticker zusätzlich direkt erreichbar

## 2.7 Nächstes Spiel

Auf jeder Mannschaftsseite ist ein eigener hervorgehobener Bereich für das nächste
zukünftige Punktspiel vorgesehen. Ein laufendes Live-Spiel hat dabei Vorrang.

Der Block zeigt:
- Heim/Auswärts
- Gegner
- Datum und Uhrzeit
- Ort
- direkten Einstieg zur Spielseite
- bei laufendem Spiel zusätzlich den Liveticker

Aktuell liegen die importierten 2026-Punktspiele bereits in der Vergangenheit.
Der Block wird deshalb erst sichtbar, sobald ein zukünftiges Spiel angelegt bzw.
die nächste Saison importiert wurde.


## 2.8 Medienbetrieb

- aktuelles Mannschaftsbild ist im Admin sichtbar
- Mannschaftsfotos können ersetzt oder auf das Kategorie-Standardbild zurückgesetzt werden
- beim Ersetzen eigener Mannschafts- und Spielerfotos werden alte Dateien aus Storage aufgeräumt
- Storage akzeptiert ausschließlich JPEG, PNG, WebP und AVIF
- Bucket-Limit pro Datei: 8 MB
- Bildoptimierung findet vor dem Upload im Browser statt

## 2.9 Datenintegrität

Für Punktspiel-Galerien existiert zusätzlich der Trigger
`galleries_validate_match_team`.

Dadurch kann eine Galerie nicht gleichzeitig Mannschaft A und einem Spiel von
Mannschaft B zugeordnet werden. Diese Prüfung erfolgt in der Datenbank und nicht
nur in der Benutzeroberfläche.

## Technischer Abschlusscheck

- 20 aktive Mannschaften
- 20/20 Mannschaften mit Übergangsbild oder individuellem Bild
- keine ungültigen Punktspiel-/Galerie-Zuordnungen
- Astro-Build erfolgreich
- GitHub-Pages-Preview erfolgreich
- RLS- und Storage-Policies aktiv

Aktuell sind noch keine echten Spieler/Kader aus der alten Website übernehmbar,
weil diese dort nicht strukturiert vorhanden sind. Das ist kein technischer Blocker:
sie werden später über **Mein TSV** gepflegt.
