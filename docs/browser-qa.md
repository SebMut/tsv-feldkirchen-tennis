# Browser-Qualitätskontrolle (automatisch)

Der bestehende Test-/Build-/Site-Audit bleibt erhalten. Zusätzlich testet
`scripts/browser-qa.mjs` das gebaute Astro-Projekt **im echten Chromium-Browser**.

## Automatische Prüfung

- Desktop **1440×900** und Smartphone **390×844**.
- Acht öffentliche und geschützte Routen: HTTP 200, Seitentitel, Hauptinhalt, kein horizontaler Überlauf oder JavaScript-Absturz.
- Bilddateien auf Startseite, Aktuelles, Mannschaften, Spieltag und Live müssen korrekt laden.
- Aktuelles-Navigation und vollständige Veranstaltungsdetails (ohne Kalenderumleitung).
- Kalender-Tagesmodal muss sich per Escape schließen.
- Veranstaltungs- und Loginformular erkennen syntaktisch ungültige E-Mail-Adressen, ohne eine Antwort abzusenden.
- Die Admin-Anwendung bleibt für nicht angemeldete Besucher verborgen.
- Optional: Rollenmenüs ticker-only, news-only, events-only mit separat eingerichteten Testkonten.

Die Browsertests sind **rein lesend** und schreiben keine Testdaten in die produktive Supabase-Datenbank.
Bei Fehlern stoppt der Testjob die CI; der Preview-Workflow **veröffentlicht nicht**, falls Browser-QA fehlschlägt.
Ein JSON-Bericht und Screenshots (bei Fehlern zusätzliche Beweisbilder) werden als GitHub-Artefakte sieben Tage gespeichert.

## Lokal

1. npm ci
2. npm install --no-save --package-lock=false playwright@1.56.1
3. npx playwright install chromium
4. npm run build
5. npm run qa:browser

Für GitHub-Pages-ähnliche Builds PREVIEW_BASE=/tsv-feldkirchen-tennis beim Build und Browser-Test setzen.

## Geschützte Berechtigungen

Optionale GitHub-Actions-Secrets für **eigens angelegte, eingeschränkte Testkonten**:

- QA_ROLE_TICKER_EMAIL / QA_ROLE_TICKER_PASSWORD
- QA_ROLE_NEWS_EMAIL / QA_ROLE_NEWS_PASSWORD
- QA_ROLE_EVENTS_EMAIL / QA_ROLE_EVENTS_PASSWORD

Fehlen diese Accounts, steht im JSON-Bericht **skipped**, niemals fälschlich **passed**.
Die Rollenprüfungen melden sich nur an und prüfen lesend die sichtbaren Menüs.

## Noch nicht abgedeckt

Die Screenshot-Aufnahme ist **kein pixelgenauer Regression-Vergleich mit freigegebenen Referenzbildern**.
Bei fehlenden Ereignissen wird der Detailtest als **skipped** protokolliert.
Für vollständige Berechtigungstests braucht es separate kontrollierte Auth-/RLS-CRUD-Testkonten;
für Upload-, E-Mail-, PDF- und Realtime-Tests isolierte Testdaten und mindestens zwei Geräte/Sessions.
Keine Produktionspasswörter oder persönlichen Vereinsdaten als QA-Testmaterial verwenden.

Der Produktiv-Domain-Go-live bleibt ausschließlich nach separater Freigabe zulässig.
