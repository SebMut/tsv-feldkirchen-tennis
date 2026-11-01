# TSV Feldkirchen – sichere Veranstaltungseinladungen mit E-Mail-Bestätigung

Stand: 01.11.2026 · Gilt nur für Supabase-Projekt `eaurnufdochjapfzqwvm`.

## Ablauf
1. SuperAdmin legt eine Veranstaltung an und veröffentlicht sie ausdrücklich.
2. Mitglied gibt Name, **verpflichtende E-Mail**, Zusage/Absage, Erwachsene/Kinder, Buffet, Helfer und ggf. Jugendanmeldungen ein.
3. Der Browser zeigt Cloudflare Turnstile. Das Ergebnis wird **in Supabase Edge Functions per Siteverify** geprüft (5 Minuten gültig, einmalig).
4. Nach der Prüfung wird eine E-Mail über Resend mit allen Angaben und einer Bestätigungs-URL versendet.
5. Nur ein Klick auf **„Ja, meine Angaben verbindlich bestätigen“** auf der Bestätigungsseite übernimmt die Antwort. Die Teilnehmerliste und Summen enthalten nur bestätigte E-Mails. Links verfallen nach 24 Stunden.
6. Änderungen werden durch erneute Einreichung und einen neuen Bestätigungslink **an dieselbe E-Mail-Adresse** geschützt. Es ist keine verifizierte Mitgliederprüfung.

## Vor dem produktiven Versand – erforderliche Konfiguration

Die Supabase-Funktion `event-rsvp-email` benötigt in **Supabase Dashboard → Edge Functions → Secrets** diese fünf Werte:
- `TURNSTILE_SITE_KEY`: öffentlicher Site-Key des Cloudflare-Turnstile-Widgets
- `TURNSTILE_SECRET_KEY`: geheim bleibender Schlüssel desselben Widgets
- `RESEND_API_KEY`: API-Key des E-Mail-Versenders Resend
- `RESEND_FROM_EMAIL`: Absender einer bei Resend verifizierten Domain, z. B. `Tennis TSV Feldkirchen <anmeldung@DEINE-VERIFIZIERTE-DOMAIN>`
- `RSVP_BASE_URL`: aktuell `https://sebmut.github.io/tsv-feldkirchen-tennis/` (mit abschließendem `/`)

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` werden vom Supabase-Projekt in Edge Functions bereitgestellt; **niemals im GitHub-Repository oder Webclient hinterlegen**.

Cloudflare Dashboard → Turnstile: Widget erstellen, Hostname `sebmut.github.io` zulassen; vor Domainumzug zusätzlich `www.tennis-tsvfeldkirchen.de` und `tennis-tsvfeldkirchen.de` zulassen. Cloudflare benötigt keinen Proxy vor GitHub Pages.

Die E-Mail-Domain muss vom Verein kontrolliert und bei Resend verifiziert werden. Ohne diese Angaben liefert die Edge Function `enabled:false` und die echte Anmeldung ist **absichtlich geschlossen**, statt eine falsche Erfolgsmeldung auszugeben.

## Sicherheitsregeln

- Keine öffentlich beschreibbare oder lesbare E-Mail-/Teilnehmertabelle.
- E-Mail und Antworten stehen bis zum Ablauf des Links ausschließlich in `event_rsvp_pending` (RLS aktiviert; nur Service Role), erst danach in `event_rsvps`.
- Bestätigungslink enthält 256-Bit-Zufallstoken; in der Datenbank liegt nur dessen SHA-256-Hash. Bei Bestätigung wird er transaktional verbraucht.
- Turnstile wird serverseitig geprüft und Hostname kontrolliert; ein Widget allein schützt nicht.
- Höchstens drei angeforderte Links je Adresse und zehn je Anfrageherkunft pro Stunde. Für starken Spam-Schutz ggf. zusätzliche Edge-/Gateway-Rate-Limits ergänzen.
- Datensparsamkeit: Ausstehende abgelaufene Anmeldungen regelmäßig entfernen. Dafür ist noch ein Retention-Job einzurichten.
- Da die Mail die Jugendnamen enthalten kann, sollten die Vereinsverantwortlichen vor echten Veranstaltungen einen geeigneten Datenschutzhinweis und die Form der Einwilligung abstimmen.

## Test nach Geheimnis-Konfiguration

1. Testveranstaltung als Entwurf speichern: Meldung „als Entwurf gespeichert“, in Auswahlliste auffindbar.
2. Ein zukünftiges Datum setzen und veröffentlichen.
3. Mit einer echten Mailbox Turnstile lösen und Rückmeldung einreichen.
4. Überprüfen, ob die E-Mail alle Angaben zeigt.
5. **Vor Linkbestätigung:** öffentliche Summen und Admin-Teilnehmerzahl unverändert.
6. Link öffnen, Bestätigungsbutton drücken: genau eine bestätigte Rückmeldung, richtige Personenzahl und E-Mail.
7. Denselben Link erneut anklicken: abgewiesen; dieselbe Adresse mit geändertem Stand erneut bestätigen: bisherige Rückmeldung wird aktualisiert.

Die Website unter `www.tennis-tsvfeldkirchen.de` ist noch nicht umgestellt. Alle derzeitigen Änderungen betreffen nur die GitHub-Pages-Vorschau.
