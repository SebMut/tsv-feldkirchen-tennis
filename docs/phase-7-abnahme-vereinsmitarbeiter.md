# Phase 7 – Abnahmebogen für Vereinsmitarbeiter

**TSV Feldkirchen Tennis – neue Website (GitHub-Pages-Vorschau)**

Testseite: https://sebmut.github.io/tsv-feldkirchen-tennis/  
Verwaltungsbereich: https://sebmut.github.io/tsv-feldkirchen-tennis/admin/  
**Wichtig:** Dies ist die **Testversion**. Kein Go-live, keine Änderung an https://www.tennis-tsvfeldkirchen.de/ durch diese Abnahme.

> Dieser Bogen ist ein **Testprotokoll**, keine schon erfolgte Abnahme. „Bestanden“ darf erst nach tatsächlichem Ausprobieren mit den jeweiligen Benutzerkonten eingetragen werden.

## A. Testdurchführung

| Feld | Bitte ausfüllen |
| --- | --- |
| Datum / Uhrzeit | |
| Name des Prüfers | |
| Rolle (SuperAdmin / Manager / Redakteur / Ticker / Besucher) | |
| Gerät (Smartphone / Tablet / Computer) | |
| Browser / Betriebssystem | |
| Getesteter GitHub-Commit (falls bekannt) | |
| Allgemeine Bemerkungen | |

**So bewerten wir jeden Test:**

- **OK** – selbst ausprobiert, funktioniert wie beschrieben.
- **FEHLER** – Ergebnis weicht ab; bitte genaue Schritte und ggf. Screenshot notieren.
- **OFFEN** – noch nicht ausprobiert oder Voraussetzungen fehlen.
- **N/A** – trifft für diese Rolle oder Mannschaft nicht zu.

**Datenschutz beim Testen:** Keine echten fremden Spieler-/Mitgliederdaten als Testeintrag verwenden. Keine Passwörter, Authentifizierungslinks, privaten Kontaktdaten oder Zugangstokens in Screenshots bzw. Fehlerberichte kopieren. Wenn eine Veröffentlichung, Buchung oder E-Mail tatsächlich ausgelöst würde, nur nach vorheriger Absprache testen. Testeinträge eindeutig kennzeichnen und durch Berechtigte wieder entfernen.

## B. Besucherprüfung – ohne Anmeldung (ca. 10 Minuten)

| ID | Prüfschritt | Erwartetes Ergebnis | OK/FEHLER/OFFEN |
| --- | --- | --- | --- |
| B01 | Vorschau auf Smartphone öffnen | Startseite, Logo und Menü erscheinen; nichts bleibt dauerhaft bei „Wird geladen“. | |
| B02 | „Mannschaften“ öffnen und eine Mannschaft wählen | Mannschaft, Saison, Spiele und ggf. Kader werden angezeigt; fehlende Inhalte sind verständlich gekennzeichnet. | |
| B03 | Kalender öffnen | **Heutiger Tag** ist hervorgehoben und vorausgewählt; Monat und Tagesdetails stimmen. | |
| B04 | Im Kalender zurück-/vorblättern und ein Datum auswählen | Tagesagenda wechselt; Punkte: Herren **blau**, Damen **lila**, Jugend **orange**, Veranstaltung **grün**. | |
| B05 | „Spieltag“ und ein abgeschlossenes Spiel öffnen | Heim/Auswärts, Mannschaftslogo und vorhandene Ergebnisse sind plausibel. | |
| B06 | „Aktuelles“ und „Funktionäre“ öffnen | Nur veröffentlichte Inhalte und freigegebene Kontaktangaben erscheinen. | |
| B07 | „Platz buchen“ wählen | Courtbooking öffnet sich separat; TSV-Seite zeigt **keine simulierte Buchungsverfügbarkeit**. | |
| B08 | Kalender-Abonnement auswählen | ICS-Link wird angeboten; bei vorhandener Kalender-App kann das Abonnement verwendet werden. | |
| B09 | „Mein TSV“ ohne Login aufrufen | Keine vertraulichen Verwaltungsdaten oder Bearbeitungsaktionen ohne Login. | |
| B10 | Vorschau am Computer öffnen | Navigation, Logo, Bilder, Kalender und Links bleiben übersichtlich. | |

**Ergebnis Besucher:** ______________________  
**Fehler-IDs / Screenshots:** ______________________

## C. SuperAdmin (ca. 15–25 Minuten)

Nur mit bereits eingerichtetem **echten SuperAdmin-Testkonto** ausführen. Keine neuen Zugangsdaten in dieses Protokoll schreiben.

