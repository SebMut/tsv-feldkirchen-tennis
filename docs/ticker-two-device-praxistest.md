# Liveticker – Praxistest und Mehrgerätebetrieb (02.11.2026)

## Testaufbau

- Die neue Browser-QA öffnet die echte öffentliche Liveticker-Oberfläche in **zwei unabhängigen Chromium-Kontexten**: Desktop und Smartphone.
- Die Begegnungsdaten werden an der **HTTP-Lese-Schnittstelle isoliert simuliert**. Es werden weder echte Matches geändert noch Tickermeldungen veröffentlicht.
- Beide Formate werden erprobt: **6 Einzel/3 Doppel (9 Begegnungen)** und **4 Einzel/2 Doppel (6 Begegnungen)**. Die Zahl der dargestellten Einzel/Doppel wird geprüft.
- Anschließend ändert sich die gemeinsam simulierte Datenquelle; **beide Browser müssen den fertigen Satzstand und den aktualisierten Mannschaftsstand über ihren 30-Sekunden-Polling-Fallback übernehmen**. Dies ist ein tatsächlicher Zwei-Fenster-Browsertest mit Mockdaten, **kein nachgewiesener WebSocket-Liveversand**.

## Produktivverbesserung

Der Adminbereich hat jetzt ebenfalls eine Supabase-Realtime-Subscription für `match_encounters` und `match_live_state`, ergänzt durch 30-Sekunden-Polling, Sichtbarkeits-/Fokusprüfung und sauberes Trennen beim Verlassen der Seite.

**Wichtig:** Solange ein Benutzer ungespeicherte Spielerdaten, Hallenanschriften oder Tickermeldungen bearbeitet, wird die Ansicht **nicht** automatisch ersetzt. Stattdessen erscheint ein Hinweis, der über eine externe Änderung informiert. Nach dem Speichern kann die Anzeige aktualisiert werden.

## 24h-Automatik und E-Mail: Betriebsprüfung

Per Supabase-SQL bestätigt:
- Der Cronjob `tsv-ticker-close-after-24h` ist aktiv und läuft minütlich.
- Die letzten beobachteten Cron-Durchläufe wurden von PostgreSQL als erfolgreich protokolliert.
- `private.close_expired_tickers` schließt ausschließlich `status='live'` und `started_at` mindestens 24 Stunden in der Vergangenheit.
- Der Status wird `expired`, **kein sportlicher Endstand** wird erfunden.
- Die private Versandwarteschlange ist eindeutig pro `(match_id, started_at)`; Empfänger ist der ursprüngliche Starter.
- Der Versand erfolgt nur über die serverseitige Edge Function `ticker-timeout-email` mit einmaligem Cron-Token und den bestehenden Gmail-Secret-Zugangsdaten.

**Nicht behauptet:** Es wurde keine echte 24h-Schwelle einer absichtlich gestarteten Testbegegnung durchlaufen und keine reale E-Mail verschickt. Bislang liegen null versandte Hinweise vor. Der vollständige End-to-End-E-Mail-Nachweis erfordert isolierte Testkonten, ein Testmatch und eine erlaubte Test-Mailbox.

## Regressionsgrenze

Die Browser-QA testet die Zwei-Geräte-Anzeige über den echten Polling-Fallback mit Mockdaten, ohne echte Datenbankmutationen. Ein tatsächlicher Realtime-Zustellungstest mit zwei angemeldeten Editoren und RLS-Prüfung bleibt als separater, geschützt auszuführender Testfall offen. Die bestehende Realtime-Publikation und die Rollen-/RLS-Policies wurden lesend überprüft und unverändert belassen.
