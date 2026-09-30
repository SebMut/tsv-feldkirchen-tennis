# Phase 2 – Mannschaften und Medien

Status: **in Umsetzung / technisch weitgehend fertig**

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

Öffentlich werden ausschließlich Einträge mit `public_visible = true` angezeigt.
Spielerbilder werden auf der öffentlichen Mannschaftsseite als Karten dargestellt.
Ohne Foto wird ein Initialen-Platzhalter verwendet.

## 2.4 Galerien

Im Bereich **Mein TSV → Bilder** können berechtigte Nutzer:

- mehrere Bilder gleichzeitig hochladen
- Galerie als Entwurf oder öffentlich anlegen
- Veröffentlichung später umschalten
- Galerie inklusive Storage-Dateien wieder löschen

Galeriebilder werden beim Upload auf WebP optimiert und verkleinert.

## 2.5 Sicherheit

Die bestehenden RLS- und Storage-Policies begrenzen Schreibzugriffe auf
zugeordnete Mannschaften bzw. SuperAdmins. Öffentliche Kaderdaten und Galerien
sind zusätzlich über `public_visible` bzw. `published` eingeschränkt.

## Noch fehlender Inhalt

Die alte Website liefert keine echten Kader oder individuellen Mannschaftsfotos.
Diese Daten müssen daher über **Mein TSV** mit realen Vereinsdaten gepflegt werden.
Die technische Funktion ist vorhanden.
