# TSV Feldkirchen – geschützte Ergebniserfassung

**Route (nach Aufnahme in den GitHub-Pages-Vorschau-Build):**
`/tsv-feldkirchen-tennis/verwaltung/ergebnisse/`

**BTV und tennis.de sind die offiziellen Primärquellen.** Manuell erfasste Nachträge sind bis zum amtlichen Abgleich lediglich interne TSV-Angaben. Es gibt **keine** automatische Änderung an `matches.btv_result_text`, `official_meeting_reports`, `official_report_rubbers` oder am Liveticker.

## Bedienung

1. Mit einem bestehenden berechtigten TSV-Konto per Passwort oder optional per E-Mail-Anmeldelink anmelden. Es wird kein neuer Benutzer durch die Eingabemaske registriert.
2. Saison auswählen (standardmäßig Sommer 2026), nach Mannschaft/Gegner suchen und eine offene Begegnung auswählen.
3. Spielstatus angeben. Bei normalem Spiel **Heim : Gast** mit zwei Punktwerten eingeben (0:0 ist als reguläres Endergebnis unzulässig); bei Rückzug, Nichtantritt, Verschiebung oder ungeklärter Wertung dürfen die Punktfelder leer bleiben.
4. Quelle wählen, möglichst offiziellen BTV-/tennis.de-Link ergänzen, Fakten kontrollieren und speichern. Der Nachtrag bleibt `manual_pending` und wird nicht ungeprüft veröffentlicht.
5. Bestehende Nachträge können von berechtigten Personen korrigiert werden. Ein bereits in `btv_result_text` hinterlegtes offizielles Ergebnis sperrt weitere manuelle Nachträge.

## Sicherheit und Datenbank

- **Einziges Projekt:** `eaurnufdochjapfzqwvm`. Der HTML-Client verwendet ausschließlich dessen **öffentlich vorgesehenen** Supabase-Publishable-Key; keine Service-Role-Secrets.
- Supabase-Migration `add_manual_match_results` wurde per verbundenem Projekt-Tool ausgeführt; SQL-Definition liegt nachvollziehbar unter `scripts/sql/manual-results-entry-schema.sql`. Nicht erneut blind in einer bestehenden DB ausführen.
- `manual_match_results` ist RLS-geschützt, mit INSERT/UPDATE für nach `private.can_edit_team_season` berechtigte Benutzer. Die Ansicht `manual_editable_matches` wird per `security_invoker` und zusätzlichem Berechtigungsfilter eingeschränkt. Keine `anon`-Berechtigung.
- Es werden ausschließlich Mannschafts-/Gegner- und Ergebnisdaten erfasst, **keine Spielerlisten oder Jugendlichen-Namen** in öffentliche Dateien. Das Bemerkungsfeld dient nur fachlichen Notizen ohne private Namen.
- Über Supabase-API durch einen berechtigten Benutzer gespeicherte Nachträge erhalten `entered_by`, `updated_by` und Zeitstempel.
- Vor der ersten echten Nutzung muss das verwendete Konto in `profiles` bzw. den Teams mit den entsprechenden Rollen ausgestattet sein. Der E-Mail-Link setzt eine erlaubte Auth-Redirect-URL voraus; alternativ die Passwortanmeldung nutzen.
- Die Funktion ist eine **Verwaltungsmaske**, kein amtliches Ergebnisprüfungsverfahren. Die bestehende öffentliche Ergebnisdarstellung wird noch nicht um geprüfte manuelle Ergebnisprojektionen erweitert.

## Prüfstand 31.10.2026

- Nach RLS-Migration: Anonyme Benutzer haben weder Lesezugriff auf die Tabelle noch die Admin-Ansicht.
- In einer simulierten Superadmin-Sitzung zeigt die Ansicht genau **14** Sommer-2026-Begegnungen ohne BTV-Ergebnis.
- Test-INSERT und Test-UPDATE im `authenticated`-Rollenkontext erfolgreich; Transaktion vollständig zurückgerollt. **0 reale manuelle Ergebnisse** gespeichert.
- UI-Quellcode statisch geprüft; die tatsächliche Anmeldung mit einem Browserkonto und das GitHub-Pages-Deployment sind gesondert im Vorschau-Frontend zu prüfen.
