# Geschützter BTV-Kaderimport Sommer 2026

Der PDF-Download über die offiziellen, berechtigten BTV-Seiten funktioniert.
Die verwendete Quelle wurde als TSV Feldkirchen (01012), Sommer 2026,
mit sieben PDF-Seiten bestätigt.

## Verifizierte Teildaten

- Zehn dokumentierte Mannschaftsabschnitte mit sechs Altersklassenüberschriften.
  **Nur fünf Altersklassen enthalten auslesbare Spielernamen**: Herren (49),
  Herren 40 (54), Junioren 18 (23), Knaben 15 (25), Bambini 12 (21).
  Damen 40 ist als Überschrift vorhanden, hat aber im Bericht keinen Eintrag.
- 173 nummerierte Zeilen, davon 172 mit gültig extrahierbaren Spielernamen.
- Eine Zeile wird ausdrücklich ausgeschlossen, weil das Namensformat
  nicht eindeutig der erlaubten Struktur entspricht.
- Die übrigen sechs TSV-Altersklassen sind noch **nicht verifiziert**,
  insbesondere Mädchen 15 und Kleinfeld U9.
- Dieselbe bestätigte nMM-Altersklasse kann mehrere Mannschaften I/II/III
  umfassen. Der Import erweitert nur die Auswahl berechtigter Spieler,
  nicht die tagesaktuelle Aufstellung.

## Vorgehen

1. GitHub-PR prüft nur synthetische Datensätze, ohne Secrets.
2. Nach der Zusammenführung auf `main` wird einmalig die echte
   PDF-Quelle geladen und erneut gegen feste Strukturwerte geprüft.
3. Nur wenn der Bericht **exakt** zum überprüften Snapshot passt,
   werden Namen in das Projekt `eaurnufdochjapfzqwvm` übertragen.
4. Es werden ausschließlich Namen und Kaderzuordnungen geschrieben.
   Keine Spielerausweise, Geburtsdaten, LK, Kontakt- oder Zugangsdaten.
5. Neue Zuordnungen setzen ausdrücklich `public_visible=false` (in
   der aktuellen Datenbank ist der Standardwert dagegen `true`).
6. Bestehende öffentliche Freigaben werden beim Abgleich nie zurückgesetzt.
7. Der Import ist wiederholbar und ergänzt nur fehlende Zuordnungen.
8. Arbeitsdatei und Session bleiben nur im flüchtigen GitHub-Runner;
   es werden keine Namen in Logs, Commits oder Artefakte übernommen.

## Offene Nacharbeiten

Die bislang nicht abgedeckten Altersklassen einschließlich Damen 40, Mädchen 15 und Kleinfeld U9 sowie der eine
nicht lesbare Eintrag müssen über weitere verifizierte BTV-Dokumente
beziehungsweise die TSV-Mannschaftsverwaltung abgeglichen werden.

Die Einwilligung der Eltern zur Verwendung der Jugendkader wurde
vom Vereinsverantwortlichen bestätigt. Öffentliche Sichtbarkeit
wird davon unabhängig separat verwaltet.

Dieser Workflow veröffentlicht die Homepage nicht und verändert
keine Spielergebnisse.
