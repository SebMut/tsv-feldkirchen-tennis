# Hallenfinder: geschützte Anbieter-Zugänge

Die öffentliche Website darf niemals Zugangsdaten zu Buchungsanbietern enthalten. Eine spätere automatische Verfügbarkeitsabfrage läuft ausschließlich in GitHub Actions und veröffentlicht nur anonymisierte Zeitfenster, Preise und den offiziellen Buchungslink.

## Geplante GitHub Actions Secrets

- `HALL_EVERSPORTS_EMAIL`
- `HALL_EVERSPORTS_PASSWORD`
- `HALL_ASCHHEIM_USERNAME`
- `HALL_ASCHHEIM_PASSWORD`
- `HALL_KIRCHHEIM_USERNAME`
- `HALL_KIRCHHEIM_PASSWORD`

Rothof, Racket-Park Haar und SPORTTRAUM verwenden Eversports und können in der Regel denselben Eversports-Zugang verwenden. TC Aschheim nutzt eBuSy, TC Kirchheim eTennis.

## Sicherheitsregeln

- Secrets nur unter **Repository settings → Secrets and variables → Actions** speichern.
- Keine Zugangsdaten in Issues, Pull Requests, Commits, Logs oder öffentliche JSON-Dateien kopieren.
- Der Import darf nur auf einem geschützten Branch oder manuell laufen, niemals mit Secrets in Pull Requests.
- Vor einem Zeitplan jeden Anbieter-Adapter manuell testen, um Kontosperren durch fehlgeschlagene Logins zu vermeiden.
- Logs enthalten nur Anbieter-ID, Abrufzeit, Status und Anzahl freier Zeitfenster; keine Cookies, Namen, E-Mail-Adressen oder HTML-Antworten.
- Bei Fehlern bleibt der letzte erfolgreiche Snapshot sichtbar und wird als veraltet markiert.
- Die Website führt keine Buchung durch. Die verbindliche Reservierung erfolgt weiterhin beim Anbieter.

## Nächster Schritt

Nach dem sicheren Hinterlegen der Secrets werden die drei Adapter (Eversports, eBuSy, eTennis) einzeln gegen die realen Konten geprüft. Erst danach wird ein geplanter Snapshot-Workflow aktiviert.
