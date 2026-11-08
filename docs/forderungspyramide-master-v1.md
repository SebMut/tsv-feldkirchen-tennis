# Forderungspyramide – verbindliches Master-Regelwerk 1.0

**Quelle der Regeln:** letzte vom Auftraggeber hochgeladene Datei `Eingefügtes Markdown(3).md`, mit dem Titel „Forderungspyramide für einen Tennisclub – Spielanleitung und Regelwerk – Version 1.0“. Diese Fassung **überschreibt die zuvor verwendeten TSV-/Oberrad-Fristwerte**.

## Verbindliche Regeln

- Klassische, dynamisch wachsende Tannenbaum-Pyramide für freiwillig teilnehmende Mitglieder.
- Regelgeometrie: gleiche Reihe links und nächsthöhere Reihe rechts darüber; Rang 3 darf Platz 1 fordern.
- **Bindende Beispieltabelle** des Masters: 1→niemand, 2→1, 3→1/2, 5→2/3/4, 8→5/6/7, 13→9/10/11/12, 15→11/12/13/14. Die Fälle **5** und **15** weichen von der im Master abgedruckten allgemeinen Formel ab. Sie werden im Frontend und in der Datenbank ausdrücklich als Tabellen-Ausnahmen behandelt, damit die konkrete Beispieltabelle eingehalten wird.
- Saisonstandard **1. Mai bis 30. September**, pro Rangliste weiterhin individuell einstellbar. Vorhandene historische Saison-/Gruppendaten nicht löschen.
- Neue Teilnehmer werden nach Ranglistenwart-Freigabe am **Ende der Rangliste** eingeordnet; **kein Einforderungsspiel**.
- Eine Forderung gilt nach Speicherung. Geforderte Person erhält automatisch eine E-Mail; die beiden Spieler vereinbaren möglichst innerhalb **3 Tagen** einen Termin, und das Spiel findet innerhalb **14 Tagen ab Forderung** statt.
- Gleichzeitig höchstens **eine offene Forderung pro Spieler**, einschließlich gemeldeter, noch nicht bestätigter und strittiger Ergebnisse. Rivalisierende Forderungen sind serverseitig und bei gleichzeitigen Transaktionen gesperrt.
- Zwei Gewinnsätze; Entscheidung im dritten Satz als Match-Tie-Break bis mindestens 10, 2 Punkte Abstand. Platzreservation und Bälle organisiert der Herausforderer.
- Sieger meldet Ergebnis; Gegner bestätigt innerhalb **48 Stunden**. Vor Bestätigung: keine Platzverschiebung. Bei Widerspruch oder ausbleibender Bestätigung entscheidet der Ranglistenwart.
- Bei Sieg des Herausforderers: Übernahme des gegnerischen Rangs, dazwischen liegende Plätze +1. Bei Niederlage: unveränderte Reihenfolge.
- Nach Niederlage: **7 Tage** vor nächster eigener Forderung. Derselbe Gegner: erst nach **7 Tagen** erneut. Sieger: **48 Stunden** Schutz gegen eingehende Forderungen.
- Nach **14 Tagen** ohne Ergebnis: sichtbarer Status „Frist überschritten“ und Entscheidung des Ranglistenwarts zu Verlängerung, Stornierung oder kampfloser Wertung; kein automatischer Rangwechsel.
- Nach **15 Minuten Nichtantritt** bei vereinbartem Termin dürfen Spielpartner eine kampflose Wertung beantragen; ausschließlich die Ranglistenverwaltung bestätigt sie.
- Bei Schlechtwetter: **einmalige Verlängerung um maximal 7 Tage** durch Ranglistenwart.
- Neutralisierung bei Urlaub/Krankheit/Verletzung: maximal **28 Tage**; keine Forderungen währenddessen. Die bisherige relative Rangfolge bleibt erhalten; andere Begegnungen dürfen die Position relativ verschieben. Danach erfolgt automatische Rückkehr zu „Spielbereit“, keine zusätzliche automatische Rückstufung.
- Bereits offene Forderungen müssen vor Neutralisierung abgeschlossen bzw. mit Zustimmung der Verwaltung geschlossen werden.
- Ranglistenverwaltung kann Saison archivieren und reaktivieren, LK-Startaufstellung pflegen, Streitigkeiten entscheiden, sowie rechtssicher Spielergebnisse führen.

## UX und Berechtigungen

- Profilbild über die bestehende Medienlogik im Storage `media`, **oben links** auf der Kachel.
- Neutralisierungs-Badges „Urlaub“ und „Verletzung“ (auch andere Abwesenheitsgründe) **rechts unten** auf der Kachel, Desktop und Smartphone.
- Die Seite `/forderungspyramide/` bleibt ohne öffentlichen Menüeintrag und mit `noindex`; Mitgliederdaten nur mit Authentifizierung und passenden RLS-Rechten.
- Globale Berechtigung `pyramid` oder `super_admin` für Admin-Aktionen; Sicherheitsprüfung in Supabase.
- Produktivschema und SQL-Funktionen liegen unter `supabase/migrations/20261108213000_pyramid_master_v1_rules.sql`. UI in `src/scripts/pyramid.ts` und `src/scripts/admin-pyramid.ts`.
- Bei einer Änderung dieser Regeln muss die Quelle aktualisiert, eine zusätzliche Migration eingecheckt und die Website mit Unit-Tests, Site-Audit, Desktop-/Mobile-Browsertests und Deployment-Checks geprüft werden.

## Abweichungen zum zuvor implementierten Stand

Die alten Regeln „7 Tage zur Terminvereinbarung + 10 Tage bis Match“, 3 Tage nach Niederlage, 14 Tage Rückforderungssperre, Neueinsteiger-Qualifikationsspiel, 28-tägige Rangrückstufung bei Urlaub/Verletzung und sofortige Rangänderung nach einseitiger Ergebnismeldung gelten **nicht mehr**.
