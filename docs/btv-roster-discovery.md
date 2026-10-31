# BTV: TSV-Mannschaftskader im geschützten Downloadbereich erkennen

Status: Lesender Prüfworkflow. **Kein Import und kein Download** von namentlichen Mannschaftsmeldungen.

## Zweck

Der bereits erfolgreiche BTV-Cockpit-Logincheck prüft nur Anmeldung und Cockpit.
Der anschließende Schritt muss sicherstellen, dass dieselbe Sitzung tatsächlich
den TSV Feldkirchen (**Vereinsnummer 01012**) auswählt und einen Menüpunkt
„Downloads“ mit einer namentlichen Mannschaftsmeldung erreicht.

## Ablauf

GitHub Actions: `.github/workflows/btv-roster-discovery.yml`, ausschließlich
im Repository `SebMut/tsv-feldkirchen-tennis`. Nach dem Merge auf den
Standardbranch `main` erfolgt genau ein lesender Prüfungslauf. Der Workflow
kann anschließend auch manuell über `workflow_dispatch` gestartet werden.
Er besitzt keine automatische Wiederholung.

Die Zugangsdaten werden nur aus den GitHub Secrets `BTV_LOGIN_USERNAME`
und `BTV_LOGIN_PASSWORD` an den bereits installierten Browser übergeben.
Sie erscheinen weder in PR-Prüfungen noch in Lognachrichten.

Der Browser hält die Sitzung nur im Arbeitsspeicher. Es werden keine
PDFs angefordert, keine Screenshots oder Sitzungsdateien gespeichert und
keine Daten an Supabase, das GitHub-Repository oder fremde Server übertragen.
Geschützte Dokumentlinks, andere Vereinsnamen, Personen und Spielerdaten
werden nicht protokolliert.

## Mögliche Ergebnis-Flags

- `BTV_TSV_SCOPE=CONFIRMED`: TSV Feldkirchen und Vereinsnummer 01012 in
  der ausgewählten Verwaltungsansicht bestätigt.
- `BTV_NMM_DOWNLOAD=AVAILABLE`: Die Bezeichnung einer namentlichen
  Mannschaftsmeldung wurde im Downloadbereich gefunden; der Inhalt wurde
  noch nicht gelesen.
- `BTV_SUMMER_2026_LISTED=YES|UNCONFIRMED`: Saisonbezeichnung erkannt oder
  nicht bestätigt.
- `BTV_WINTER_2026_27_LISTED=YES|UNCONFIRMED`: Saisonbezeichnung erkannt
  oder nicht bestätigt.
- `BTV_ROSTER_TRANSFER=NONE`: Kein Spielerdaten-Import ausgeführt.
- `BTV_ROSTER_DISCOVERY=SUCCESS`: Alle Kernprüfungen erfolgreich.

Bei Fehlern stehen ausschließlich feste Codes im Log, z. B.
`TSV_SCOPE_NOT_CONFIRMED`, `DOWNLOADS_MENU_NOT_FOUND` oder
`NMM_DOWNLOAD_NOT_DISCOVERED`.

Falls der Account einen Verein zuerst auswählen muss, prüft der Browser ein
explizites Auswahlfeld für **TSV Feldkirchen (01012)** vor dem Start-Klick.
Für den Fall einer nicht erkannten Auswahl enthält der Lauf zusätzlich nur
anonymisierte Strukturflags `BTV_DIAG_START_CLICKED`, `BTV_DIAG_TSV_NAME`,
`BTV_DIAG_TSV_NUMBER`, `BTV_DIAG_NULIGA_PAGE`,
`BTV_DIAG_DOWNLOADS_TEXT` und `BTV_DIAG_PAGE_COUNT`.
Die vollständigen Seiteninhalte und Links bleiben immer unveröffentlicht. Ein Fehlschlag ist **kein Anlass** für
automatisches Wiederholen oder Umgehen von Captcha/MFA.

## Freigabe vor einem späteren Datenimport

1. Den offiziellen Dokumenttyp sowie die korrekte Saison und TSV-Teamzuordnung
   anhand des freigegebenen PDFs prüfen.
2. Für den TSV-Spielbetrieb nur Spielernamen und erforderliche Teamzuordnungen
   übernehmen; keine Geburtsdaten, Telefon- oder E-Mail-Adressen.
3. Vereins- und Datenschutzfreigabe für die Verwendung der namentlichen
   Mannschaftsmeldung sicherstellen; bei Jugendspielern keine ungeprüfte
   öffentliche Veröffentlichung.
4. Neue Einträge nur im Projekt `eaurnufdochjapfzqwvm` und standardmäßig
   `public_visible=false` speichern. Niemals personenbezogene Rohdaten in
   GitHub, Action-Logs oder Artefakte schreiben.
5. Regelmäßige automatisierte Downloads erst nach gesonderter Klärung von
   Zugangsrechten und den BTV-Nutzungsbedingungen einschalten.

Weitere BTV-Dokumentation:
https://www.btv.de/de/der-btv/faqs.html
