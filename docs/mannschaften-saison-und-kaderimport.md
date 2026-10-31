# Mannschaften: Sommer/Winter und sicherer Namensimport

## Frontend (Entwicklungsbranch)
Die öffentliche Übersicht `/mannschaften/` bietet drei direkt sichtbare Saison-Kacheln:
- **Saison 2026**: bereits gemeldete 20 Sommermannschaften
- **Winter 2026/2027**: getrennte Saison; die Wintermannschaften sind laut BTV-Vereinsseite bereits öffentlich einsehbar, aber noch **0 Mannschaften in Supabase dieser Saison zugeordnet**
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