| ID | Prüfschritt | Erwartetes Ergebnis | OK/FEHLER/OFFEN |
| --- | --- | --- | --- |
| S01 | Anmelden und „Mein TSV“ aufrufen | Admin-Dashboard sichtbar, alle berechtigten Bereiche erreichbar. | |
| S02 | Anlagenstatus anzeigen, vorübergehend ändern und Ursprungswert wiederherstellen | Änderung wird gespeichert und öffentlich korrekt angezeigt; zeitliche Aktualisierung sichtbar. | |
| S03 | Bei einem Platz Hinweis/Status bearbeiten und zurückstellen | Nur der gewählte Platz ändert sich, Speichern bestätigt den Erfolg. | |
| S04 | Vorhandenen **inaktiven** Sponsor aufrufen | Eintrag kann trotz Ausblendung zur Bearbeitung geöffnet werden. | |
| S05 | Sponsor ändern, speichern und alte Einstellung wiederherstellen | Name/Beschreibung/Reihenfolge/Status bleiben korrekt erhalten. | |
| S06 | Funktionär öffnen und „Veröffentlicht“ prüfen | Nicht freigegebene Personen/Kontakte erscheinen öffentlich nicht. | |
| S07 | Sponsorplatzierung deaktivieren und wiederherstellen | Platzierung bleibt erhalten und ihre Sichtbarkeit ändert sich. | |
| S08 | Vorhandenen verwalteten Seiteninhalt laden (z. B. Training) | Änderungen können gespeichert, anschließend rückgängig gemacht werden. | |
| S09 | Benutzerübersicht und Mannschaftsrechte ansehen | Berechtigungen stimmen; keine unbeabsichtigte Änderung oder Löschung. | |
| S10 | Abmelden | Adminaktionen nicht mehr erreichbar; neues Login notwendig. | |

**Hinweis:** Keine echten SuperAdmins löschen. Keine echten Einladungsmails zum bloßen Testen verschicken. Änderungen an Vereinsdaten nur mit Einverständnis und nach dokumentierter Wiederherstellung durchführen.

**Ergebnis SuperAdmin:** ______________________  
**Fehler-IDs:** ______________________

## D. Mannschaftsmanager / Redakteur (ca. 15 Minuten)

Für ein **vorab zugewiesenes** Mannschaftskonto prüfen, ohne reale veröffentlichte Inhalte unbeabsichtigt zu verändern.

| ID | Prüfschritt | Erwartetes Ergebnis | OK/FEHLER/OFFEN |
| --- | --- | --- | --- |
| M01 | Als Manager/Redakteur anmelden | Nur zugewiesene Mannschaft(en) und erlaubte Funktionen werden angeboten. | |
| M02 | Zugewiesene Mannschaft/Kader ansehen | Berechtigte Spielerpflege möglich; keine anderen Mannschaften änderbar. | |
| M03 | Eindeutig gekennzeichneten **News-Entwurf** erstellen | Entwurf speicherbar und für Besucher **nicht** öffentlich sichtbar. | |
| M04 | News-Entwurf erneut öffnen und bearbeiten | Änderungen werden gespeichert; Textvorschau funktioniert. | |
| M05 | Bestehenden Mannschaftsspieltag dem Bericht zuordnen | Zuordnung nur zur eigenen Mannschaft möglich. | |
| M06 | Veranstaltung als Entwurf erstellen und bearbeiten | Termin wird gespeichert, Änderungen bleiben erhalten; öffentlich nur nach Freigabe. | |
| M07 | Nicht zugewiesene Mannschaft auswählen/URL direkt aufrufen | Server verhindert unberechtigte Änderungen; keine Erfolgsbestätigung. | |
| M08 | Anlagenstatus, Vereins-Sponsoren, Benutzerrechte öffnen/ändern wollen | Keine Schreibberechtigung für allgemeine Adminfunktionen. | |
| M09 | Testentwürfe kontrolliert wieder entfernen/archivieren | Kein Testinhalt bleibt versehentlich veröffentlicht. | |

**Ergebnis Mannschaftsredaktion:** ______________________  
**Fehler-IDs:** ______________________

## E. Liveticker-Bearbeiter – besonders wichtig (ca. 20 Minuten)

**Nur mit einem vorher abgestimmten Testspiel und berechtigtem Ticker-Konto.** Keine realen Ergebnisse überschreiben. Ein zweites Gerät zeigt den öffentlichen Ticker, während das erste Gerät bearbeitet.

