# Mannschaften: Sommer/Winter und sicherer Namensimport

## Frontend (Entwicklungsbranch)
Die öffentliche Übersicht `/mannschaften/` bietet drei direkt sichtbare Saison-Kacheln:
- **Saison 2026**: bereits gemeldete 20 Sommermannschaften
- **Winter 2026/2027**: getrennte Saison; die Wintermannschaften wurden inzwischen aus dem offiziellen BTV-Mannschafts-Widget ausgelesen; **3 Mannschaften sind dieser Saison in Supabase zugeordnet**
- **Sommer 2027**: getrennte Saison, Spielplan noch nicht veröffentlicht

Saisons sind unter `seasons.code` eindeutig hinterlegt (`sommer-2026`, `winter-2026-2027`, `sommer-2027`); `year` ist aus Kompatibilitätsgründen erhalten, für die Winterrunde aktuell das Endjahr 2027. Die Saisons 2026 und 2027 dürfen nie ausschließlich per `year` gematcht werden. Zusätzliche Felder: `season_type`, `end_year`, `display_order`, `is_published`.

Die Mannschaftskarten, Kategoriechips und die Mannschaftsdetailseite respektieren die aktuelle Saison (`?season=<code>`). Ein nicht eingetragenes Winterteam wird **nicht** durch Sommerdaten ersetzt. Sobald verifizierte `team_seasons` mit `is_published=true` angelegt werden, erscheinen die Teams automatisch.

## BTV-Herkunft
Vereinsseite: https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html
Vereinsnummer: **01012**.

Die eingebettete Mannschaftsliste wird dynamisch nachgeladen (BTV-ZK-Widget). Der öffentliche Webseitentext enthält vorwiegend Mannschaftsführer, **keine vollständigen namentlichen Mannschaftsmeldungen**. Offizielle Winter-2026/27-nMM im Status endgültig und Exportvariante „gesamt“ werden laut BTV im **internen** Vereinsportal unter Downloads angeboten. **Keine Umgehung des Logins oder Erraten von nuLiga-IDs.**

## nuTab – technische Einordnung
Referenz: https://github.com/harald-herberth/nutab

nuTab stellt nuLiga-Tabelle, Staffel- und Vereinsspielplan auch für Tennis dar. Das Projekt setzt auf eigene PHP-Abrufdienste, JavaScript und teils alte jQuery-Komponenten. Die bestehende Astro-/GitHub-Pages-Seite ist statisch und besitzt bereits einen verifizierten, serverseitigen BTV-Importer. Daher wurde **keine unlizenzierte Drittanbieter-Codekopie und kein externes PHP-Proxy eingebaut**; nuTab kann als fachliche Referenz für Datenfelder und Spielplananzeige dienen. Für Kadernamen bietet nuTab keine belegte Vollimportfunktion.

## Geschützter Kader-Sammelimport
1. Mit einem berechtigten Vereinsaccount in `/admin/` anmelden.
2. „Kader“ öffnen, **Mannschaft und Saison** auswählen.
3. Den Bereich „Namentliche Mannschaftsmeldung gesammelt übernehmen“ öffnen.
4. Aus der verifizierten BTV-nMM **nur Anzeigenamen** in das lokale Eingabefeld einfügen, **ein Name pro Zeile**. Keine Geburtsdaten, LK, Kontaktdaten, Ranglistenplätze. Das Formular speichert die Quellliste nicht in GitHub.
5. „Namen prüfen“ drücken, Anzahl und Vorschau abgleichen, Berechtigung bestätigen und erst anschließend importieren.

Die Datenbankfunktion `public.import_team_player_name(uuid,text)` prüft die Team-Editierberechtigung und erzeugt neue `players` + `team_players` **in einer Transaktion pro Name**. Gleiche Namen innerhalb der gewählten Mannschaft/Saison werden nicht erneut angelegt. Sie setzt **`public_visible=false`** und kopiert **keine Fotos oder Kontaktdaten**. RLS-Rechte gelten, das RPC ist für anonyme Nutzer gesperrt. Bereits manuell gepflegte Zuordnungen bleiben unverändert.

### Grenzen und nächste Schritte
- Ohne die offizielle nMM (berechtigter Vereinszugriff) können noch **keine vollständigen Winter- oder Sommerkader** importiert werden; der Import ist vorbereitet, **nicht erfolgt**.
- Homonyme Personen werden nicht saisonübergreifend automatisch zusammengeführt, weil ohne stabile öffentliche Spieler-ID keine eindeutige Identifikation möglich ist.
- Öffentliche Anzeige, insbesondere von Kindern und Jugendlichen, erst nach gesonderter Prüfung und Freigabe im geschützten Vereinsbereich.
- Die bestehende GitHub-Actions-BTV-Sechsstundenprüfung auf `main` bleibt bis auf eine separate Freigabe unverändert und prüft ausschließlich Sommer 2026.
- Sommer 2027 wird gemäß Auftrag erst ab Ende Februar 2027 auf eine offizielle Veröffentlichung geprüft.
- Kein Merge nach `main`, keine Produktionsveröffentlichung.

