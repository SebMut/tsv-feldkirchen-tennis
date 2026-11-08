# Forderungspyramide – isolierte Entwicklungsstufe

Status: **nicht auf Produktivseite freigeben**, keine Migration auf dem Live-Projekt ausführen.

Repository: SebMut/tsv-feldkirchen-tennis, Entwicklungsbranch: `feature/forderungspyramide-staging`
Basis: `feature/astro-supabase-foundation`
Vorgesehenes Supabase-Projekt: `eaurnufdochjapfzqwvm` (kein anderes Projekt verwenden).

## Umsetzung

- Statische, geschützte und noindex-markierte Route `/forderungspyramide/`, bewusst ohne Link in der öffentlichen Navigation, Startseite oder Sitemap.
- Bestehendes Supabase Auth mit Passwort oder einmaligem E-Mail-Link. Nur vom Super-Admin freigegebene Mitglieder dürfen in der Pyramide mitspielen; keine automatischen Adminrechte bei Anmeldung.
- Super-Admin kann pro Saison Gruppen/Ranglisten anlegen, Teilnahmeanfragen freigeben, Rangplätze für die Startaufstellung sortieren und die anfängliche Aufstellung einmalig fixieren. Bereits vorhandene Kaderdaten werden nicht verändert.
- Je Gruppe separate Teilnehmer, Forderungen, Ergebnisverlauf; mobile, scrollbar begrenzte Pyramidenansicht.
- Regeln nach Spvgg 05 Oberrad, April 2025: gleiche Reihe links oder Reihe darüber rechts; an der Spitze Plätze 1–3; 10 Tage Annahmefrist mit automatischer Niederlage des Geforderten, Ziel 10 Tage für Spieltermin; 14 Tage Sperre nach Niederlage; beim Sieg Vorrücken auf den gegnerischen Platz.
- Vorläufige Neueinsteiger können bis zur zweituntersten Reihe fordern. Danach werden sie normal eingestuft.
- Forderungen und Ergebnisfestschreibung erfolgen **atomar in Supabase-RPCs**; UI-Rechte allein sind niemals maßgeblich. RLS verhindert Lesezugriff Unbeteiligter, keine öffentlichen Ranglisten personenbezogener Daten.
- Automatische Fristverwaltung nutzt das im Projekt bereits installierte `pg_cron`.


## Browser-Demo (keine echten Daten)

- Separater GitHub-Pages-Pfad: `https://sebmut.github.io/tsv-feldkirchen-tennis/pyramid-staging/forderungspyramide/?demo=1`.
- Die Demo verwendet vollständig fiktive Namen und speichert **nur im Arbeitsspeicher des jeweiligen Browser-Tabs**. Auch der Demo-Admin hat keine Supabase-Berechtigungen.
- Über **Testrolle auswählen** lassen sich Herausforderungen, Annahmen, Ergebnisse, Teilnehmerfreigaben, Rangänderungen, Saisonwechsel und neue Ranglisten demonstrieren.
- Über **Demo zurücksetzen** wird der ursprüngliche Musterzustand hergestellt. Beim Neuladen gehen Änderungen verloren.
- Ohne `?demo=1` zeigt die Route die echte Auth-Oberfläche; die Datenbankmigration bleibt unverändert nicht ausgeführt.
- Das getrennte Vorschau-Workflow muss Build, Unit-Tests, Audit und Chromium-Interaktionstests bestehen, ehe es die Vorschau aktualisiert.

## Adminrechte und automatische Ablehnung (Entwicklungsstand 8. November 2026)

- Im bestehenden **Mein TSV → Spielbetrieb → Forderungspyramide** gibt es einen eigenen Verwaltungsbereich mit Gruppen/Saisons, Teilnahmeanfragen, Rangsortierung, Startaufstellung, Forderungen und Ergebniserfassung. Er verwendet die bestehenden Supabase-Tabellen und RPCs.
- Die Super-Admin-Benutzerverwaltung hat neben Veranstaltungen, News und Liveticker jetzt die zusätzliche globale Berechtigung **Forderungspyramide verwalten**. Sie wird über `profiles.global_permissions` gespeichert und durch `private.has_global_permission('pyramid')` serverseitig geprüft. Keine zusätzliche Rollentabelle oder getrennte Loginlösung.
- Das Konto `sebastian.mutter@outlook.com` ist laut der read-only Prüfung der vorhandenen produktiven Profilrolle bereits Super-Admin. **Es wurden keine Nutzerrechte oder Profile live verändert.**
- Angenommene Forderungen blockieren beide Spielpartner bis zum Abschluss. Die Serverfunktionen sperren neue Forderungen gegen bereits in einem angenommenen Spiel stehende Personen. Die Annahme lehnt alle anderen noch `pending`-Forderungen an die beteiligten Spieler **atomar in derselben Transaktion** ab.
- Jede automatisch abgelehnte Forderung erzeugt genau einen Eintrag in `private.pyramid_auto_decline_notices`. Eine Minute-Cron über `pg_net` ruft eine neue Edge Function mit kurzlebigem Einmal-Token auf. Die Function nutzt die **bereits eingesetzten Gmail OAuth Secrets**, sendet eine CI-konforme Benachrichtigung an den jeweiligen Herausforderer und bestätigt den Versand nur bei Gmail-Erfolg. Fehlgeschlagene Zustellungen werden mit Backoff erneut probiert (maximal zehn Versuche).
- Demo: Rolle **„Geforderte Person · Spieler 13“** wählen, „Spieler 14 fordert Spieler 13“ annehmen. Vorher lässt sich als Musterperson auf Platz 15 ebenfalls eine Forderung gegen Spieler 13 erstellen. Bei der Annahme wird diese zweite Forderung automatisch abgelehnt; im Abschnitt „Simulierte E-Mail-Benachrichtigungen“ sieht man die Nachricht. Die Demo schreibt keinerlei Daten nach Supabase und sendet keine Mails.

