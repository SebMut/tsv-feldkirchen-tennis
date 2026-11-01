# TSV Feldkirchen – Bestätigungs-E-Mails direkt mit Gmail

Stand: 01.11.2026 · **Nur** Supabase `eaurnufdochjapfzqwvm`
· Absender: **tsvfeldkirchen.tennis@gmail.com**

## Status und Ablauf

Die installierte Edge Function `event-rsvp-email` versendet jetzt über die **Google Gmail API** mit OAuth 2.0 anstelle von Resend.
Cloudflare Turnstile und der Zwei-Schritt-Bestätigungsablauf bleiben unverändert:

1. Mitglied gibt Namen, verpflichtende E-Mail, Teilnahme, Anzahl Erwachsene/Kinder, Buffet, Helfer und ggf. Jugendanmeldungen ein.
2. Cloudflare Turnstile wird serverseitig geprüft (Siteverify).
3. Die Funktion fordert mit dem gespeicherten Gmail-OAuth-Refresh-Token einen kurzfristigen Google-Zugriffstoken an und versendet im Namen des Vereins-Gmail-Kontos eine Mail mit **allen Details** und einem Bestätigungslink.
4. **Ein einziger Klick auf den Link in der E-Mail genügt:** Die Bestätigungsseite prüft den Token beim Öffnen im sichtbaren Browser automatisch und zeigt direkt „Erfolgreich bestätigt!“ – **kein zweiter Button**. Der Link ist 24 Stunden gültig und einmalig.
5. Bestätigte Mitgliederdaten sind nur im berechtigten Adminbereich sichtbar. Änderungen gehen erneut durch E-Mail-Bestätigung.

Bis die Secrets eingerichtet sind, gibt die Funktion `enabled:false` zurück. Sie verschickt dann absichtlich **keine** E-Mail.

## Einrichtung: Google Cloud + Gmail API

1. Anmelden unter **https://console.cloud.google.com/** mit `tsvfeldkirchen.tennis@gmail.com`.
2. Ein eigenes Google-Cloud-Projekt erstellen, z. B. `TSV Feldkirchen Mailversand`. Keine Website- oder Supabase-Migration notwendig.
3. **APIs & Services → Library**: `Gmail API` suchen und **Enable** wählen.
4. Unter **Google Auth Platform** eine OAuth-Zustimmungsansicht (Branding/Publikum) für die Anwendung konfigurieren. Für ein persönliches Gmail-Konto ist der Nutzertyp **External** relevant; bei Testing das Konto als Testnutzer hinzufügen.
5. Die Berechtigung `https://www.googleapis.com/auth/gmail.send` anfordern: **nur E-Mails senden**, nicht Postfach lesen oder löschen. Es ist ein *sensibler* Scope; für größere öffentliche Freigaben sind unter Umständen Verifizierungsmaßnahmen nötig.
6. Unter **Clients / Credentials** einen **OAuth-Client** vom Typ **Web application** erstellen. Für die einmalige autorisierte Einrichtung z. B. `https://developers.google.com/oauthplayground` als zulässige Redirect-URI eintragen.
7. Unter **https://developers.google.com/oauthplayground/** in den Einstellungen **Use your own OAuth credentials** wählen, die eigenen OAuth Client ID und das OAuth Client Secret lokal dort eintragen und in Schritt 1 den Scope `https://www.googleapis.com/auth/gmail.send` autorisieren. Dabei bei Google als `tsvfeldkirchen.tennis@gmail.com` anmelden. In Schritt 2 den Autorisierungscode eintauschen und den erhaltenen **Refresh Token** ausschließlich in Supabase speichern.
8. **Wichtig:** Google-OAuth-Anwendungen im Zustand **Testing** liefern bei Gmail-Scope im Normalfall Refresh Tokens, die nach **7 Tagen** ungültig werden. Für langfristigen Betrieb muss der OAuth-Publishing-Status und ggf. die von Google verlangte OAuth-Verifizierung geklärt werden. Eine unverifizierte Anwendung kann Warnhinweise erzeugen. Google-Kontozugriff ausdrücklich selbst genehmigen und bei Bedarf widerrufen.

Offizielle Google-Dokumentation:
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/protocols/oauth2

## Einrichtung: Cloudflare Turnstile

Unter **https://dash.cloudflare.com/** ein Turnstile-Widget für den Host `sebmut.github.io` anlegen. Für die spätere Hauptdomain zusätzlich `www.tennis-tsvfeldkirchen.de` und `tennis-tsvfeldkirchen.de` ergänzen.

Site Key und Secret Key gehören in Supabase, nicht in den öffentlichen Webcode.

## Einrichtung: Supabase Edge Function Secrets

Öffnen: https://supabase.com/dashboard/project/eaurnufdochjapfzqwvm/functions/secrets

Folgende **sechs** Werte anlegen:

| Name | Wert |
|---|---|
| `TURNSTILE_SITE_KEY` | Öffentlicher Cloudflare Turnstile Site Key |
| `TURNSTILE_SECRET_KEY` | Geheimer Cloudflare Turnstile Secret Key |
| `GMAIL_CLIENT_ID` | OAuth Client ID aus der Google Cloud Console |
| `GMAIL_CLIENT_SECRET` | OAuth Client Secret aus Google Cloud |
| `GMAIL_REFRESH_TOKEN` | Einmalig autorisierter OAuth Refresh Token für `tsvfeldkirchen.tennis@gmail.com` |
| `RSVP_BASE_URL` | `https://sebmut.github.io/tsv-feldkirchen-tennis/` |