## Nachprüfung 31.10.2026 – BTV Winter bereits sichtbar

Die Nutzeransicht der offiziellen [BTV-Vereinsseite](https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften) zeigt bereits Winterdaten für 2026/27. Der bisherige Hinweis, die BTV-Wintermannschaften seien nicht veröffentlicht, ist falsch und wurde im Frontend korrigiert. Im lokalen Import-Datensatz fehlen jedoch noch die **verifizierten Namen bzw. Vereins-Saison-IDs der Wintermannschaften**. Die offizielle BTV-Mannschaftsliste ist als dynamisch geladenes ZK-Widget eingebunden. Direkte serverseitige Testabrufe des öffentlichen Widgets ergaben nur die leere Standardansicht (kein verlässlicher Beleg für eine tatsächlich leere Winterrunde). Ohne vollständige Daten nicht aus Sommerteams raten und keine falschen Winterzuordnungen eintragen. Die Winter-Kachel verlinkt solange die offizielle BTV-Mannschaftsübersicht. Eine saisongetrennte Match-/Kaderübernahme ist weiterhin offen.


## Verifizierter Import der Wintermannschaften 2026/27 (31.10.2026)

Die offizielle BTV-Webseite enthält nach Wahl der Mannschaftsrubrik und Zustimmung zu notwendigen Cookies ein dynamisches ZK-Widget für Vereinsnummer `01012`. Der technische Prüflauf las folgende **drei** Teamzeilen:

| BTV-Kategorie | Liga / Gruppe | TSV Mannschaft |
|---|---|---|
| H00 | Herren Südliga 2 Gr. 018 | Herren (erste H00-Zeile) |
| H00 | Herren Südliga 2 Gr. 020 | Herren II (zweite H00-Zeile) |
| H50 | Herren 50 Südliga 1 Gr. 166 | Herren 50 |

Die Zuordnung der beiden H00-Gruppen zu Herren / Herren II beruht auf ihrer Reihenfolge im offiziellen Widget; bei widersprechender BTV-Mannschaftsdetailansicht ist diese Gruppenzuordnung gezielt zu korrigieren.

Migrationsdatei: `supabase/migrations/20261031210000_official_winter_2026_27_teams.sql`. Sie wurde im erlaubten Supabase-Projekt angewandt. Sie legt **nur** die drei `team_seasons` an, ohne vorhandene Spieltage, Kader, Ergebnisse oder Sommermeldungen zu verändern. Die `btv_url` verweist auf die permanente offizielle Vereinsübersicht, nicht auf eine nicht verifizierte Einzelmannschafts-URL.

Kontrollierte Daten nach Import: Sommer 2026: 20; Winter 2026/27: 3; Sommer 2027: 0. **15 Winterspiele wurden mittlerweile aus den drei offiziell verifizierten Gruppen importiert.** Namentliche Kader sind nicht importiert, da die öffentlich zugänglichen Porträts keine vollständig prüfbare Mannschaftsmeldung liefern. Der bestehende Standardbranch-Cronjob prüft weiterhin nur Sommer 2026.

Öffentliche Quelle: https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften


## Winter-Spieltermine und automatischer Terminabgleich (31.10.2026)

Die drei offiziellen, **öffentlichen** BTV-Gruppen-PDFs sind nach Vereinsnummer, Saison, Liganame, Gruppe und Vollständigkeit geprüft:
- Herren: [Gruppe 018, ID 2257673](https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2257673)
- Herren II: [Gruppe 020, ID 2257681](https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2257681)
- Herren 50: [Gruppe 166, ID 2257828](https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=2257828)

Jede Liga enthält 15 Begegnungen, darunter genau fünf TSV-Spiele. **15/15 TSV-Winterspiele** wurden über die Migration `20261031220000_winter_2026_27_matches.sql` idempotent in Supabase gespeichert. BTV-Links direkt pro Mannschaft wurden über `20261031231000_winter_team_group_links.sql` aktualisiert. Der Spielstand der bereits vergangenen Begegnungen ist ausschließlich als BTV-Quellentext gespeichert; Liveticker-Endstände werden nicht erfunden.

