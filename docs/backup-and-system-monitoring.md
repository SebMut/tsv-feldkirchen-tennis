# TSV Feldkirchen Tennis – Monitoring, Backup und Restore

Stand: 03.11.2026. Verbindliche Projekt-ID: `eaurnufdochjapfzqwvm`, Deployment-Branch: `feature/astro-supabase-foundation`.

## Systemstatus (nur SuperAdmin)

Unter **Admin → Systemstatus** ruft die bestehende authentifizierte `admin-users`-Funktion den vorhandenen Supabase-Client mit service-role-Rechten auf. Die Funktion prüft vor jeder Aktion, dass der Aufrufer in `profiles.global_role` als `super_admin` hinterlegt ist. Der SQL-RPC `public.admin_system_integrity()` darf ausschließlich vom `service_role` ausgeführt werden; anonyme oder sonstige eingeloggte Benutzer erhalten keinen Zugriff.

Der Bereich meldet
- die Verfügbarkeit der Datenabfrage;
- letzten und letzten erfolgreichen BTV-Lauf aus `btv_import_runs`;
- referenzierte, aber im Bucket `media` fehlende Bildobjekte (maximal 20 Beispielpfade);
- Status vorhandener `tsv-%`-Cronjobs und fehlgeschlagene Ausführungen der letzten 24 Stunden;
- die letzte ausdrücklich **bestätigte** Restore-Prüfung aus dem privaten Schlüssel `site_settings.ops_restore_check` (Warnung nach 30 Tagen).

**Grenzen:** Eine funktionierende SQL-Anfrage beweist nicht, dass jede Supabase-Edge-Function, jede GitHub Action oder Supabase PITR fehlerfrei ist. Den Status weiterer Edge-Functions in den Supabase-Dashboard-Logs separat prüfen. Fehlende Medien werden anhand von in der Datenbank hinterlegten relativen Pfaden ermittelt; unreferenzierte Dateien sind nicht per se Fehler.

## Vertrauliche Sicherung / echtes Restore-Protokoll

1. Im Supabase-Dashboard unter Database → Backups das für dieses Projekt verfügbare Backup/PITR-Verfahren und die Wiederherstellungspunkte kontrollieren. Das Vorhandensein einer Sicherung allein ist noch kein Restore-Test.
2. Eine **isolierte Testumgebung** verwenden, niemals den Produktivdatenbestand überschreiben. Keine zweite Live-Quelle oder dauerhafte parallele Vereinsdatenbank einrichten.
3. Ein Backup dort tatsächlich wiederherstellen, Tabellen-/Datensatzanzahlen, wichtige Referenzen sowie Auth-/Storage-Abhängigkeiten überprüfen. Persönliche Daten nicht in Logs oder GitHub-Artefakte übernehmen.
4. Nur nach einem erfolgreichen tatsächlichen Test die Methode und das Ergebnis im geschützten Adminformular bestätigen. Datum und SuperAdmin-ID werden serverseitig gesetzt; die Daten bleiben privat (`is_public=false`).
5. Mindestens monatlich wiederholen. Bei fehlendem oder abgelaufenem Prüfprotokoll zeigt das Dashboard ausdrücklich eine Warnung.

## Automatisierte begrenzte Restore-Probe

Der Workflow `.github/workflows/backup-restore-drill.yml` versucht, eine **einzelne öffentliche BTV-Protokolltabelle** als logischen PostgreSQL-Dump zu lesen und in einem isolierten kurzlebigen PostgreSQL-Container wiederherzustellen. Er vergleicht die Zeilenanzahl, vernichtet den Dump beim Workflow-Ende und lädt **niemals** Datenbankinhalte als Artefakt hoch. Diese Probe ist **kein Ersatz** für ein vollständiges Backup und keinen PITR-Restore.

Voraussetzung: GitHub Actions Secret `TSV_BACKUP_DB_URL` mit einer auf das notwendige SELECT eingeschränkten, TLS-gesicherten Postgres-Verbindung zu **diesem** Supabase-Projekt. Ohne Secret schlägt die Probe ausdrücklich fehl und meldet **nicht** irrtümlich Erfolg. Den Verbindungsstring niemals in Repository, Logs oder Chat aufnehmen.

Wichtig: GitHub `schedule` wird nur vom **Default-Branch** ausgeführt. Solange dieser Workflow ausschließlich im vereinbarten Feature-Branch liegt, ist sein wöchentlicher Zeitplan **noch nicht aktiv**. Der Push- oder manuelle Lauf kann die Funktion technisch prüfen. Eine wiederkehrende Aktivierung benötigt eine separate autorisierte Betriebsfreigabe, ohne den vereinbarten Entwicklungs-/Deployment-Branch zu wechseln.

## Störungs- und Restorefall

1. Seite und Systemstatus aufrufen, den Zeitpunkt und die betroffene Teilfunktion notieren.
2. `btv_import_runs`, Cron-Protokolle und GitHub-Actions-Ausführungen vergleichen; bei fehlenden Bildern Storage-Objekte und die gespeicherten relativen Pfade prüfen.
3. Bei Datenverlust Änderungen an der betroffenen Funktion stoppen, Backup-Zeitpunkt und mögliche Nacharbeiten mit Vereinsverantwortlichen abstimmen.
4. Wiederherstellung zuerst in Isolation testen und Integrität bestätigen, erst danach produktive Wiederherstellung durch berechtigte Betreiber durchführen.
5. Test und Ergebnis im Admin-Panel dokumentieren. Keine Passwörter, Datenbank-URLs oder personenbezogenen Tabelleninhalte ins Protokoll kopieren.
