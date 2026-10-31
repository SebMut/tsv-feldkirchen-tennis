# BTV-Logincheck über GitHub Actions Secrets

Dieser Workflow prüft einmalig, ob der offizielle BTV-Vereins-Cockpit-Zugang mit den
vom Betreiber in GitHub angelegten Secrets verwendbar ist. Er hat **keine** Schreib-
oder Downloadfunktion. Es werden keine Kader, Namen, Formulare, Cookies, Passwörter,
Sitzungsschlüssel oder Screenshots in das GitHub-Repository oder Actions-Artefakte geschrieben.

## Zugang und Rechte

Einzige Repository-Adresse: https://github.com/SebMut/tsv-feldkirchen-tennis

Nur folgende Repository-Actions-Secrets verwenden:

- `BTV_LOGIN_USERNAME` — BTV-/nuLiga-Benutzername.
- `BTV_LOGIN_PASSWORD` — BTV-/nuLiga-Passwort.

Die Werte müssen in **Settings → Secrets and variables → Actions → Secrets**
hinterlegt sein. Der GitHub-Connector kann diese Werte nicht direkt lesen.
Secrets werden nur dem `login-probe`-Schritt auf dem GitHub-Standardbranch `main`
übergeben, niemals den Pull-Request-Prüfungen. Die Installation der Browserwerkzeuge
findet statt, bevor die Secrets als Umgebungsvariablen übergeben werden.

Nach Zusammenführung der separaten Workflow-Änderung nach `main` läuft der Check
einmalig. Er ist zusätzlich über **Actions → BTV Vereins-Cockpit Logincheck (nur lesend)
→ Run workflow** manuell startbar.

Es gibt keine Cron-Wiederholung, keine Umgehung von Mehrfaktor-Authentifizierung
oder CAPTCHAs und keine erneuten Loginversuche innerhalb eines Runs.

## Zulässige Statusmeldungen

- `BTV_AUTH_CHECK=SUCCESS`: Anmeldung und Club-Cockpit wurden erkannt.
- `BTV_DOWNLOADS_VISIBLE=YES`: Ein Downloads-Menü wurde erkannt, ohne es zu öffnen.
- `BTV_DOWNLOADS_VISIBLE=NOT_YET`: Download-Menü nicht bestätigt.
- `BTV_AUTH_CHECK=SECRETS_MISSING`: Mindestens ein Secret ist nicht gesetzt.
- `BTV_AUTH_CHECK=LOGIN_NOT_CONFIRMED`: Anmeldung konnte nicht nachgewiesen werden.
- `BTV_AUTH_CHECK=SESSION_NOT_CONFIRMED`: Sitzung blieb nicht angemeldet.
- `BTV_AUTH_CHECK=COCKPIT_NOT_CONFIRMED`: Club-Cockpit ist nicht nachgewiesen.
- Andere feste Fehlercodes: Loginseite oder Browserablauf muss aktualisiert werden.

Eine Erfolgsmeldung bedeutet noch **keine** Bestätigung, dass der berechtigte
Account TSV Feldkirchen als Verein besitzt, alle nMM-Dokumente herunterladen darf
oder dass BTV einen wiederholten automatisierten Download gestattet.

## Vor einem tatsächlichen Kaderimport

1. Berechtigungen für den TSV Feldkirchen und den PDF-Download im Browser bestätigen.
2. Für Sommer/Winter nur zur Mannschaftsverwaltung benötigte, verifizierte Namen
   extrahieren. Keine Geburtsdaten, Kontaktdaten oder vollständige Mitgliederdaten.
3. Für jugendliche Spieler eine zulässige Verwendung prüfen. Alle neuen Kaderzuordnungen
   bleiben standardmäßig `public_visible=false`.
4. Import nur in Supabase-Projekt `eaurnufdochjapfzqwvm`, niemals in andere Projekte.
5. Erst mit gesonderter technischer und organisatorischer Freigabe periodische
   Downloads oder automatische Datenbank-Schreibaktionen aktivieren.

Dieser Check hat keinen Einfluss auf Website-Go-live und BTV-Spielplan-Cron.