Die Datenbank-Migration `20261031230000_btv_season_scoping.sql` trennt die privaten BTV-Snapshots, Prüfläufe und Verlegungsprotokolle über `season_code` in **sommer-2026**, **winter-2026-2027** und künftig **sommer-2027**. Der bestehende, getestete Verlegungs-Trigger schützt manuelle Änderungen und Liveticker, archiviert nur frühere *automatische* Verlegungs-News und veröffentlicht beim ersten Snapshot keine News.

Die Erweiterung des 6-Stunden-GitHub-Cronjobs wurde read-only erfolgreich getestet:
- Sommer 2026: 120 Spiele / 20 Teams
- Winter 2026/27: 15 Spiele / 3 Teams

**Wichtig:** Der Pull Request [#3](https://github.com/SebMut/tsv-feldkirchen-tennis/pull/3) enthält ausschließlich drei BTV-Dateien und ist **noch nicht** nach `main` gemergt. Die automatische Winter-Prüfung startet erst nach dieser getrennten Freigabe. Kein Homepage-Go-live.

## Winter-Spielerkader

Die drei verifizierten Mannschaftsporträts:
- Herren: https://www.btv.de/de/spielbetrieb/teamportrait.html?teamid=3728614
- Herren II: https://www.btv.de/de/spielbetrieb/teamportrait.html?teamid=3727556
- Herren 50: https://www.btv.de/de/spielbetrieb/teamportrait.html?teamid=3727895

Der technisch zugängliche öffentliche BTV-Widget-Inhalt lieferte bislang keine überprüfbare **vollständige namentliche Mannschaftsmeldung**. Deshalb wurden keine zusätzlichen Namen erfunden oder importiert. Der vorhandene berechtigungsgeschützte Kader-Sammelimport in `Mein TSV → Kader` erlaubt den Import aus einem offiziellen BTV-Export pro Mannschaft/Saison; neue Namen bleiben zunächst intern (`public_visible=false`). Die vollständige Vereinsmeldung ist hierfür noch bereitzustellen oder die öffentliche vollständige Quelle zu verifizieren.


## Tatsächliche Hallenstandorte statt pauschaler TSV-Heimadresse (31.10.2026)

Die Datenbankmigration `supabase/migrations/20261031233000_winter_match_halls.sql` hinterlegt für **alle 15 Winter-Begegnungen** den Spielort aus der jeweiligen offiziellen BTV-Gruppen-PDF; für 12 Termine konnte eine konkrete Zieladresse anhand der jeweiligen Vereins- oder Hallen-Website geprüft werden. Drei BTV-Hallenangaben besitzen noch keine zweifelsfreie Straßenadresse (Tennishalle Riemerling [BTV kürzt den Namen ab], TS Jahn München und BC Attaching) und werden bewusst nur als Orts-/Namenssuche in Google Maps geöffnet; vor der Anfahrt ist dort das Ziel zu prüfen.

Wichtig: `matches.is_home` bleibt **unabhängig** von `matches.venue_name` und `matches.venue_address`. Der TSV besitzt keine eigene Tennishalle in Feldkirchen, daher finden Winter-**Heimspiele** in externen Hallen statt, zum Beispiel TSV Haar und Sporttraum Kirchheim. Die tatsächliche Halle darf niemals aus dem Heimrecht abgeleitet werden.

Die Spielort- und Routenanzeige ist auf Teamübersicht, Mannschaftsdetail, Spielansicht, Kalender, Startseite und Liveticker umgesetzt. Ist keine verifizierte Halle eingetragen, erscheint „Spielort noch nicht bekannt“ **ohne** irreführenden Routenbutton. Google Maps öffnet eine Routenplanung mit der konkreten Zieladresse, falls vorhanden, andernfalls eine Namenssuche (mit Prüfhinweis). Der Ausgangspunkt bleibt dem besuchenden Endgerät überlassen.

Im Bereich `Mein TSV → Spiele & Liveticker` kann ein berechtigter Verantwortlicher den tatsächlichen Spielort und dessen Straße/Ort pro Spiel korrigieren, ohne dabei Heim/Auswärts, Liveticker oder Ergebnisse zu verändern. Auch beim manuellen Anlegen neuer Spiele sind Halle und Anschrift eigene Felder.

**Sommer 2026:** Bereits gepflegte Spielorte bleiben unverändert. Wo bislang keine zuverlässige Adresse vorliegt, wird kein Feldkirchen-Standort vorgetäuscht. Vor der Veröffentlichung neuer Saisonspiele sollten die Hallen-/Anlagennamen weiterhin mit dem BTV abgeglichen werden.
