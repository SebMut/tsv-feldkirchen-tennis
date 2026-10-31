# BTV nMM – Kaderimport einschließlich Jugend

**31.10.2026.** Der Vereinsverantwortliche bestätigt, dass die notwendigen
Einwilligungen der Eltern für die Jugendspieler vorliegen. Diese Freigabe ist
eine Grundlage zur internen Verwendung. Sie bedeutet nicht, dass jede Person
ohne separate Prüfung auf einer öffentlich erreichbaren Mannschaftsseite
ausgegeben werden darf.

## Offizielle Datenquelle

Laut BTV-FAQ liegt die „Namentliche Mannschaftsmeldung (pdf)“ im geschützten
Bereich **Vereinsprozesse → Downloads → Download-Übersicht**. Die nMM enthält
die Altersklassenlisten des Vereins, einschließlich Jugend- und
Erwachsenenmannschaften. Innerhalb einer Altersklasse kann dieselbe Liste
mehrere Mannschaften (I, II, III) abdecken.

Verifizierte TSV-Vereinsnummer: **01012**. Sommer-Daten: **2026**.
Die Wintersaison 2026/27 hat bisher nur Herren, Herren II und Herren 50.

## Mannschaftszuordnung für Sommer 2026

Erwachsene: Herren I/II/III, Herren 40 I/II, Herren 50 I/II,
Damen, Damen 30/40/50 = 11 Mannschaften.

Jugend:
- Junioren 18 I/II = 2 Mannschaften.
- Knaben 15 I/II = 2 Mannschaften.
- Mädchen 15 = 1 Mannschaft.
- Bambini 12 I/II/III = 3 Mannschaften.
- Kleinfeld U9 = 1 Mannschaft.

Insgesamt **9 Jugend- und 11 Erwachsenenteams**.

Diese Altersklassen- und Teamzuordnung ist in
`scripts/btv-roster-age-classes.mjs` implementiert und getestet.
Es handelt sich um **spielberechtigte Kader**, nicht um die tatsächliche
Aufstellung für einen Spieltag.

## Geschützter Einmal-PDF-Prüfschritt

`.github/workflows/btv-roster-pdf-audit.yml`:

- Nur der freigegebene GitHub-Standardbranch darf
  `BTV_LOGIN_USERNAME` und `BTV_LOGIN_PASSWORD` verwenden.
- Identifiziert TSV Feldkirchen (01012), Sommer 2026 und die passende nMM.
- Lädt **eine** autorisierte PDF in einen nur temporären Runnerpfad.
- Prüft PDF-Kennung, Größe, Seitenzahl und Altersklassenüberschriften.
- Meldet nur feste Codes und **Anzahlen** erkannter Altersklassen.
- Keine Namen, Geburtsdaten, LK, Kontaktdaten, Seiteninhalte, PDFs oder
  authentifizierte URLs im GitHub-Repository, in Logs oder Artifacts.
- Kein Login-Retry, keine CAPTCHA/MFA-Umgehung, kein automatischer Folgejob.

Falls die PDF einen anderen Aufbau verwendet, bleibt der Import gesperrt.
In diesem Fall wird zuerst der Parser an der tatsächlich bestätigten
Dateistruktur getestet, ohne die privaten Rohdaten offenzulegen.

## Späterer Import nach Supabase

Ziel: ausschließlich Projekt `eaurnufdochjapfzqwvm`.

- Zuerst eindeutige nMM-Vereins-, Altersklassen- und Saisonzuordnung.
- Nur vollständige Spielernamen und zwingend nötige Kaderzuordnungen.
- Keine Geburtsdaten, Kontaktdaten, Fotos, Geburtsjahrgänge oder LK in
  das TSV-System übernehmen.
- Duplikate und Namensgleichheiten sorgfältig prüfen. Spieler eines
  Altersklassenkaders können in mehreren zugeordneten TSV-Mannschaften
  spielberechtigt sein.
- Zuordnungen zunächst immer mit `public_visible=false` anlegen.
  Bestehende ausdrückliche Sichtbarkeitsentscheidungen nicht überschreiben.
- Nur intern berechtigte Mannschaftsverantwortliche sehen private Kader.
- Vor tatsächlichen Einträgen eine Zuordnungsprüfung und Testlauf,
  danach Abgleich der Datensatzanzahl und RLS-Berechtigungen.

**Stand:** Der PDF-Parser wird zunächst nur auf Struktur und Jugendklassen
geprüft. Ein erfolgreicher Login oder diese Mapping-Datei ist noch kein
nachweisbar abgeschlossener Spielerimport.
