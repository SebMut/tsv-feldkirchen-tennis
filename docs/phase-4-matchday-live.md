# Phase 4 – Spieltag und Liveticker

Status: **abgeschlossen**

## Ziel

Mannschaftsverantwortliche und reine Liveticker-Nutzer können einen Spieltag am Smartphone mit wenigen Schritten vorbereiten und live pflegen.

## Spieltag-Format

- Standard: **6 Einzel + 3 Doppel**
- Ausnahme: **4 Einzel + 2 Doppel**
- Format wird pro Punktspiel gespeichert.
- Bei TSV Feldkirchen wird in den Matchdarstellungen das Vereinslogo verwendet.
- Heim/Auswärts bestimmt die Reihenfolge der Mannschaften und Begegnungsseiten.

## Begegnungen

Jeder Spieltag besitzt einzelne Begegnungen:

- Einzel 1 bis 6 bzw. 1 bis 4
- Doppel 1 bis 3 bzw. 1 bis 2
- TSV-Spieler werden aus dem Kader der jeweiligen Mannschaft ausgewählt.
- Gegner werden bewusst nur als **Gegner 1, Gegner 2, …** geführt.
- Bei Doppeln werden zwei TSV-Spieler und zwei Gegner-Slots gewählt.
- Jede Begegnung hat den Status **Geplant / Live / Beendet**.
- Ergebnis kann als Tennis-Ergebnistext eingetragen werden, z. B. `6:3 4:6 10:8`.
- Gewinner wird separat als TSV oder Gegner gespeichert.

## Gesamtstand

Der Gesamtstand des Punktspiels wird automatisch aus den beendeten Begegnungen berechnet.

- TSV-Sieg einer Begegnung = 1 Punkt TSV
- Gegner-Sieg einer Begegnung = 1 Punkt Gegner
- Heim/Auswärts wird automatisch auf den tatsächlichen Home-/Away-Score abgebildet.

Die Datenbank berechnet den Gesamtstand serverseitig, damit mehrere Geräte gleichzeitig sicher arbeiten können.

## Bedienung

### Vor dem Spieltag

1. In „Mein TSV“ anmelden.
2. Schnellstart öffnen.
3. Punktspiel auswählen.
4. Format 6+3 oder 4+2 wählen.
5. Begegnungen anlegen.
6. Eigene Spieler in Einzel und Doppel auswählen.
7. Bei Doppeln die Gegner-Slots wählen.

### Am Spieltag

1. „Spieltag live starten“.
2. Einzel/Doppel einzeln auf **Starten** setzen.
3. Ergebnistext eintragen.
4. Mit **TSV gewinnt** oder **Gegner gewinnt** abschließen.
5. Gesamtstand aktualisiert sich automatisch.
6. Optional allgemeine Tickermeldungen veröffentlichen.
7. Nach dem letzten Spiel den gesamten Spieltag beenden.

## Öffentliche Ansicht

Die Live-Seite zeigt:

- TSV Feldkirchen mit Vereinslogo
- Gegner
- Heim/Auswärts-Reihenfolge
- Gesamtstand
- alle Einzel
- alle Doppel
- Status jeder Begegnung
- Spieleraufstellung
- Ergebnis jeder Begegnung
- allgemeine Tickermeldungen

## Abschlussprüfung

- **6+3:** Datenbanktest erfolgreich – 6 Einzel + 3 Doppel werden korrekt erzeugt.
- **4+2:** Datenbanktest erfolgreich – 4 Einzel + 2 Doppel werden korrekt erzeugt.
- **Gesamtstand:** serverseitige Berechnung aus beendeten Begegnungen geprüft.
- **Heim/Auswärts:** Zuordnung des TSV-Ergebnisses zu Home-/Away-Score geprüft.
- **Parallelbetrieb:** Änderungen erfolgen pro Begegnung; der Gesamtstand wird serverseitig berechnet und verhindert clientseitiges gegenseitiges Überschreiben.
- **Realtime:** öffentliche Liveticker-Ansicht ist auf Matchstatus, Begegnungen und Tickermeldungen abonniert; Polling-Fallback bleibt zusätzlich aktiv.
- **Mobile:** Admin-Spieltag und Begegnungssteuerung besitzen responsive Smartphone-Layouts und große Aktionsflächen.
- **Öffentliche Darstellung:** Gesamtstand, Einzel, Doppel, Spieler, Gegner-Slots, Status und Ergebnisse sind integriert.
- **Startseite / Mein TSV:** laufende bzw. nächste Spiele werden hervorgehoben und direkt mit dem Liveticker verknüpft.

Die automatisierten Abschlussprüfungen verändern keine produktiven Spieldaten; Teständerungen werden innerhalb einer Transaktion zurückgerollt.

## Praxisabnahme

Die technische Phase 4 ist abgeschlossen. Beim ersten realen Spieltag wird zusätzlich eine Praxisabnahme mit zwei Smartphones durchgeführt. Diese ist Betriebsabnahme und kein offener Entwicklungsblocker der Phase 4. Auffälligkeiten daraus werden als eigene Nachbesserungen behandelt.
