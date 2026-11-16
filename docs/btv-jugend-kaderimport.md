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

Verifizierte TSV-Vereinsnummer: **01012**.
Die Wintersaison 2026/27 hat nur Herren, Herren II (am 24.10.2026
zurückgezogen) und Herren 50.

## Mannschaftszuordnung im Sommer

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
`scripts/btv-roster-age-classes.mjs` implementiert und getestet. Namen werden
nur den Mannschaften zugeordnet, die für die jeweilige Saison in der Datenbank
gemeldet sind.
Es handelt sich um **spielberechtigte Kader**, nicht um die tatsächliche
Aufstellung für einen Spieltag.

## Import

Der wöchentliche, geschützte Import ab Sommer 2027 ist in
`docs/btv-roster-private-import.md` beschrieben.