**Vor Livebetrieb erforderlich:** Die Migrationen `20261108153000_forderungspyramide_staging.sql` und `20261108173000_pyramid_permissions_and_auto_decline.sql` dürfen erst nach ausdrücklicher Freigabe im vorgesehenen Supabase-Projekt ausgeführt werden. Die Edge Function `pyramid-auto-decline-email` muss dann separat bereitgestellt und ihr Cron-Versand/RLS im isolierten Test mit echten Rollen, ohne Versand an Unbeteiligte, geprüft werden. Der produktive Deployment-Branch wurde nicht verändert.

## Freigabe-Voraussetzungen

1. Produktivdatenbank NICHT ändern, bevor eine separate Freigabe zur Aktivierung vorliegt. Die Migration `20261108153000_forderungspyramide_staging.sql` wird nur versioniert; sie wird hier nicht ausgeführt.
2. Vor Livebetrieb das tatsächliche Teilnehmer-/Mitgliedschaftsverfahren mit dem Verein klären, insbesondere Datenschutz / Veröffentlichung von Namen. Die vorhandenen `players` sind nicht zwingend eine vollständige Mitgliederliste. Anmeldung gibt keine automatische Teilnahmeberechtigung.
3. E-Mail-Redirect für `https://www.tennis-tsvfeldkirchen.de/forderungspyramide/` in den Supabase Auth Redirect-URLs zulassen; Preview-URL bei Bedarf separat. Ohne diese Freigabe kann der Zugangslink an die Standard-Site-Adresse umleiten.
4. Initiale Saisons/Gruppen (z. B. Sommer/Winter 2027) und Rangplätze erst durch Super-Admin anlegen. Es werden **keine erfundenen Teilnehmer importiert**.
5. Benachrichtigung per E-Mail an den Herausgeforderten ist **noch nicht angeschlossen**. Die Herausforderung erscheint für angemeldete Teilnehmer in der Übersicht. Vor Produktivstart eine sichere, genehmigte E-Mail-Zustellung ergänzen.
6. Vor Freigabe Migration in isolierter Testdatenbank durchspielen: RLS für anonyme, unbeteiligte, Teilnehmer- und Super-Admin-Rollen; gleichzeitige Forderungen; Annahme, Ablehnung, 10-Tage-Frist, Spielabschluss und Rangwechsel; Rückzug/Disputfälle, Datenschutz.
7. Nach Umsetzung in Testumgebung: `npm ci && npm test && npm run build && npm run audit:site && npm run qa:browser` (Desktop/Mobile). Auch bestehende Start-, Mannschafts-, Kalender- und Adminfunktionen prüfen.
8. Erst nach eigenständiger Freigabe die SQL-Migration anwenden, E-Mail-Zustellung aktivieren und Navigation ergänzen. Keine Produktivänderung erfolgt allein durch Merge.

## Offene inhaltliche Entscheidungen

- Aus dem Oberrad-Regelwerk stammen drei Beispiele: Damen, Herren 30/40 und Herren 50+. Sie werden nicht blind für TSV Feldkirchen übernommen; die Administration legt passende Gruppen an.
- Auslegung der Einforderungsregel und Ergebnisstreitigkeiten durch den Sportwart bestätigen lassen.
- Regelwerk und Verantwortlicher auf TSV Feldkirchen anpassen; der im fremden PDF genannte Sportwart ist nicht automatisch TSV-Ansprechpartner.
- Das PDF enthält keine rechtssichere Verarbeitungserlaubnis für personenbezogene Daten. Die Datenschutzhinweise müssen vor Einführung ergänzt werden.

## Referenz

Vom Nutzer bereitgestelltes PDF: »Forderungspyramide SV Oberrad Tennis (Regeln), Stand April 2025«, fünf Seiten.
