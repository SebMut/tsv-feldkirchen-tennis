# Forderungspyramide – isolierte Entwicklungsstufe

Status: **nicht auf Produktivseite freigeben**, keine Migration auf dem Live-Projekt ausführen.

Repository: SebMut/tsv-feldkirchen-tennis, Entwicklungsbranch: \`feature/forderungspyramide-staging\`
Basis: \`feature/astro-supabase-foundation\`
Vorgesehenes Supabase-Projekt: \`eaurnufdochjapfzqwvm\` (kein anderes Projekt verwenden).

## Umsetzung

- Statische, geschützte und noindex-markierte Route \`/forderungspyramide/\`, bewusst ohne Link in der öffentlichen Navigation, Startseite oder Sitemap.
- Bestehendes Supabase Auth mit Passwort oder einmaligem E-Mail-Link. Nur vom Super-Admin freigegebene Mitglieder dürfen in der Pyramide mitspielen; keine automatischen Adminrechte bei Anmeldung.
- Super-Admin kann pro Saison Gruppen/Ranglisten anlegen, Teilnahmeanfragen freigeben und Rangplätze für die Startaufstellung sortieren. Bereits vorhandene Kaderdaten werden nicht verändert.
- Je Gruppe separate Teilnehmer, Forderungen, Ergebnisverlauf; mobile, scrollbar begrenzte Pyramidenansicht.
- Regeln nach Spvgg 05 Oberrad, April 2025: gleiche Reihe links oder Reihe darüber rechts; an der Spitze Plätze 1–3; 10 Tage Annahmefrist mit automatischer Niederlage des Geforderten, Ziel 10 Tage für Spieltermin; 14 Tage Sperre nach Niederlage; beim Sieg Vorrücken auf den gegnerischen Platz.
- Vorläufige Neueinsteiger können bis zur zweituntersten Reihe fordern. Danach werden sie normal eingestuft.
- Forderungen und Ergebnisfestschreibung erfolgen **atomar in Supabase-RPCs**; UI-Rechte allein sind niemals maßgeblich. RLS verhindert Lesezugriff Unbeteiligter, keine öffentlichen Ranglisten personenbezogener Daten.
- Automatische Fristverwaltung nutzt das im Projekt bereits installierte \`pg_cron\`.

## Freigabe-Voraussetzungen

1. Produktivdatenbank NICHT ändern, bevor eine separate Freigabe zur Aktivierung vorliegt. Die Migration \`20261108150000_forderungspyramide_staging.sql\` wird nur versioniert; sie wird hier nicht ausgeführt.
2. Vor Livebetrieb das tatsächliche Teilnehmer-/Mitgliedschaftsverfahren mit dem Verein klären, insbesondere Datenschutz / Veröffentlichung von Namen. Die vorhandenen \`players\` sind nicht zwingend eine vollständige Mitgliederliste. Anmeldung gibt keine automatische Teilnahmeberechtigung.
3. E-Mail-Redirect für \`https://www.tennis-tsvfeldkirchen.de/forderungspyramide/\` in den Supabase Auth Redirect-URLs zulassen; Preview-URL bei Bedarf separat. Ohne diese Freigabe kann der Zugangslink an die Standard-Site-Adresse umleiten.
4. Initiale Saisons/Gruppen (z. B. Sommer/Winter 2027) und Rangplätze erst durch Super-Admin anlegen. Es werden **keine erfundenen Teilnehmer importiert**.
5. Benachrichtigung per E-Mail an den Herausgeforderten ist **noch nicht angeschlossen**. Die Herausforderung erscheint für angemeldete Teilnehmer in der Übersicht. Vor Produktivstart eine sichere, genehmigte E-Mail-Zustellung ergänzen.
6. Vor Freigabe Migration in isolierter Testdatenbank durchspielen: RLS für anonyme, unbeteiligte, Teilnehmer- und Super-Admin-Rollen; gleichzeitige Forderungen; Annahme, Ablehnung, 10-Tage-Frist, Spielabschluss und Rangwechsel; Rückzug/Disputfälle, Datenschutz.
7. Nach Umsetzung in Testumgebung: \`npm ci && npm test && npm run build && npm run audit:site && npm run qa:browser\` (Desktop/Mobile). Auch bestehende Start-, Mannschafts-, Kalender- und Adminfunktionen prüfen.
8. Erst nach eigenständiger Freigabe die SQL-Migration anwenden, E-Mail-Zustellung aktivieren und Navigation ergänzen. Keine Produktivänderung erfolgt allein durch Merge.

## Offene inhaltliche Entscheidungen

- Aus dem Oberrad-Regelwerk stammen drei Beispiele: Damen, Herren 30/40 und Herren 50+. Sie werden nicht blind für TSV Feldkirchen übernommen; die Administration legt passende Gruppen an.
- Auslegung der Einforderungsregel und Ergebnisstreitigkeiten durch den Sportwart bestätigen lassen.
- Regelwerk und Verantwortlicher auf TSV Feldkirchen anpassen; der im fremden PDF genannte Sportwart ist nicht automatisch TSV-Ansprechpartner.
- Das PDF enthält keine rechtssichere Verarbeitungserlaubnis für personenbezogene Daten. Die Datenschutzhinweise müssen vor Einführung ergänzt werden.

## Referenz

Vom Nutzer bereitgestelltes PDF: »Forderungspyramide SV Oberrad Tennis (Regeln), Stand April 2025«, fünf Seiten.
