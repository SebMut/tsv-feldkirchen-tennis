# Betrieb & Sicherheit

## Architektur

Die öffentliche Website wird statisch mit Astro gebaut und auf United Domains ausgeliefert. Dynamische Daten kommen über den öffentlichen Supabase-Client und sind durch RLS geschützt.

## Rollen

- `user`: normales Konto; Rechte entstehen ausschließlich über `team_memberships`.
- `super_admin`: vollständige Vereinsadministration.
- Teamrollen: `manager`, `editor`, `ticker`.

Die globale Rolle wird nicht aus `user_metadata` gelesen.

## Erster SuperAdmin

1. Neue Website lokal oder auf einer Test-URL öffnen.
2. Unter `/admin/` die Ersteinrichtung verwenden.
3. E-Mail ggf. bestätigen und anmelden.
4. Einmalig **SuperAdmin aktivieren** ausführen.
5. Danach in Supabase Auth die öffentliche Selbstregistrierung für den Produktionsbetrieb deaktivieren; weitere Benutzer werden über **Benutzer einladen** angelegt.

## Medien

Bucket `media` ist öffentlich lesbar. Schreibzugriff ist durch Storage-RLS auf SuperAdmins bzw. `teams/<team_uuid>/...` für berechtigte Team-Editoren begrenzt. Maximalgröße: 8 MiB, Bilder: JPEG/PNG/WebP/AVIF.

## Realtime

DB-Trigger senden private Broadcasts auf `match:<match_id>:ticker`. Öffentliche Liveticker verwenden zusätzlich RLS-geschützte Postgres Changes als robuste Live-Quelle.

## Deployment

Der normale CI-Workflow führt `npm run build` aus. Produktiv-Deployment zu United Domains ist absichtlich nur manuell per `workflow_dispatch` aktiv.

Benötigte GitHub Secrets:

- `SFTP_HOST`
- `SFTP_PORT` (optional, Standard 22)
- `SFTP_USER`
- `SFTP_PASSWORD`
- `SFTP_REMOTE_PATH`

Die produktive Domain wird erst nach Abnahme der Testversion umgestellt.
