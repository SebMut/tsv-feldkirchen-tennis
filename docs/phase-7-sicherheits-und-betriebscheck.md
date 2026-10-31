# Phase 7 – Sicherheits- und Betriebscheck

**Stand:** 31. Oktober 2026  
**Umgebung:** ausschließlich Supabase-Projekt `eaurnufdochjapfzqwvm`, GitHub-Branch `feature/astro-supabase-foundation`  
**Ergebnis:** technische Basiskontrollen durchgeführt; **keine Freigabe für den produktiven Betrieb**.

## 1. Technische Sicherheitskontrollen (durchgeführt)

| Kontrollpunkt | Beobachtung / Ergebnis | Status |
| --- | --- | --- |
| Öffentliche Tabellen und RLS | 23 Tabellen im Schema `public`, **alle 23 mit RLS** | Geprüft |
| Anonyme SQL-Schreibrechte | Anfangs direktes `INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` für `anon` auf 23 Tabellen, trotz fehlender anonymer Schreib-Policies | Risiko erkannt und behoben |
| Anonyme Rechte nach Korrektur | **0** verbliebene direkte anonyme Schreib-/TRUNCATE-/REFERENCES-/TRIGGER-Grants; `SELECT` mit RLS bleibt vorhanden | SQL-verifiziert |
| Rechte angemeldeter Konten | `authenticated` behält `SELECT/INSERT/UPDATE/DELETE` unter bestehender RLS. `TRUNCATE/REFERENCES/TRIGGER` ausdrücklich entfernt | SQL-verifiziert |
| Privilegierte RPCs | `ensure_match_encounters(uuid)` und `configure_match_encounters(uuid,text)` nicht mehr als `anon` ausführbar; für `authenticated` mit interner `private.can_tick_match`-Prüfung verfügbar | SQL-verifiziert |
| News / Termine | Öffentliche `SELECT`-Policies nur für veröffentlichte News/Termine; Bearbeitung für SuperAdmins bzw. Teamrechte | Policy-Schema geprüft |
| Profile / Mitgliedschaften | `profiles` und `team_memberships` besitzen keine anonymen SELECT-Policies | Policy-Schema geprüft |
| Spieler / Team-Kader | Öffentliche Spieleransicht setzt Veröffentlichung und Team-Sichtbarkeit voraus | Policy-Schema geprüft |
| Medien-Bucket | `media` öffentlich lesbar; MIME-Typen Bildformate; Limit 8 MiB | DB-Metadaten geprüft |
| Echtgeräte-/Rollenprüfung | Tatsächliche Benutzeranmeldungen und Schreibversuche mit unberechtigten Konten | **Offen** |

### Behobene Schwachstelle – Vermeidung unnötiger SQL-Privilegien

PostgreSQL-RLS kontrolliert Zeilenoperationen, aber **nicht `TRUNCATE`**. Daher waren die vorgefundenen breit vergebenen Tabellenrechte auch dann ein unnötiges Risiko, wenn PostgREST öffentlich keine `TRUNCATE`-Methode anbietet.

Korrektur via `supabase/migrations/20261031120000_phase7_least_privilege_table_grants.sql`:

```sql
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;
revoke truncate, references, trigger
  on all tables in schema public from authenticated;
```

Die Migration wurde **auf dem ausschließlich erlaubten Projekt angewendet**. Kontrolle: 23/23 RLS aktiviert, `anon` auf allen 23 Tabellen ohne `INSERT/UPDATE/DELETE/TRUNCATE`, `authenticated` auf allen 23 Tabellen ohne `TRUNCATE`. Die für den normalen Vereinsbetrieb notwendigen angemeldeten DML-Rechte blieben bestehen. Keine Datenlöschungen, keine Änderungen am tatsächlichen Vereinsdatenbestand.

**Bei neuen Tabellen künftig darauf achten:** Supabase-/PostgreSQL-Default-Privileges können zu breite Grants an neue Tabellen vergeben. Jede weitere Migration muss ihre effektiven Rechte und RLS-Policies erneut prüfen. Die bereits angewendete Migration bezieht sich nur auf den aktuellen Tabellenbestand.

### Kontrollabfragen für spätere Wartung (nur lesend)

```sql
select count(*) as public_tables,
       count(*) filter (where not rowsecurity) as rls_disabled
from pg_tables where schemaname = 'public';

select grantee, privilege_type, count(*) as number_of_grants
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by grantee, privilege_type
order by grantee, privilege_type;

select c.relname,
       has_table_privilege('anon', c.oid, 'TRUNCATE') as anon_can_truncate,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_can_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') as anon_can_update,
       has_table_privilege('anon', c.oid, 'DELETE') as anon_can_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;
```

## 2. Offene Sicherheitswarnungen

Supabase Security Advisor zeigt nach der bisherigen Korrektur weiterhin:

1. **Zwei signiert aufrufbare SECURITY-DEFINER-Funktionen.** Die Funktionen prüfen aktuell intern die Spielberechtigung; dieser unverzichtbare Ablauf muss beim Rollen-/Ticker-Praxistest mit einem fremden Konto überprüft werden. Allgemeiner Hinweis: https://supabase.com/docs/guides/database/database-advisors?lint=0029_authenticated_security_definer_function_executable
2. **Leaked Password Protection deaktiviert.** Laut Supabase ist die Funktion vom gebuchten Plan abhängig (Pro oder höher); Plan und erforderliche Passwortpolitik vor Go-live durch Projektverantwortliche prüfen. https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Performance Advisor: keine fehlenden Fremdschlüsselindizes mehr aus der bisherigen Liste; verbleibende Hinweise auf unbenutzte Indizes und mehrfach permissive Policies. **Bestehende Indizes/Policies ohne fachliche Sicherheits- und Performancebewertung nicht löschen.**

