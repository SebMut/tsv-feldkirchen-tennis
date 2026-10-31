# Offizielle Mannschaftsquellen – TSV Feldkirchen (BTV 01012)

## Verbindliche Aufgaben je Quelle

- **tennis.de-Vereinswidget:** Zeigt die aktuell gemeldeten Mannschaften des Vereins
  samt Porträts, namentlichen Meldungen, Tabellen und Ergebnissen. Der DTB
  aktualisiert das Widget automatisch auf die aktuelle Saison. Dieses
  Widget ist eine externe Anzeige, keine interne TSV-Datenbank-API.
- **BTV-/nuLiga-Spielplandokumente:** Saisonbezogene Termine, Gegner und
  Heim-/Auswärts-Eigenschaft. Der sechs-Stunden-Abgleich auf GitHub main
  unterscheidet Sommer 2026 von Winter 2026/27. Schreibvorgänge bleiben
  durch die bestehende ausdrückliche Importfreigabe geschützt.
- **Geschützte offizielle BTV-Mannschaftsmeldungen:** Verifizierte
  Spielerkader einschließlich Jugend. Nur intern berechtigte Mitarbeiter
  dürfen private Kader verwalten, keine Rohdaten in GitHub protokollieren.

Die TSV-Datenbank bleibt maßgeblich für **historische Saisons, tatsächliche
Winterhallen, Routenbutton und Liveticker**. Der Heimspielstatus beschreibt
die Wettkampfrolle und bleibt unabhängig vom Spielort. Insbesondere wird
die Vereinsadresse in Feldkirchen nicht als Hallenanschrift verwendet.

## Bestätigter Stand vom 31.10.2026

Der GitHub-Einmalimport #41219064787 hat 134 eindeutige Spielerprofile
und 414 private Mannschaftszuordnungen aus der offiziellen Sommer-2026-nMM
angelegt. Er umfasst die Klassen Herren, Herren 40, Junioren 18, Knaben 15
und Bambini 12. Aus 173 gemeldeten Zeilen wurden 172 sicher gelesen;
eine uneindeutige Zeile wurde nicht übernommen.

Die Wintermannschaften Herren, Herren II und Herren 50 besitzen eine
**eigene Saisonmeldung**. Ein ungeprüftes Kopieren von Sommer-Namen
nach Winter ist nicht erlaubt.

## Datensicherheit und Qualitätsgrenzen

- Einwilligungen der Eltern für die Jugendspieler sind laut dem
  Vereinsverantwortlichen vorhanden; die öffentlichen Freigaben werden
  trotzdem getrennt verwaltet.
- Neue Mannschaftszuordnungen sind jetzt durch den Datenbankdefault
  **nichtöffentlich**. Bestehende Freigaben bleiben erhalten.
- Die offiziellen PDF-Dateien und ihre personenbezogenen Details werden
  weder im GitHub-Repository noch in GitHub-Artefakten veröffentlicht.
- Ein saisonfremdes, widersprüchliches oder unvollständiges Spielplan-PDF
  beendet den BTV-Abgleich, statt Hallen/Termine unkontrolliert zu ändern.
- tennis.de lädt im TSV-iframe erst nach einem Klick auf das Aufklappfeld.

## Noch offene Arbeit

1. Eigenständige Winter-2026/27-nMM kontrollieren und privat importieren.
2. Fehlende Sommer-Klassen (u. a. Mädchen 15 und Kleinfeld U9) und die
   uneindeutige Einzelzeile anhand einer offiziellen Meldung prüfen.
3. Login, Liveticker und Hallenroute in einem autorisierten Mobilbrowser testen.

Offizielle Beschreibung der Widgets:
https://www.tennis.de/service/widgets-fuer-vereine/mannschaftswidget-fuer-vereine.html
