# Hallenfinder: geschützte Anbieter-Zugänge

Die öffentliche Website darf niemals Zugangsdaten zu Buchungsanbietern enthalten. Eine spätere automatische Verfügbarkeitsabfrage läuft ausschließlich in GitHub Actions und veröffentlicht nur anonymisierte Zeitfenster, Preise und den offiziellen Buchungslink.

## Vorbereitete GitHub-Umgebung

Die Zugangsdaten liegen als **Environment-Secrets** in der geschützten GitHub-Umgebung `hallenfinder`. Dadurch sind sie von der normalen Website-Bereitstellung und von Pull Requests getrennt.

Direkter Einstieg: **Repository → Settings → Environments → hallenfinder → Environment secrets**

Dort werden genau diese zehn Secrets angelegt:

- `HALL_SPORTTRAUM_EVERSPORTS_EMAIL`
- `HALL_SPORTTRAUM_EVERSPORTS_PASSWORD`
- `HALL_ROTHOF_EVERSPORTS_EMAIL`
- `HALL_ROTHOF_EVERSPORTS_PASSWORD`
- `HALL_HAAR_EVERSPORTS_EMAIL`
- `HALL_HAAR_EVERSPORTS_PASSWORD`
- `HALL_ASCHHEIM_EBUSY_USERNAME`
- `HALL_ASCHHEIM_EBUSY_PASSWORD`
- `HALL_KIRCHHEIM_ETENNIS_USERNAME`
- `HALL_KIRCHHEIM_ETENNIS_PASSWORD`

Rothof, Racket-Park Haar und SPORTTRAUM verwenden Eversports. Die Secrets sind absichtlich je Halle getrennt; wenn zwei Hallen denselben Eversports-Account verwenden, werden für beide Hallen dieselben Werte eingetragen. TC Aschheim nutzt eBuSy, TC Kirchheim eTennis.

## Zugangsdaten eintragen

1. In GitHub das Repository `SebMut/tsv-feldkirchen-tennis` öffnen.
2. **Settings → Environments → hallenfinder** wählen.
3. Unter **Environment secrets** nacheinander die zehn Namen aus der Liste anlegen.
4. Als Wert jeweils ausschließlich den echten Benutzernamen, die E-Mail-Adresse oder das Passwort eintragen. Keine Anführungszeichen und keine Platzhalter verwenden.
5. Erst danach Pull Request #119 mergen. Die Prüfung startet beim Merge in den Website-Branch automatisch. Später kann sie unter **Actions → Hallenfinder login data check** erneut ausgeführt werden.

Die Prüfung meldet pro Anbietergruppe nur **Bereit** oder **Fehlt**. Sie meldet sich noch nicht bei den Hallen an und gibt keinerlei Secret-Werte aus.

## Sicherheitsregeln

- Secrets nur unter **Settings → Environments → hallenfinder** speichern.
- Keine Zugangsdaten in Issues, Pull Requests, Commits, Logs oder öffentliche JSON-Dateien kopieren.
- Der Import darf nur in der Umgebung `hallenfinder` und niemals mit Secrets in Pull Requests laufen.
- Vor einem Zeitplan jeden Anbieter-Adapter manuell testen, um Kontosperren durch fehlgeschlagene Logins zu vermeiden.
- Logs enthalten nur Anbieter-ID, Abrufzeit, Status und Anzahl freier Zeitfenster; keine Cookies, Namen, E-Mail-Adressen oder HTML-Antworten.
- Bei Fehlern bleibt der letzte erfolgreiche Snapshot sichtbar und wird als veraltet markiert.
- Die Website führt keine Buchung durch. Die verbindliche Reservierung erfolgt weiterhin beim Anbieter.

Die Namen stehen zusätzlich leer in `.env.example`, damit lokale Adaptertests später dieselbe Schnittstelle verwenden. Die echte lokale `.env` bleibt durch `.gitignore` ausgeschlossen.

## Nächster Schritt

Nach dem sicheren Hinterlegen und der erfolgreichen Anwesenheitsprüfung werden die drei Adapter (Eversports, eBuSy, eTennis) einzeln gegen die realen Konten geprüft. Erst danach wird ein geplanter Snapshot-Workflow aktiviert.