## 3. GitHub und Veröffentlichungsprozess (durchgeführt)

- `Build Astro`: `npm ci`, `astro check`, `astro build`, `npm run audit:site`.
- `Publish GitHub Pages Preview`: expliziter Test-Basispfad, `noindex,nofollow`, `robots.txt` mit `Disallow: /`, eigener Statischer-Seiten-Audit.
- Öffentlicher Smoke-Test: ICS-Struktur und eindeutige Termine, Courtbooking-Zugriff, Original-TSV-Logo, Hero und drei Kategorie-Standardbilder.
- Sitemap ist ein echter XML-Endpunkt; WordPress-Weiterleitungen bleiben in `public/.htaccess`.
- Keine automatische Produktivaktion. Der produktive Workflow ist manuell, setzt `main`, ein besonderes Freigabewort und die zuvor ausdrücklich aktivierte Variable `TSV_GO_LIVE_APPROVED=true` voraus.
- Trotz dieser technischen Sperre sind GitHub-**Environment-Reviewer** und Secret-Verfügbarkeit manuell durch Repository-Administratoren zu prüfen. Ein vorhandenes Environment bedeutet nicht automatisch, dass ein Reviewer konfiguriert ist.
- **SFTP-Upload nicht tatsächlich getestet**, da er die bestehende Website verändern würde. Dies geschieht erst nach gesonderter Freigabe.

## 4. Betrieb nach einem späteren freigegebenen Go-live

| Bereich | Betreiberaufgabe | Zeitpunkt | Nachweis |
| --- | --- | --- | --- |
| Website erreichbar? | Startseite, Teams, Kalender und Spieltag öffnen; Logo und Bilder prüfen | Direkt nach Go-live, danach regelmäßig | Prüfdatum / Ergebnis |
| Daten aktualisieren sich? | News, Kalender, Anlagenstatus und bei realem Spiel Liveticker prüfen | Nach relevanten Änderungen | Ergebnis der Prüfung |
| Benutzerberechtigungen | Neue Mitglieder nur mit passenden Teamrollen einladen; ausgetretene Nutzer entziehen | Bei jeder Rollenänderung | Liste der Berechtigten |
| Backups WordPress | Vollständigen Stand vor Go-live erstellen und Wiederherstellung nachvollziehbar sichern | Unmittelbar vor Freigabe | Speicherort / verantwortliche Person |
| Backups Supabase | Verfügbares Backup/Export je nach gebuchtem Plan prüfen und Wiederherstellungsweg dokumentieren | Vor Go-live und nach Betriebsplan | Datum / Nachweis |
| GitHub CI | Astro-Build, Preview und Smoke-Checks auf grün kontrollieren | Vor jedem genehmigten Release | Workflow-Link |
| Sicherheit | Supabase Advisors und Rollen/Storage-RLS neu prüfen | Nach Migration und regelmäßig | Kurzprotokoll |
| Rechtstexte / Personenbilder | Einwilligungen, veröffentlichte Kontaktdaten und aktuelle Texte fachlich freigeben | Vor Veröffentlichung, bei Änderungen | Freigabe-Vermerk |
| Störungen | Fehler mit Priorität, Uhrzeit, betroffener Seite und Browser dokumentieren | Bei Vorfall | Ticket / Fehlerprotokoll |

### Zuständigkeiten – vom Verein noch festzulegen

- **Fachliche Freigabe:** ___________________
- **Technische Administration (GitHub / Hosting):** ___________________
- **Supabase / Auth / Sicherheit:** ___________________
- **Redaktion / Mannschaftsverantwortliche:** ___________________
- **Ansprechpartner bei Störung:** ___________________
- **Backup-/Restore-Verantwortlicher:** ___________________

Diese Namen sind bewusst **nicht erfunden** worden.

## 5. Was noch nicht als getestet gelten darf

- Login, Rechteprüfung, Formularspeichern und Uploads mit echten Mannschafts-, SuperAdmin- und Ticker-Konten.
- Testspiel mit 6/3 sowie 4/2, Realtime zwischen zwei Geräten und Test-Rollback.
- Visuelle Abnahme auf realen Mobilgeräten, Tastatur- und Screenreader-Test.
- ICS-Import in Apple Kalender/Outlook sowie Cross-Browser-Check.
- Wiederherstellung eines realen WordPress- und Supabase-Backups.
- Exakte produktive Hostingumgebung / Apache-Redirect-Verhalten / SFTP-Integration.
- Aktivierung oder Bestätigung von GitHub-Produktionseinstellungen, SMTP-/Auth-Einstellungen, Freigaben.
- Rechtliche Freigabe durch den Verein.

## 6. Verbindliche nächste Schritte

1. Die Vereinsmitarbeiter prüfen ihren Teil anhand `docs/phase-7-abnahme-vereinsmitarbeiter.md`.
2. Alle Abweichungen als P0/P1/P2/P3 dokumentieren; kritische Fehler beheben und nachtesten.
3. Mit Verantwortlichen nachweisen, dass Backups, Hosting-Ziel, Environment-Reviewer und rechtliche Inhalte geprüft sind.
4. Einen expliziten Beschluss zur Produktivumstellung einholen – **nicht** aus diesem Bericht oder erfolgreichen CI-Aktionen ableiten.
5. Nur bei separater Freigabe nach `docs/go-live-runbook.md` vorgehen.

**Aktueller Status: technisch gehärtet und betrieblich dokumentiert – praktische Abnahme ausstehend; Go-live gesperrt.**