| ID | Prüfschritt | Erwartetes Ergebnis | OK/FEHLER/OFFEN |
| --- | --- | --- | --- |
| T01 | Ticker-Konto anmelden | Direkter Zugang zu zugewiesenem Spieltag und Liveticker. | |
| T02 | Format **6 Einzel / 3 Doppel** prüfen | Sechs Einzel und drei Doppel klar und schnell sichtbar. | |
| T03 | Ausnahmeformat **4 Einzel / 2 Doppel** an geeignetem Testspiel prüfen | Vier Einzel, zwei Doppel; keine überzähligen Begegnungen. | |
| T04 | TSV-Spieler für eine Begegnung wählen | TSV-Spieler korrekt benannt; Gegenseite zeigt **Gegner 1 … Gegner 6** statt erfundener Namen. | |
| T05 | Heimspiel und Auswärtsspiel vergleichen | TSV-Logo auf der richtigen Seite; Ergebnisse orientieren sich an Heim/Auswärts. | |
| T06 | Einzel/Doppel nacheinander aktualisieren | Status, Spielstände und Gesamtwertung sind nachvollziehbar. | |
| T07 | Gleichzeitig Ticker auf zweitem Smartphone öffnen | Änderungen werden zeitnah sichtbar, ohne dauerhaftes manuelles Neuladen. | |
| T08 | Beide Geräte verlieren kurz die Verbindung | Verständlicher Fehler-/Wiederverbindungszustand, keine erfundenen Daten. | |
| T09 | Ticker-Konto versucht News/Sponsoren/Anlage zu ändern | Keine Berechtigung; Änderung wird serverseitig abgewiesen. | |
| T10 | Testzustand gemäß vorheriger Vereinbarung zurücksetzen | Keine falschen Live-Ergebnisse im öffentlichen Archiv. | |

**Ergebnis Liveticker:** ______________________  
**Fehler-IDs:** ______________________

## F. Kalender, Medien und Sonderfälle

| ID | Prüfschritt | Erwartetes Ergebnis | OK/FEHLER/OFFEN |
| --- | --- | --- | --- |
| F01 | Kalender am kleinen Smartphone (schmale Bildschirmbreite) | Keine abgeschnittenen Tage/Buttons; Tagesdetails unter dem Raster. | |
| F02 | Mehrere Kategorien am gleichen Tag | Alle zugehörigen farbigen Punkte gleichzeitig sichtbar. | |
| F03 | Monatswechsel September/Oktober und Dezember/Januar | Datum bleibt korrekt, „Heute“-Taste springt zum aktuellen Datum. | |
| F04 | Apple Kalender oder Outlook ICS abonnieren | Termine werden importiert; Uhrzeit korrekt in Europe/Berlin. | |
| F05 | ICS-Abo erneut abrufen | Keine Dubletten aufgrund fehlerhafter IDs. | |
| F06 | Bild-Upload für berechtigten Testinhalt (nach Absprache) | Unterstützte Bilddatei hochladbar; Vorschau und Darstellung unverzerrt. | |
| F07 | Falsche oder zu große Datei testen | Upload wird verständlich abgewiesen; keine kaputte Veröffentlichung. | |
| F08 | Internetverbindung kurz unterbrechen | Kein unendlicher Spinner; verständliche Fehlermeldung. | |
| F09 | Saisonarchiv wählen | Historische Saison und zugehöriger Kader/Spielplan werden richtig angezeigt. | |
| F10 | Bildschirm mit Tastatur bedienen | Fokus sichtbar, Kalender mit Tasten bedienbar, Schaltflächen verständlich beschriftet. | |

## G. Fehlerbericht

Bei einem Fehler bitte je Eintrag folgende Angaben notieren:

**Fehler-ID:** ______  
**Prüfschritt:** ______  
**Rolle/Gerät/Browser:** ______  
**Was habe ich angeklickt?** ______  
**Was hätte passieren sollen?** ______  
**Was ist tatsächlich passiert?** ______  
**Screenshot ohne private Daten:** ______

Priorität: **P0 Blocker** (Sicherheit/Datenverlust/falsche Rechte), **P1 kritisch** (Login, Speichern, Ticker/Platzbuchung unbenutzbar), **P2 normal** (Anzeige-/Bedienfehler), **P3 kosmetisch** (Optik).

**P0 und P1 blockieren die spätere Go-live-Freigabe.** Keine Freigabe aus der bloßen Anzahl erfolgreicher automatischer Builds ableiten.

## H. Abschließende Vereinsfreigabe

- [ ] Die relevanten Rollen wurden mit echten Benutzerkonten ausprobiert.
- [ ] Der Liveticker wurde auf zwei Geräten praktisch getestet.
- [ ] Die wichtigsten öffentlichen Seiten wurden auf Smartphone und Desktop geprüft.
- [ ] Die verantwortliche Person hat Logo, Bilder, Texte, Personen-/Kontaktdaten und Rechtstexte freigegeben.
- [ ] Es gibt keine offenen P0-/P1-Fehler.
- [ ] Die technischen Voraussetzungen und Backups aus `docs/go-live-runbook.md` sind erfüllt.

**Abnahmeergebnis:** [ ] Bestanden  [ ] Mit offenen Punkten  [ ] Nicht bestanden  
**Freigegeben für weitere Vorbereitung:** [ ] Ja  [ ] Nein  
**Prüfer / Datum / Unterschrift:** ________________________________

**Wichtig:** Auch ein „Bestanden“ dieses Formulars löst **keinen Go-live** aus. Eine gesonderte ausdrückliche Produktivfreigabe ist zwingend erforderlich.