Der sichtbare Gmail-Absender ist in der Edge Function auf `tsvfeldkirchen.tennis@gmail.com` festgelegt. **Weder `RESEND_API_KEY` noch `RESEND_FROM_EMAIL` werden weiter benötigt.**

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase den Edge Functions serverseitig bereit. Alle OAuth- und Turnstile-Geheimnisse bleiben in den **Supabase-Secrets**, niemals ins Repository, die Chatnachrichten oder in den Webclient kopieren. Gib auch keinem Helfer dein reguläres Gmail-Passwort.

### Warum nicht „Supabase Auth → Custom SMTP“?

Diese **Veranstaltungsanmeldung** verwendet eine eigene Edge Function und kein Supabase-Auth-Anmelde-E-Mail-Template. Die Einstellung **Auth → SMTP** ändert den Versand dieses Formulars nicht. Außerdem blockieren Supabase Edge Functions ausgehende Verbindungen auf den SMTP-Ports 25 und 587; die Gmail API funktioniert stattdessen über HTTPS.

## Test nach Einrichtung

1. Veranstaltungsentwurf mit künftigem Datum speichern und veröffentlichen.
2. Sommerfest unter `https://sebmut.github.io/tsv-feldkirchen-tennis/veranstaltung/?slug=sommerfest` aufrufen.
3. Reale Test-E-Mail-Adresse, Teilnahme und eine Personenzahl angeben und Turnstile lösen.
4. E-Mail im Empfängerpostfach prüfen: **Absender TSV Feldkirchen Tennis <tsvfeldkirchen.tennis@gmail.com>**, sämtliche Angaben und Bestätigungslink.
5. Vor Bestätigung dürfen die Teilnehmerzahlen **nicht** steigen.
6. Bestätigungsseite über den E-Mail-Link öffnen: Die Anmeldung wird **automatisch bestätigt**, ohne weiteren Button. Im Browser erscheint direkt das Ergebnis. Genau eine bestätigte Rückmeldung.
7. Wiederholtes Aufrufen des Links muss abgelehnt werden; Änderungen verlangen eine neue E-Mail-Bestätigung.

Zum Schutz der Jugendlichen und Teilnehmer müssen Datenschutztext, Archivierung und Löschfristen vor dem echten Vereinsbetrieb geprüft werden. Das Sommerfest bleibt eine unverbindliche Demo, bis ein Verantwortlicher einen echten Termin ausdrücklich veröffentlicht.

**Bestehende Hauptdomain ist weiterhin nicht umgestellt.**

## Fehlerbehebung: 404 beim Bestätigungslink

Falls der E-Mail-Link einen Zusatz wie `/%20Wert/` vor `veranstaltung/bestaetigen/` enthält, wurde im Secret `RSVP_BASE_URL` zusätzlich zum URL-Wert ein Feldetikett oder anderes Zeichen gespeichert. **Den Wert im Supabase-Dashboard vollständig ersetzen** durch exakt:

```text
https://sebmut.github.io/tsv-feldkirchen-tennis/
```

Die Edge Function prüft seit der Korrektur die Basis-URL **bereits bei der Konfigurationsabfrage**. Sie lässt ausschließlich die exakten Vorschau-/Produktions-URLs zu und verschickt bei einer falschen URL **keine E-Mail mit defektem Link**. So wird der Eingabefehler vor der Anmeldung angezeigt.

Bereits versandte Bestätigungslinks werden nicht automatisch umgeschrieben. Da im Support oder in Screenshots versehentlich öffentlich gewordene Bestätigungstokens einmalig und vertraulich sind, für solche Fälle eine **neue Testanmeldung** auslösen und nur den neuen Link in der eigenen Mailbox öffnen. Keine vollständigen Bestätigungslinks oder Token in Chats oder Issues posten.

## Ein-Klick-Bestätigung und E-Mail-Sicherheitsprüfung

Es gibt keinen Bestätigungsbutton mehr auf der Zielseite. Beim direkten Öffnen des E-Mail-Links wird ein **POST** aus dem Browser zur Supabase Edge Function `event-rsvp-email` gesendet; nur dann wird die Rückmeldung bestätigt. Die Tokenwerte werden unmittelbar aus der sichtbaren Browser-URL entfernt. Versteckte Vorschau- oder vorgerenderte Seiten bestätigen nicht automatisch, bevor sie sichtbar werden.

Hinweis: Manche E-Mail-Sicherheitsprogramme öffnen Links in einem echten Browser und führen auch JavaScript aus. Deshalb lässt sich eine unbeabsichtigte Bestätigung durch *alle* denkbaren Link-Scanner bei einem Ein-Klick-Verfahren nicht vollständig ausschließen. Ein zusätzlicher Bestätigungsklick wäre dagegen robuster, ist aber nicht mehr gewünscht. Der Link bleibt zeitlich begrenzt, einmalig und mit einem 256-Bit-Token geschützt.

**Keine vollständigen Bestätigungslinks veröffentlichen oder weiterleiten.** Falls ein Token in einem öffentlichen Chat/Issue gepostet wurde, eine neue Bestätigungs-E-Mail anfordern und ausschließlich deren Link verwenden.
