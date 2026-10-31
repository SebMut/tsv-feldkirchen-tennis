# Phase 3 – Benutzer, Rollen und Rechte

Status: **technisch abgeschlossen / Praxistest offen**

## 3.1 Rollenmodell

### SuperAdmin
- vollständiger Zugriff auf alle Mannschaften und Websitebereiche
- Benutzer einladen
- globale Rollen ändern
- mehrere Mannschaften pro Nutzer zuordnen
- Rollen je Mannschaft festlegen
- Benutzerzugänge löschen
- letzter SuperAdmin kann weder herabgestuft noch gelöscht werden

### Manager
- eigene zugeordnete Mannschaften bearbeiten
- Kader und Bilder pflegen
- Spiele pflegen
- News und Termine der Mannschaft pflegen
- Liveticker bedienen

### Editor
Aktuell dieselben Mannschaftsrechte wie Manager. Die getrennte Rolle bleibt im
Datenmodell bestehen, damit später zusätzliche Manager-Rechte ergänzt werden können.

### Nur Liveticker
- sieht ausschließlich seine zugeordneten Mannschaften
- kann vorhandene Spiele live begleiten
- kann Score und Tickermeldungen pflegen
- bekommt Mannschaft, Kader, News, Termine und Bilder nicht als bearbeitbare Bereiche angeboten
- darf über RLS keine Mannschaftsdaten verändern

## 3.2 Mehrfachzuordnung

Ein Benutzer kann gleichzeitig mehreren Mannschaften zugeordnet werden.
Die Rolle wird **pro Mannschaft** gespeichert.

Beispiel:
- Herren 40 → Editor
- Herren 50 → Nur Liveticker
- Herren → Manager

Die Adminoberfläche filtert die verfügbaren Bearbeitungsbereiche und Auswahlfelder
entsprechend der jeweiligen Rechte.

## 3.3 Einladungen

Einladungen laufen ausschließlich über die serverseitige Edge Function
`admin-users` mit Service-Role-Zugriff.

Erlaubte Redirect-Ziele:
- Produktionsdomain
- optionale Preview-Subdomain
- GitHub-Pages-Preview `/tsv-feldkirchen-tennis/`
- lokales Astro-Development

Der Service-Role-Key wird niemals an den Browser ausgeliefert.

Die Benutzerliste zeigt zusätzlich:
- aktiv / Einladung offen
- letzte Anmeldung
- globale Rolle
- Mannschaftszuordnungen

Nicht mehr benötigte Benutzer können durch den SuperAdmin vollständig entfernt werden.

## 3.4 Passwort

- Passwortänderung im Bereich „Mein Konto“
- mindestens 12 Zeichen in der TSV-Oberfläche
- Passwort-vergessen-Funktion vorhanden
- Recovery-Redirect funktioniert mit dem jeweiligen Astro-Base-Pfad

Supabase meldet derzeit den Advisor-Hinweis
`auth_leaked_password_protection`.

Supabase dokumentiert Leaked Password Protection als Funktion für Pro und höher.
Der Hinweis ist daher kein Entwicklungsblocker für einen Free-Betrieb; bei einem
späteren Pro-Upgrade sollte die Funktion in den Auth-Einstellungen aktiviert werden.

## 3.5 Serverseitige Rechte

Die Oberfläche ist nur Komfort. Die tatsächliche Absicherung erfolgt durch RLS.

- `manager` / `editor`: `private.can_edit_team(...)`
- `manager` / `editor` / `ticker`: `private.can_tick_team(...)`
- Spielbearbeitung: nur Editor/Manager/SuperAdmin
- Liveticker: alle drei Mannschaftsrollen
- Benutzerverwaltung: ausschließlich Edge Function + SuperAdmin-Prüfung

## 3.6 Praxistest

Für die endgültige Abnahme wird ein echter zweiter Benutzer benötigt.

Empfohlene Testmatrix:

1. Benutzer A als **Editor** für genau eine Mannschaft einladen.
   - nur diese Mannschaft sichtbar
   - Mannschaft/Kader/Bilder bearbeitbar
   - fremde Mannschaft nicht bearbeitbar

2. denselben Benutzer zusätzlich einer zweiten Mannschaft als **Nur Liveticker** zuordnen.
   - zweite Mannschaft im Dashboard sichtbar
   - vorhandene Spiele tickerbar
   - Mannschaftsdaten dieser zweiten Mannschaft nicht bearbeitbar

3. Benutzer anschließend auf zwei Teams als Editor setzen.
   - beide Teams in allen passenden Pflegebereichen auswählbar

4. alle Mannschaftsrechte entfernen.
   - Login weiterhin möglich
   - keine Mannschaft im Dashboard
   - nur „Mein Konto“ verfügbar

5. Passwort vergessen testen.
   - Recovery-Mail
   - Rückkehr zur Preview
   - neues Passwort setzen

6. Benutzerzugang löschen.
   - Login anschließend nicht mehr möglich

Erst nach diesem echten Zweitnutzer-Test wird Phase 3 vollständig abgenommen.
