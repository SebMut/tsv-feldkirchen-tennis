# Geschützter BTV-Kaderimport (Sommer, ab 2027)

Workflow: `.github/workflows/btv-roster-private-import.yml`

## Ablauf

- **Zeitplan:** montags von März bis September, ab `sommer-2027`. Die Saison
  ergibt sich aus dem aktuellen Jahr (`sommer-<Jahr>`).
- **Readiness-Check (ohne BTV-Login):** Hat die Saison in der Datenbank noch
  keine TSV-Mannschaften (`team_seasons`), endet der Lauf ruhig.
- **BTV:** Ist die namentliche Mannschaftsmeldung der Saison noch nicht
  veröffentlicht, endet der wöchentliche Lauf ruhig.
- **Plausibilitäts-Gate** (`assertPlausibleSeasonRoster`): keine unbekannten
  Abschnitte oder Überschriften, keine unzugeordneten Zeilen, kein Format- oder
  Rangfehler, höchstens 3 ungültige Namen, 60–400 Namen, mindestens 3 Klassen
  mit Namen, höchstens 100 pro Klasse. Bei Zweifel bricht der Lauf vor jedem
  Datenbankzugriff ab.
- **Import:** idempotent, nur neue Namen und Zuordnungen. Namen werden nur
  Mannschaften zugeordnet, die für die Saison existieren; Klassen ohne
  Mannschaft werden übersprungen und gemeldet. Mannschaften werden nie
  automatisch angelegt.

## Datenschutz

- Es werden ausschließlich Namen und Kaderzuordnungen geschrieben. Keine
  Spielerausweise, Geburtsdaten, LK, Kontakt- oder Zugangsdaten.
- Neue Zuordnungen setzen ausdrücklich `public_visible=false`. Bestehende
  öffentliche Freigaben werden nie zurückgesetzt, gelöscht wird nichts.
- PDF und Namen bleiben nur im flüchtigen GitHub-Runner; Logs enthalten nur
  feste Codes und Anzahlen.
- Die Einwilligung der Eltern zur internen Verwendung der Jugendkader wurde
  vom Vereinsverantwortlichen bestätigt. Öffentliche Sichtbarkeit wird davon
  unabhängig separat verwaltet.

Pushes und Pull Requests führen nur synthetische Tests aus und schreiben nie.
Manuell: `workflow_dispatch` mit der Eingabe `season` (z. B. `sommer-2027`).
