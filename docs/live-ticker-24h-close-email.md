# TSV Feldkirchen Tennis – LIVE-Menü und 24h-Ticker-Autoschluss

Stand: 02.11.2026. **Nur** GitHub `SebMut/tsv-feldkirchen-tennis` und Supabase `eaurnufdochjapfzqwvm`.

## Verhalten
- In der Desktop-Navigation, dem mobilen Menü und der unteren Navigation wird **Live-Ticker rot pulsierend** dargestellt, wenn eine veröffentlichte Begegnung in `match_live_state.status='live'` steht. Alle 30 Sekunden und beim Zurückkehren zum Tab wird der Status erneut geprüft. Bei `prefers-reduced-motion` ist die Animation deaktiviert.
- Jede neue Aktivierung von `live` speichert den tatsächlichen `started_at`-Zeitpunkt sowie **`started_by`**, auch wenn später eine andere Person nur den Spielstand bearbeitet.
- Der Supabase Cronjob `tsv-ticker-close-after-24h` läuft minütlich. Er setzt bei `started_at <= now()-interval '24 hours'` den Status auf **`expired`** und `auto_closed_at=now()`. Der Spieltag ist dann nicht mehr LIVE. Bestehende Einzel/Doppel/Ergebnisse bleiben erhalten; ein sportlicher Endstand wird **nicht** erfunden. Der Admin kann den Ticker bewusst neu starten (neuer 24h-Zeitraum).
- Gleichzeitig wird eine einzige Erinnerung an die Account-E-Mail des ursprünglichen Ticker-Starters vorgemerkt. Text: Das Spiel **war** nach 24 Stunden noch als LIVE geführt, der Ticker wurde deshalb automatisch geschlossen; bitte Endergebnis prüfen. Das responsive HTML hat roten Header `#e30613`, dunkelgrünen Footer `#193c2c` und führt Mannschaft/Gegner/Start auf.
- Absender ist `tsvfeldkirchen.tennis@gmail.com`, Gmail OAuth nutzt die bereits vorhandenen Secrets `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`. Wenn ein Token abläuft, wird die Benachrichtigung protokolliert und später erneut versucht. Der Autoschluss funktioniert unabhängig vom Maildienst.

## Sicherheitskonzept
- Die Tabellen `private.ticker_timeout_notices` und `private.ticker_cron_tokens` sind **nicht** über die öffentliche Supabase-API zugänglich.
- Cron erstellt eine zufällige, kurz gültige Einmal-ID und ruft `ticker-timeout-email` über `pg_net` auf. Erst nach dem Verbrauch dieser ID darf die Edge Function die Mailwarteschlange lesen.
- Nur `service_role` darf die drei dafür notwendigen RPCs nutzen. Einmalige Versandreservierung mit `FOR UPDATE SKIP LOCKED`, Exponential-/intervallbasierte Retries und eindeutiger Schlüssel `(match_id,started_at)` verhindern Wiederholungen weitgehend. Ein Versand kann nicht absolut genau einmal garantiert werden, falls Gmail die Mail annimmt, aber die Bestätigung in Supabase danach fehlschlägt.
- Keine Gmail-Secrets oder Empfänger-Adressen in öffentlichen Logs, dem Repo oder der Browser-API. Bereits laufende Liveticker bekommen als bestmöglichen ursprünglichen Starter den bislang zuletzt eingetragenen `updated_by`; für neue Starts ist `started_by` zuverlässig erfasst.

## Betrieb prüfen
1. Supabase → Database → Cron → Job `tsv-ticker-close-after-24h`: aktiv, Intervall `* * * * *`.
2. Supabase → Edge Functions → `ticker-timeout-email`: **ACTIVE**, `verify_jwt=false`. Sicherheit übernimmt die einmalige DB-Dispatch-ID.
3. SQL für rein lesenden Status:
```sql
select status,count(*) from public.match_live_state group by status;
select jobname,schedule,active from cron.job
where jobname='tsv-ticker-close-after-24h';
select count(*) as pending from private.ticker_timeout_notices where sent_at is null;
```
4. Ein Test: autorisierte Person startet einen Ticker, Menü wird LIVE; bei manuellem Beenden hört der Puls auf. Echte 24h-Erinnerung wird erst beim Erreichen der 24-Stunden-Grenze versendet, nicht durch einen Testlauf vorgezogen.

**Hinweis:** Das Mail-Google-Projekt darf nicht dauerhaft im kurzlebigen OAuth-Testing-Status verbleiben; sonst können Refresh-Tokens nach ca. sieben Tagen auslaufen.
