-- Generated from migration/wordpress-export/events.json.
-- 124 point matches become structured matches; 3 club events remain events.

update public.events set slug='schnuppertag'
where slug='schnuppertag-2026'
  and not exists (select 1 from public.events where slug='schnuppertag');

update public.news set slug='schnuppertag'
where slug='schnuppertag-2026'
  and not exists (select 1 from public.news where slug='schnuppertag');

with imported(team_name,slug,match_type,opponent,is_home,starts_at,ends_at,venue_name,venue_address,external_url,notes) as (
values
(
  'Knaben 15','knaben-15-auswaertsspiel-gegen-sc-eching','league','SC Eching',false,
  '2026-05-01 07:00:00+00'::timestamptz,'2026-05-01 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-auswaertsspiel-gegen-sc-eching/','Mannschaft: Knaben 15 – Begegnung: Auswärts gegen SC Eching'
),
(
  'Junioren 18','junioren-18-heimspiel-gegen-mttc-iphitos-muenchen','league','MTTC Iphitos München',true,
  '2026-05-02 07:00:00+00'::timestamptz,'2026-05-02 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-heimspiel-gegen-mttc-iphitos-muenchen/','Mannschaft: Junioren 18 – Begegnung: Heim gegen MTTC Iphitos München'
),
(
  'Knaben 15 II','knaben-15-ii-auswaertsspiel-gegen-ts-jahn-muenchen-ii','league','TS Jahn München II',false,
  '2026-05-02 07:00:00+00'::timestamptz,'2026-05-02 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-ii-auswaertsspiel-gegen-ts-jahn-muenchen-ii/','Mannschaft: Knaben 15 II – Begegnung: Auswärts gegen TS Jahn München II'
),
(
  'Herren 40 II','herren-40-ii-heimspiel-gegen-wb-fideliopark-muenchen-ii','league','WB Fideliopark München II',true,
  '2026-05-02 10:00:00+00'::timestamptz,'2026-05-02 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-ii-heimspiel-gegen-wb-fideliopark-muenchen-ii/','Mannschaft: Herren 40 II – Begegnung: Heim gegen WB Fideliopark München II'
),
(
  'Herren 50 II','herren-50-ii-heimspiel-gegen-tc-hoehenkirchen','league','TC Höhenkirchen',true,
  '2026-05-02 12:00:00+00'::timestamptz,'2026-05-02 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-ii-heimspiel-gegen-tc-hoehenkirchen/','Mannschaft: Herren 50 II – Begegnung: Heim gegen TC Höhenkirchen'
),
(
  'Damen 50','damen-50-auswaertsspiel-gegen-wb-fideliopark-muenchen','league','WB Fideliopark München',false,
  '2026-05-02 12:00:00+00'::timestamptz,'2026-05-02 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-50-auswaertsspiel-gegen-wb-fideliopark-muenchen/','Mannschaft: Damen 50 – Begegnung: Auswärts gegen WB Fideliopark München'
),
(
  'Mädchen 15','maedchen-15-auswaertsspiel-gegen-sc-baldham-vaterstetten','league','SC Baldham-Vaterstetten',false,
  '2026-05-08 13:00:00+00'::timestamptz,'2026-05-08 19:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/maedchen-15-auswaertsspiel-gegen-sc-baldham-vaterstetten/','Mannschaft: Mädchen 15 – Begegnung: Auswärts gegen SC Baldham-Vaterstetten'
),
(
  'Junioren 18','junioren-18-auswaertsspiel-gegen-tc-aschheim','league','TC Aschheim',false,
  '2026-05-09 07:00:00+00'::timestamptz,'2026-05-09 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-auswaertsspiel-gegen-tc-aschheim/','Mannschaft: Junioren 18 – Begegnung: Auswärts gegen TC Aschheim'
),
(
  'Junioren 18 II','junioren-18-ii-heimspiel-gegen-fc-forstern','league','FC Forstern',true,
  '2026-05-09 07:00:00+00'::timestamptz,'2026-05-09 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-ii-heimspiel-gegen-fc-forstern/','Mannschaft: Junioren 18 II – Begegnung: Heim gegen FC Forstern'
),
(
  'Bambini 12','bambini-12-heimspiel-gegen-polizei-sv-haar','league','Polizei SV Haar',true,
  '2026-05-09 07:00:00+00'::timestamptz,'2026-05-09 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-heimspiel-gegen-polizei-sv-haar/','Mannschaft: Bambini 12 – Begegnung: Heim gegen Polizei SV Haar'
),
(
  'Bambini 12 II','bambini-12-ii-auswaertsspiel-gegen-ts-jahn-muenchen-ii','league','TS Jahn München II',false,
  '2026-05-09 07:00:00+00'::timestamptz,'2026-05-09 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-ii-auswaertsspiel-gegen-ts-jahn-muenchen-ii/','Mannschaft: Bambini 12 II – Begegnung: Auswärts gegen TS Jahn München II'
),
(
  'Bambini 12 III','bambini-12-iii-auswaertsspiel-gegen-tf-markt-schwaben-ii','league','TF Markt Schwaben II',false,
  '2026-05-09 07:00:00+00'::timestamptz,'2026-05-09 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-iii-auswaertsspiel-gegen-tf-markt-schwaben-ii/','Mannschaft: Bambini 12 III – Begegnung: Auswärts gegen TF Markt Schwaben II'
),
(
  'Herren 40','herren-40-heimspiel-gegen-mttc-iphitos-muenchen-ii','league','MTTC Iphitos München II',true,
  '2026-05-09 12:00:00+00'::timestamptz,'2026-05-09 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-heimspiel-gegen-mttc-iphitos-muenchen-ii/','Mannschaft: Herren 40 – Begegnung: Heim gegen MTTC Iphitos München II'
),
(
  'Herren 50','herren-50-auswaertsspiel-gegen-tsv-eintracht-karlsfeld-ii','league','TSV Eintracht Karlsfeld II',false,
  '2026-05-09 12:00:00+00'::timestamptz,'2026-05-09 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-auswaertsspiel-gegen-tsv-eintracht-karlsfeld-ii/','Mannschaft: Herren 50 – Begegnung: Auswärts gegen TSV Eintracht Karlsfeld II'
),
(
  'Damen 30','damen-30-auswaertsspiel-gegen-tc-gruen-weiss-dingolfing','league','TC Grün-Weiß Dingolfing',false,
  '2026-05-09 12:00:00+00'::timestamptz,'2026-05-09 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-30-auswaertsspiel-gegen-tc-gruen-weiss-dingolfing/','Mannschaft: Damen 30 – Begegnung: Auswärts gegen TC Grün-Weiß Dingolfing'
),
(
  'Damen 40','damen-40-heimspiel-gegen-tc-schrobenhausen','league','TC Schrobenhausen',true,
  '2026-05-09 12:00:00+00'::timestamptz,'2026-05-09 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-40-heimspiel-gegen-tc-schrobenhausen/','Mannschaft: Damen 40 – Begegnung: Heim gegen TC Schrobenhausen'
),
(
  'Damen 50','damen-50-heimspiel-gegen-asv-dachau','league','ASV Dachau',true,
  '2026-05-09 12:00:00+00'::timestamptz,'2026-05-09 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-50-heimspiel-gegen-asv-dachau/','Mannschaft: Damen 50 – Begegnung: Heim gegen ASV Dachau'
),
(
  'Herren II','herren-ii-heimspiel-gegen-tc-pliening','league','TC Pliening',true,
  '2026-05-10 07:00:00+00'::timestamptz,'2026-05-10 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-ii-heimspiel-gegen-tc-pliening/','Mannschaft: Herren II – Begegnung: Heim gegen TC Pliening'
),
(
  'Herren III','herren-iii-heimspiel-gegen-sc-freimann-iii','league','SC Freimann III',true,
  '2026-05-10 07:00:00+00'::timestamptz,'2026-05-10 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-iii-heimspiel-gegen-sc-freimann-iii/','Mannschaft: Herren III – Begegnung: Heim gegen SC Freimann III'
),
(
  'Damen','damen-auswaertsspiel-gegen-sv-hoerlkofen-ii','league','SV Hörlkofen II',false,
  '2026-05-10 07:00:00+00'::timestamptz,'2026-05-10 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-auswaertsspiel-gegen-sv-hoerlkofen-ii/','Mannschaft: Damen – Begegnung: Auswärts gegen SV Hörlkofen II'
),
(
  'Herren','herren-auswaertsspiel-gegen-teg-muehldorf','league','TeG Mühldorf',false,
  '2026-05-10 08:00:00+00'::timestamptz,'2026-05-10 14:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-auswaertsspiel-gegen-teg-muehldorf/','Mannschaft: Herren – Begegnung: Auswärts gegen TeG Mühldorf'
),
(
  'Herren 50','herren-50-auswaertsspiel-gegen-tc-olching-ii','league','TC Olching II',false,
  '2026-05-14 12:00:00+00'::timestamptz,'2026-05-14 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-auswaertsspiel-gegen-tc-olching-ii/','Mannschaft: Herren 50 – Begegnung: Auswärts gegen TC Olching II'
),
(
  'Mädchen 15','maedchen-15-heimspiel-gegen-tc-topspin','league','TC Topspin',true,
  '2026-05-15 13:00:00+00'::timestamptz,'2026-05-15 19:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/maedchen-15-heimspiel-gegen-tc-topspin/','Mannschaft: Mädchen 15 – Begegnung: Heim gegen TC Topspin'
),
(
  'Knaben 15 II','knaben-15-ii-auswaertsspiel-gegen-tc-cosima-muenchen-ii','league','TC Cosima München II',false,
  '2026-05-15 13:00:00+00'::timestamptz,'2026-05-15 19:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-ii-auswaertsspiel-gegen-tc-cosima-muenchen-ii/','Mannschaft: Knaben 15 II – Begegnung: Auswärts gegen TC Cosima München II'
),
(
  'Kleinfeld U9','u9-auswaertsspiel-gegen-sv-heimstetten-ii','league','SV Heimstetten II',false,
  '2026-05-15 13:00:00+00'::timestamptz,'2026-05-15 19:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/u9-auswaertsspiel-gegen-sv-heimstetten-ii/','Mannschaft: U9 – Begegnung: Auswärts gegen SV Heimstetten II'
),
(
  'Herren 50 II','herren-50-ii-auswaertsspiel-gegen-etc-siegertsbrunn-ii','league','ETC Siegertsbrunn II',false,
  '2026-05-16 07:00:00+00'::timestamptz,'2026-05-16 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-ii-auswaertsspiel-gegen-etc-siegertsbrunn-ii/','Mannschaft: Herren 50 II – Begegnung: Auswärts gegen ETC Siegertsbrunn II'
),
(
  'Bambini 12 II','bambini-12-ii-heimspiel-gegen-weissblau-allianz-muenchen','league','Weißblau Allianz München',true,
  '2026-05-16 07:00:00+00'::timestamptz,'2026-05-16 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-ii-heimspiel-gegen-weissblau-allianz-muenchen/','Mannschaft: Bambini 12 II – Begegnung: Heim gegen Weißblau Allianz München'
),
(
  'Bambini 12 III','bambini-12-iii-heimspiel-gegen-tc-st-emmeram-muenchen','league','TC St.Emmeram München',true,
  '2026-05-16 07:00:00+00'::timestamptz,'2026-05-16 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-iii-heimspiel-gegen-tc-st-emmeram-muenchen/','Mannschaft: Bambini 12 III – Begegnung: Heim gegen TC St.Emmeram München'
),
(
  'Herren 40','herren-40-heimspiel-gegen-tc-rimsting','league','TC Rimsting',true,
  '2026-05-16 12:00:00+00'::timestamptz,'2026-05-16 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-heimspiel-gegen-tc-rimsting/','Mannschaft: Herren 40 – Begegnung: Heim gegen TC Rimsting'
),
(
  'Herren 40 II','herren-40-ii-auswaertsspiel-gegen-tsv-haar-ii','league','TSV Haar II',false,
  '2026-05-16 12:00:00+00'::timestamptz,'2026-05-16 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-ii-auswaertsspiel-gegen-tsv-haar-ii/','Mannschaft: Herren 40 II – Begegnung: Auswärts gegen TSV Haar II'
),
(
  'Herren 50','herren-50-heimspiel-gegen-1-sc-groebenzell-ii','league','1. SC Gröbenzell II',true,
  '2026-05-16 12:00:00+00'::timestamptz,'2026-05-16 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-heimspiel-gegen-1-sc-groebenzell-ii/','Mannschaft: Herren 50 – Begegnung: Heim gegen 1. SC Gröbenzell II'
),
(
  'Damen 40','damen-40-auswaertsspiel-gegen-tc-raschke-taufkirchen','league','TC Raschke Taufkirchen',false,
  '2026-05-16 12:00:00+00'::timestamptz,'2026-05-16 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-40-auswaertsspiel-gegen-tc-raschke-taufkirchen/','Mannschaft: Damen 40 – Begegnung: Auswärts gegen TC Raschke Taufkirchen'
),
(
  'Damen 50','damen-50-auswaertsspiel-gegen-tc-ismaning','league','TC Ismaning',false,
  '2026-05-16 12:00:00+00'::timestamptz,'2026-05-16 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-50-auswaertsspiel-gegen-tc-ismaning/','Mannschaft: Damen 50 – Begegnung: Auswärts gegen TC Ismaning'
),
(
  'Herren II','herren-ii-heimspiel-gegen-tc-finsing','league','TC Finsing',true,
  '2026-05-17 07:00:00+00'::timestamptz,'2026-05-17 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-ii-heimspiel-gegen-tc-finsing/','Mannschaft: Herren II – Begegnung: Heim gegen TC Finsing'
),
(
  'Damen','damen-auswaertsspiel-gegen-sv-stadtwerke-muenchen','league','SV Stadtwerke München',false,
  '2026-05-17 07:00:00+00'::timestamptz,'2026-05-17 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-auswaertsspiel-gegen-sv-stadtwerke-muenchen/','Mannschaft: Damen – Begegnung: Auswärts gegen SV Stadtwerke München'
),
(
  'Herren','herren-heimspiel-gegen-tc-uebersee','league','TC Übersee',true,
  '2026-05-17 08:00:00+00'::timestamptz,'2026-05-17 14:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-heimspiel-gegen-tc-uebersee/','Mannschaft: Herren – Begegnung: Heim gegen TC Übersee'
),
(
  'Mädchen 15','maedchen-15-heimspiel-gegen-tc-neukeferloh','league','TC Neukeferloh',true,
  '2026-06-12 13:00:00+00'::timestamptz,'2026-06-12 19:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/maedchen-15-heimspiel-gegen-tc-neukeferloh/','Mannschaft: Mädchen 15 – Begegnung: Heim gegen TC Neukeferloh'
),
(
  'Knaben 15','knaben-15-auswaertsspiel-gegen-tc-rot-weiss-freising','league','TC Rot-Weiß Freising',false,
  '2026-06-12 13:00:00+00'::timestamptz,'2026-06-12 19:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-auswaertsspiel-gegen-tc-rot-weiss-freising/','Mannschaft: Knaben 15 – Begegnung: Auswärts gegen TC Rot-Weiß Freising'
),
(
  'Knaben 15 II','knaben-15-ii-heimspiel-gegen-tc-rot-weiss-poing','league','TC Rot-Weiß Poing',true,
  '2026-06-12 13:00:00+00'::timestamptz,'2026-06-12 19:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-ii-heimspiel-gegen-tc-rot-weiss-poing/','Mannschaft: Knaben 15 II – Begegnung: Heim gegen TC Rot-Weiß Poing'
),
(
  'Kleinfeld U9','u9-auswaertsspiel-gegen-tc-putzbrunn','league','TC Putzbrunn',false,
  '2026-06-12 13:00:00+00'::timestamptz,'2026-06-12 19:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/u9-auswaertsspiel-gegen-tc-putzbrunn/','Mannschaft: U9 – Begegnung: Auswärts gegen TC Putzbrunn'
),
(
  'Herren 50','herren-50-heimspiel-gegen-tc-blutenburg-muenchen-ii','league','TC Blutenburg München II',true,
  '2026-06-13 07:00:00+00'::timestamptz,'2026-06-13 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-heimspiel-gegen-tc-blutenburg-muenchen-ii/','Mannschaft: Herren 50 – Begegnung: Heim gegen TC Blutenburg München II'
),
(
  'Damen 30','damen-30-auswaertsspiel-gegen-weissblau-allianz-muenchen-ii','league','Weißblau Allianz München II',false,
  '2026-06-13 07:00:00+00'::timestamptz,'2026-06-13 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-30-auswaertsspiel-gegen-weissblau-allianz-muenchen-ii/','Mannschaft: Damen 30 – Begegnung: Auswärts gegen Weißblau Allianz München II'
),
(
  'Junioren 18','junioren-18-heimspiel-gegen-tc-raschke-taufkirchen-ii','league','TC Raschke Taufkirchen II',true,
  '2026-06-13 07:00:00+00'::timestamptz,'2026-06-13 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-heimspiel-gegen-tc-raschke-taufkirchen-ii/','Mannschaft: Junioren 18 – Begegnung: Heim gegen TC Raschke Taufkirchen II'
),
(
  'Junioren 18 II','junioren-18-ii-auswaertsspiel-gegen-tsv-haar-ii','league','TSV Haar II',false,
  '2026-06-13 07:00:00+00'::timestamptz,'2026-06-13 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-ii-auswaertsspiel-gegen-tsv-haar-ii/','Mannschaft: Junioren 18 II – Begegnung: Auswärts gegen TSV Haar II'
),
(
  'Bambini 12','bambini-12-auswaertsspiel-gegen-tsv-haar-ii','league','TSV Haar II',false,
  '2026-06-13 07:00:00+00'::timestamptz,'2026-06-13 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-auswaertsspiel-gegen-tsv-haar-ii/','Mannschaft: Bambini 12 – Begegnung: Auswärts gegen TSV Haar II'
),
(
  'Bambini 12 II','bambini-12-ii-heimspiel-gegen-svn-muenchen-ii','league','SVN München II',true,
  '2026-06-13 07:00:00+00'::timestamptz,'2026-06-13 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-ii-heimspiel-gegen-svn-muenchen-ii/','Mannschaft: Bambini 12 II – Begegnung: Heim gegen SVN München II'
),
(
  'Bambini 12 III','bambini-12-iii-auswaertsspiel-gegen-tc-rot-weiss-poing','league','TC Rot-Weiß Poing',false,
  '2026-06-13 07:00:00+00'::timestamptz,'2026-06-13 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-iii-auswaertsspiel-gegen-tc-rot-weiss-poing/','Mannschaft: Bambini 12 III – Begegnung: Auswärts gegen TC Rot-Weiß Poing'
),
(
  'Herren 40','herren-40-auswaertsspiel-gegen-tc-malgersdorf','league','TC Malgersdorf',false,
  '2026-06-13 12:00:00+00'::timestamptz,'2026-06-13 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-auswaertsspiel-gegen-tc-malgersdorf/','Mannschaft: Herren 40 – Begegnung: Auswärts gegen TC Malgersdorf'
),
(
  'Herren 40 II','herren-40-ii-heimspiel-gegen-tc-gruen-gold-muenchen-ii','league','TC Grün-Gold München II',true,
  '2026-06-13 12:00:00+00'::timestamptz,'2026-06-13 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-ii-heimspiel-gegen-tc-gruen-gold-muenchen-ii/','Mannschaft: Herren 40 II – Begegnung: Heim gegen TC Grün-Gold München II'
),
(
  'Damen 40','damen-40-heimspiel-gegen-tc-unterfoehring','league','TC Unterföhring',true,
  '2026-06-13 12:00:00+00'::timestamptz,'2026-06-13 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-40-heimspiel-gegen-tc-unterfoehring/','Mannschaft: Damen 40 – Begegnung: Heim gegen TC Unterföhring'
),
(
  'Herren II','herren-ii-auswaertsspiel-gegen-tc-unterfoehring-ii','league','TC Unterföhring II',false,
  '2026-06-14 07:00:00+00'::timestamptz,'2026-06-14 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-ii-auswaertsspiel-gegen-tc-unterfoehring-ii/','Mannschaft: Herren II – Begegnung: Auswärts gegen TC Unterföhring II'
),
(
  'Herren III','herren-iii-auswaertsspiel-gegen-wb-fideliopark-muenchen','league','WB Fideliopark München',false,
  '2026-06-14 07:00:00+00'::timestamptz,'2026-06-14 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-iii-auswaertsspiel-gegen-wb-fideliopark-muenchen/','Mannschaft: Herren III – Begegnung: Auswärts gegen WB Fideliopark München'
),
(
  'Damen','damen-auswaertsspiel-gegen-tc-oberding','league','TC Oberding',false,
  '2026-06-14 07:00:00+00'::timestamptz,'2026-06-14 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-auswaertsspiel-gegen-tc-oberding/','Mannschaft: Damen – Begegnung: Auswärts gegen TC Oberding'
),
(
  'Herren','herren-heimspiel-gegen-gw-luitpoldpark-muenchen-iii','league','GW Luitpoldpark München III',true,
  '2026-06-14 08:00:00+00'::timestamptz,'2026-06-14 14:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-heimspiel-gegen-gw-luitpoldpark-muenchen-iii/','Mannschaft: Herren – Begegnung: Heim gegen GW Luitpoldpark München III'
),
(
  'Knaben 15','knaben-15-heimspiel-gegen-tc-moosburg','league','TC Moosburg',true,
  '2026-06-19 13:00:00+00'::timestamptz,'2026-06-19 19:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-heimspiel-gegen-tc-moosburg/','Mannschaft: Knaben 15 – Begegnung: Heim gegen TC Moosburg'
),
(
  'Kleinfeld U9','u9-heimspiel-gegen-teg-kirchheim','league','TeG Kirchheim',true,
  '2026-06-19 13:00:00+00'::timestamptz,'2026-06-19 19:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/u9-heimspiel-gegen-teg-kirchheim/','Mannschaft: U9 – Begegnung: Heim gegen TeG Kirchheim'
),
(
  'Junioren 18','junioren-18-heimspiel-gegen-muenchner-sportclub','league','Münchner Sportclub',true,
  '2026-06-20 07:00:00+00'::timestamptz,'2026-06-20 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-heimspiel-gegen-muenchner-sportclub/','Mannschaft: Junioren 18 – Begegnung: Heim gegen Münchner Sportclub'
),
(
  'Junioren 18 II','junioren-18-ii-heimspiel-gegen-tc-anzing','league','TC Anzing',true,
  '2026-06-20 07:00:00+00'::timestamptz,'2026-06-20 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-ii-heimspiel-gegen-tc-anzing/','Mannschaft: Junioren 18 II – Begegnung: Heim gegen TC Anzing'
),
(
  'Bambini 12','bambini-12-auswaertsspiel-gegen-tc-zorneding-iii','league','TC Zorneding III',false,
  '2026-06-20 07:00:00+00'::timestamptz,'2026-06-20 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-auswaertsspiel-gegen-tc-zorneding-iii/','Mannschaft: Bambini 12 – Begegnung: Auswärts gegen TC Zorneding III'
),
(
  'Bambini 12 II','bambini-12-ii-heimspiel-gegen-muenchner-sportclub-iii','league','Münchner Sportclub III',true,
  '2026-06-20 07:00:00+00'::timestamptz,'2026-06-20 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-ii-heimspiel-gegen-muenchner-sportclub-iii/','Mannschaft: Bambini 12 II – Begegnung: Heim gegen Münchner Sportclub III'
),
(
  'Bambini 12 III','bambini-12-iii-auswaertsspiel-gegen-ts-jahn-muenchen','league','TS Jahn München',false,
  '2026-06-20 07:00:00+00'::timestamptz,'2026-06-20 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-iii-auswaertsspiel-gegen-ts-jahn-muenchen/','Mannschaft: Bambini 12 III – Begegnung: Auswärts gegen TS Jahn München'
),
(
  'Herren 40','herren-40-heimspiel-gegen-tsv-haar','league','TSV Haar',true,
  '2026-06-20 12:00:00+00'::timestamptz,'2026-06-20 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-heimspiel-gegen-tsv-haar/','Mannschaft: Herren 40 – Begegnung: Heim gegen TSV Haar'
),
(
  'Herren 40 II','herren-40-ii-auswaertsspiel-gegen-tf-markt-schwaben','league','TF Markt Schwaben',false,
  '2026-06-20 12:00:00+00'::timestamptz,'2026-06-20 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-ii-auswaertsspiel-gegen-tf-markt-schwaben/','Mannschaft: Herren 40 II – Begegnung: Auswärts gegen TF Markt Schwaben'
),
(
  'Herren 50','herren-50-heimspiel-gegen-esv-muenchen-sportpark','league','ESV München Sportpark',true,
  '2026-06-20 12:00:00+00'::timestamptz,'2026-06-20 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-heimspiel-gegen-esv-muenchen-sportpark/','Mannschaft: Herren 50 – Begegnung: Heim gegen ESV München Sportpark'
),
(
  'Herren 50 II','herren-50-ii-heimspiel-gegen-tc-riemerling','league','TC Riemerling',true,
  '2026-06-20 12:00:00+00'::timestamptz,'2026-06-20 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-ii-heimspiel-gegen-tc-riemerling/','Mannschaft: Herren 50 II – Begegnung: Heim gegen TC Riemerling'
),
(
  'Damen 40','damen-40-auswaertsspiel-gegen-asv-glonn','league','ASV Glonn',false,
  '2026-06-20 12:00:00+00'::timestamptz,'2026-06-20 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-40-auswaertsspiel-gegen-asv-glonn/','Mannschaft: Damen 40 – Begegnung: Auswärts gegen ASV Glonn'
),
(
  'Damen 50','damen-50-auswaertsspiel-gegen-tsv-eintracht-karlsfeld-iii','league','TSV Eintracht Karlsfeld III',false,
  '2026-06-20 12:00:00+00'::timestamptz,'2026-06-20 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-50-auswaertsspiel-gegen-tsv-eintracht-karlsfeld-iii/','Mannschaft: Damen 50 – Begegnung: Auswärts gegen TSV Eintracht Karlsfeld III'
),
(
  'Herren II','herren-ii-heimspiel-gegen-tc-aschheim-iii','league','TC Aschheim III',true,
  '2026-06-21 07:00:00+00'::timestamptz,'2026-06-21 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-ii-heimspiel-gegen-tc-aschheim-iii/','Mannschaft: Herren II – Begegnung: Heim gegen TC Aschheim III'
),
(
  'Herren III','herren-iii-heimspiel-gegen-muenchner-sportclub-iv','league','Münchner Sportclub IV',true,
  '2026-06-21 07:00:00+00'::timestamptz,'2026-06-21 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-iii-heimspiel-gegen-muenchner-sportclub-iv/','Mannschaft: Herren III – Begegnung: Heim gegen Münchner Sportclub IV'
),
(
  'Herren','herren-auswaertsspiel-gegen-tc-ismaning','league','TC Ismaning',false,
  '2026-06-21 08:00:00+00'::timestamptz,'2026-06-21 14:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-auswaertsspiel-gegen-tc-ismaning/','Mannschaft: Herren – Begegnung: Auswärts gegen TC Ismaning'
),
(
  'Mädchen 15','maedchen-15-auswaertsspiel-gegen-tc-zorneding','league','TC Zorneding',false,
  '2026-06-26 13:00:00+00'::timestamptz,'2026-06-26 19:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/maedchen-15-auswaertsspiel-gegen-tc-zorneding/','Mannschaft: Mädchen 15 – Begegnung: Auswärts gegen TC Zorneding'
),
(
  'Knaben 15','knaben-15-heimspiel-gegen-tc-ismaning-iii','league','TC Ismaning III',true,
  '2026-06-26 13:00:00+00'::timestamptz,'2026-06-26 19:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-heimspiel-gegen-tc-ismaning-iii/','Mannschaft: Knaben 15 – Begegnung: Heim gegen TC Ismaning III'
),
(
  'Knaben 15 II','knaben-15-ii-heimspiel-gegen-sc-freimann-ii','league','SC Freimann II',true,
  '2026-06-26 13:00:00+00'::timestamptz,'2026-06-26 19:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-ii-heimspiel-gegen-sc-freimann-ii/','Mannschaft: Knaben 15 II – Begegnung: Heim gegen SC Freimann II'
),
(
  'Kleinfeld U9','u9-auswaertsspiel-gegen-tc-ismaning','league','TC Ismaning',false,
  '2026-06-26 13:00:00+00'::timestamptz,'2026-06-26 19:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/u9-auswaertsspiel-gegen-tc-ismaning/','Mannschaft: U9 – Begegnung: Auswärts gegen TC Ismaning'
),
(
  'Junioren 18','junioren-18-heimspiel-gegen-tc-schiessgraben-augsburg','league','TC Schießgraben Augsburg',true,
  '2026-06-27 07:00:00+00'::timestamptz,'2026-06-27 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-heimspiel-gegen-tc-schiessgraben-augsburg/','Mannschaft: Junioren 18 – Begegnung: Heim gegen TC Schießgraben Augsburg'
),
(
  'Junioren 18 II','junioren-18-ii-auswaertsspiel-gegen-tc-zorneding','league','TC Zorneding',false,
  '2026-06-27 07:00:00+00'::timestamptz,'2026-06-27 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-ii-auswaertsspiel-gegen-tc-zorneding/','Mannschaft: Junioren 18 II – Begegnung: Auswärts gegen TC Zorneding'
),
(
  'Bambini 12','bambini-12-heimspiel-gegen-teg-kirchheim','league','TeG Kirchheim',true,
  '2026-06-27 07:00:00+00'::timestamptz,'2026-06-27 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-heimspiel-gegen-teg-kirchheim/','Mannschaft: Bambini 12 – Begegnung: Heim gegen TeG Kirchheim'
),
(
  'Bambini 12 II','bambini-12-ii-auswaertsspiel-gegen-sc-freimann-iv','league','SC Freimann IV',false,
  '2026-06-27 07:00:00+00'::timestamptz,'2026-06-27 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-ii-auswaertsspiel-gegen-sc-freimann-iv/','Mannschaft: Bambini 12 II – Begegnung: Auswärts gegen SC Freimann IV'
),
(
  'Bambini 12 III','bambini-12-iii-heimspiel-gegen-teg-kirchheim-ii','league','TeG Kirchheim II',true,
  '2026-06-27 07:00:00+00'::timestamptz,'2026-06-27 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-iii-heimspiel-gegen-teg-kirchheim-ii/','Mannschaft: Bambini 12 III – Begegnung: Heim gegen TeG Kirchheim II'
),
(
  'Herren 40','herren-40-heimspiel-gegen-sv-weichering','league','SV Weichering',true,
  '2026-06-27 12:00:00+00'::timestamptz,'2026-06-27 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-heimspiel-gegen-sv-weichering/','Mannschaft: Herren 40 – Begegnung: Heim gegen SV Weichering'
),
(
  'Herren 50','herren-50-auswaertsspiel-gegen-tc-gruen-weiss-graefelfing-ii','league','TC Grün-Weiß Gräfelfing II',false,
  '2026-06-27 12:00:00+00'::timestamptz,'2026-06-27 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-auswaertsspiel-gegen-tc-gruen-weiss-graefelfing-ii/','Mannschaft: Herren 50 – Begegnung: Auswärts gegen TC Grün-Weiß Gräfelfing II'
),
(
  'Herren 50 II','herren-50-ii-heimspiel-gegen-tc-raschke-taufkirchen','league','TC Raschke Taufkirchen',true,
  '2026-06-27 12:00:00+00'::timestamptz,'2026-06-27 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-ii-heimspiel-gegen-tc-raschke-taufkirchen/','Mannschaft: Herren 50 II – Begegnung: Heim gegen TC Raschke Taufkirchen'
),
(
  'Damen 40','damen-40-heimspiel-gegen-tc-pfaffenhofen-ilm','league','TC Pfaffenhofen/Ilm',true,
  '2026-06-27 12:00:00+00'::timestamptz,'2026-06-27 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-40-heimspiel-gegen-tc-pfaffenhofen-ilm/','Mannschaft: Damen 40 – Begegnung: Heim gegen TC Pfaffenhofen/Ilm'
),
(
  'Herren II','herren-ii-auswaertsspiel-gegen-tf-markt-schwaben','league','TF Markt Schwaben',false,
  '2026-06-28 07:00:00+00'::timestamptz,'2026-06-28 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-ii-auswaertsspiel-gegen-tf-markt-schwaben/','Mannschaft: Herren II – Begegnung: Auswärts gegen TF Markt Schwaben'
),
(
  'Herren III','herren-iii-heimspiel-gegen-ts-jahn-muenchen-ii','league','TS Jahn München II',true,
  '2026-06-28 07:00:00+00'::timestamptz,'2026-06-28 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-iii-heimspiel-gegen-ts-jahn-muenchen-ii/','Mannschaft: Herren III – Begegnung: Heim gegen TS Jahn München II'
),
(
  'Damen','damen-heimspiel-gegen-tc-philathlos-muenchen','league','TC Philathlos München',true,
  '2026-06-28 07:00:00+00'::timestamptz,'2026-06-28 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-heimspiel-gegen-tc-philathlos-muenchen/','Mannschaft: Damen – Begegnung: Heim gegen TC Philathlos München'
),
(
  'Herren','herren-auswaertsspiel-gegen-tsv-1860-rosenheim-ii','league','TSV 1860 Rosenheim II',false,
  '2026-06-28 08:00:00+00'::timestamptz,'2026-06-28 14:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-auswaertsspiel-gegen-tsv-1860-rosenheim-ii/','Mannschaft: Herren – Begegnung: Auswärts gegen TSV 1860 Rosenheim II'
),
(
  'Mädchen 15','maedchen-15-heimspiel-gegen-tsv-haar-ii','league','TSV Haar II',true,
  '2026-07-03 13:00:00+00'::timestamptz,'2026-07-03 19:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/maedchen-15-heimspiel-gegen-tsv-haar-ii/','Mannschaft: Mädchen 15 – Begegnung: Heim gegen TSV Haar II'
),
(
  'Knaben 15','knaben-15-auswaertsspiel-gegen-sv-lohhof','league','SV Lohhof',false,
  '2026-07-03 13:00:00+00'::timestamptz,'2026-07-03 19:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-auswaertsspiel-gegen-sv-lohhof/','Mannschaft: Knaben 15 – Begegnung: Auswärts gegen SV Lohhof'
),
(
  'Kleinfeld U9','u9-heimspiel-gegen-tsv-haar','league','TSV Haar',true,
  '2026-07-03 13:00:00+00'::timestamptz,'2026-07-03 19:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/u9-heimspiel-gegen-tsv-haar/','Mannschaft: U9 – Begegnung: Heim gegen TSV Haar'
),
(
  'Junioren 18','junioren-18-auswaertsspiel-gegen-gw-luitpoldpark-muenchen','league','GW Luitpoldpark München',false,
  '2026-07-04 07:00:00+00'::timestamptz,'2026-07-04 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-auswaertsspiel-gegen-gw-luitpoldpark-muenchen/','Mannschaft: Junioren 18 – Begegnung: Auswärts gegen GW Luitpoldpark München'
),
(
  'Junioren 18 II','junioren-18-ii-heimspiel-gegen-tf-markt-schwaben','league','TF Markt Schwaben',true,
  '2026-07-04 07:00:00+00'::timestamptz,'2026-07-04 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-ii-heimspiel-gegen-tf-markt-schwaben/','Mannschaft: Junioren 18 II – Begegnung: Heim gegen TF Markt Schwaben'
),
(
  'Bambini 12','bambini-12-heimspiel-gegen-tc-neukeferloh','league','TC Neukeferloh',true,
  '2026-07-04 07:00:00+00'::timestamptz,'2026-07-04 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-heimspiel-gegen-tc-neukeferloh/','Mannschaft: Bambini 12 – Begegnung: Heim gegen TC Neukeferloh'
),
(
  'Herren 40','herren-40-auswaertsspiel-gegen-spvgg-langenbruck','league','SpVgg Langenbruck',false,
  '2026-07-04 12:00:00+00'::timestamptz,'2026-07-04 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-auswaertsspiel-gegen-spvgg-langenbruck/','Mannschaft: Herren 40 – Begegnung: Auswärts gegen SpVgg Langenbruck'
),
(
  'Herren 40 II','herren-40-ii-heimspiel-gegen-vfb-forstinning','league','VfB Forstinning',true,
  '2026-07-04 12:00:00+00'::timestamptz,'2026-07-04 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-ii-heimspiel-gegen-vfb-forstinning/','Mannschaft: Herren 40 II – Begegnung: Heim gegen VfB Forstinning'
),
(
  'Herren 50 II','herren-50-ii-auswaertsspiel-gegen-sv-djk-taufkirchen','league','SV DJK Taufkirchen',false,
  '2026-07-04 12:00:00+00'::timestamptz,'2026-07-04 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-ii-auswaertsspiel-gegen-sv-djk-taufkirchen/','Mannschaft: Herren 50 II – Begegnung: Auswärts gegen SV DJK Taufkirchen'
),
(
  'Damen 30','damen-30-heimspiel-gegen-djk-darching','league','DJK Darching',true,
  '2026-07-04 12:00:00+00'::timestamptz,'2026-07-04 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-30-heimspiel-gegen-djk-darching/','Mannschaft: Damen 30 – Begegnung: Heim gegen DJK Darching'
),
(
  'Damen 40','damen-40-auswaertsspiel-gegen-tc-topspin','league','TC Topspin',false,
  '2026-07-04 12:00:00+00'::timestamptz,'2026-07-04 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-40-auswaertsspiel-gegen-tc-topspin/','Mannschaft: Damen 40 – Begegnung: Auswärts gegen TC Topspin'
),
(
  'Damen 50','damen-50-heimspiel-gegen-djk-altdorf','league','DJK Altdorf',true,
  '2026-07-04 12:00:00+00'::timestamptz,'2026-07-04 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-50-heimspiel-gegen-djk-altdorf/','Mannschaft: Damen 50 – Begegnung: Heim gegen DJK Altdorf'
),
(
  'Herren II','herren-ii-auswaertsspiel-gegen-polizei-sv-haar','league','Polizei SV Haar',false,
  '2026-07-05 07:00:00+00'::timestamptz,'2026-07-05 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-ii-auswaertsspiel-gegen-polizei-sv-haar/','Mannschaft: Herren II – Begegnung: Auswärts gegen Polizei SV Haar'
),
(
  'Herren III','herren-iii-heimspiel-gegen-tsv-haar-iii','league','TSV Haar III',true,
  '2026-07-05 07:00:00+00'::timestamptz,'2026-07-05 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-iii-heimspiel-gegen-tsv-haar-iii/','Mannschaft: Herren III – Begegnung: Heim gegen TSV Haar III'
),
(
  'Damen','damen-heimspiel-gegen-tc-anzing','league','TC Anzing',true,
  '2026-07-05 07:00:00+00'::timestamptz,'2026-07-05 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-heimspiel-gegen-tc-anzing/','Mannschaft: Damen – Begegnung: Heim gegen TC Anzing'
),
(
  'Herren','herren-auswaertsspiel-gegen-stk-garching','league','STK Garching',false,
  '2026-07-05 08:00:00+00'::timestamptz,'2026-07-05 14:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-auswaertsspiel-gegen-stk-garching/','Mannschaft: Herren – Begegnung: Auswärts gegen STK Garching'
),
(
  'Knaben 15','knaben-15-heimspiel-gegen-tc-unterfoehring','league','TC Unterföhring',true,
  '2026-07-10 13:00:00+00'::timestamptz,'2026-07-10 19:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-heimspiel-gegen-tc-unterfoehring/','Mannschaft: Knaben 15 – Begegnung: Heim gegen TC Unterföhring'
),
(
  'Knaben 15 II','knaben-15-ii-auswaertsspiel-gegen-stk-garching','league','STK Garching',false,
  '2026-07-10 13:00:00+00'::timestamptz,'2026-07-10 19:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-ii-auswaertsspiel-gegen-stk-garching/','Mannschaft: Knaben 15 II – Begegnung: Auswärts gegen STK Garching'
),
(
  'Junioren 18 II','junioren-18-ii-heimspiel-gegen-tc-neukeferloh','league','TC Neukeferloh',true,
  '2026-07-11 07:00:00+00'::timestamptz,'2026-07-11 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-ii-heimspiel-gegen-tc-neukeferloh/','Mannschaft: Junioren 18 II – Begegnung: Heim gegen TC Neukeferloh'
),
(
  'Bambini 12','bambini-12-auswaertsspiel-gegen-tsv-oberpframmern-ii','league','TSV Oberpframmern II',false,
  '2026-07-11 07:00:00+00'::timestamptz,'2026-07-11 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/bambini-12-auswaertsspiel-gegen-tsv-oberpframmern-ii/','Mannschaft: Bambini 12 – Begegnung: Auswärts gegen TSV Oberpframmern II'
),
(
  'Herren 40','herren-40-auswaertsspiel-gegen-tc-bad-aibling','league','TC Bad Aibling',false,
  '2026-07-11 12:00:00+00'::timestamptz,'2026-07-11 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-auswaertsspiel-gegen-tc-bad-aibling/','Mannschaft: Herren 40 – Begegnung: Auswärts gegen TC Bad Aibling'
),
(
  'Herren 40 II','herren-40-ii-auswaertsspiel-gegen-tc-aschheim','league','TC Aschheim',false,
  '2026-07-11 12:00:00+00'::timestamptz,'2026-07-11 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-ii-auswaertsspiel-gegen-tc-aschheim/','Mannschaft: Herren 40 II – Begegnung: Auswärts gegen TC Aschheim'
),
(
  'Damen 40','damen-40-auswaertsspiel-gegen-polizei-sv-haar','league','Polizei SV Haar',false,
  '2026-07-11 12:00:00+00'::timestamptz,'2026-07-11 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-40-auswaertsspiel-gegen-polizei-sv-haar/','Mannschaft: Damen 40 – Begegnung: Auswärts gegen Polizei SV Haar'
),
(
  'Damen 50','damen-50-auswaertsspiel-gegen-tc-rot-weiss-freising-ii','league','TC Rot-Weiß Freising II',false,
  '2026-07-11 12:00:00+00'::timestamptz,'2026-07-11 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-50-auswaertsspiel-gegen-tc-rot-weiss-freising-ii/','Mannschaft: Damen 50 – Begegnung: Auswärts gegen TC Rot-Weiß Freising II'
),
(
  'Herren II','herren-ii-heimspiel-gegen-tc-erding-ii','league','TC Erding II',true,
  '2026-07-12 07:00:00+00'::timestamptz,'2026-07-12 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-ii-heimspiel-gegen-tc-erding-ii/','Mannschaft: Herren II – Begegnung: Heim gegen TC Erding II'
),
(
  'Herren III','herren-iii-auswaertsspiel-gegen-sv-heimstetten','league','SV Heimstetten',false,
  '2026-07-12 07:00:00+00'::timestamptz,'2026-07-12 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-iii-auswaertsspiel-gegen-sv-heimstetten/','Mannschaft: Herren III – Begegnung: Auswärts gegen SV Heimstetten'
),
(
  'Damen','damen-heimspiel-gegen-tc-moosinning','league','TC Moosinning',true,
  '2026-07-12 07:00:00+00'::timestamptz,'2026-07-12 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-heimspiel-gegen-tc-moosinning/','Mannschaft: Damen – Begegnung: Heim gegen TC Moosinning'
),
(
  'Herren','herren-heimspiel-gegen-hc-wacker-muenchen','league','HC Wacker München',true,
  '2026-07-12 08:00:00+00'::timestamptz,'2026-07-12 14:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-heimspiel-gegen-hc-wacker-muenchen/','Mannschaft: Herren – Begegnung: Heim gegen HC Wacker München'
),
(
  'Knaben 15 II','knaben-15-ii-heimspiel-gegen-teg-kirchheim-ii','league','TeG Kirchheim II',true,
  '2026-07-17 13:00:00+00'::timestamptz,'2026-07-17 19:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/knaben-15-ii-heimspiel-gegen-teg-kirchheim-ii/','Mannschaft: Knaben 15 II – Begegnung: Heim gegen TeG Kirchheim II'
),
(
  'Junioren 18','junioren-18-auswaertsspiel-gegen-tc-unterfoehring','league','TC Unterföhring',false,
  '2026-07-18 07:00:00+00'::timestamptz,'2026-07-18 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-auswaertsspiel-gegen-tc-unterfoehring/','Mannschaft: Junioren 18 – Begegnung: Auswärts gegen TC Unterföhring'
),
(
  'Junioren 18 II','junioren-18-ii-auswaertsspiel-gegen-tc-topspin','league','TC Topspin',false,
  '2026-07-18 07:00:00+00'::timestamptz,'2026-07-18 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/junioren-18-ii-auswaertsspiel-gegen-tc-topspin/','Mannschaft: Junioren 18 II – Begegnung: Auswärts gegen TC Topspin'
),
(
  'Herren 40 II','herren-40-ii-heimspiel-gegen-tc-pliening-iii','league','TC Pliening III',true,
  '2026-07-18 12:00:00+00'::timestamptz,'2026-07-18 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-40-ii-heimspiel-gegen-tc-pliening-iii/','Mannschaft: Herren 40 II – Begegnung: Heim gegen TC Pliening III'
),
(
  'Herren 50 II','herren-50-ii-auswaertsspiel-gegen-tc-aschheim-ii','league','TC Aschheim II',false,
  '2026-07-18 12:00:00+00'::timestamptz,'2026-07-18 18:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-50-ii-auswaertsspiel-gegen-tc-aschheim-ii/','Mannschaft: Herren 50 II – Begegnung: Auswärts gegen TC Aschheim II'
),
(
  'Damen 30','damen-30-heimspiel-gegen-tc-schwabing','league','TC Schwabing',true,
  '2026-07-18 12:00:00+00'::timestamptz,'2026-07-18 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-30-heimspiel-gegen-tc-schwabing/','Mannschaft: Damen 30 – Begegnung: Heim gegen TC Schwabing'
),
(
  'Damen 50','damen-50-heimspiel-gegen-sv-lohhof','league','SV Lohhof',true,
  '2026-07-18 12:00:00+00'::timestamptz,'2026-07-18 18:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-50-heimspiel-gegen-sv-lohhof/','Mannschaft: Damen 50 – Begegnung: Heim gegen SV Lohhof'
),
(
  'Herren III','herren-iii-auswaertsspiel-gegen-team-muenchen','league','Team München',false,
  '2026-07-19 07:00:00+00'::timestamptz,'2026-07-19 13:00:00+00'::timestamptz,
  null,null,
  'https://www.tennis-tsvfeldkirchen.de/termine/herren-iii-auswaertsspiel-gegen-team-muenchen/','Mannschaft: Herren III – Begegnung: Auswärts gegen Team München'
),
(
  'Damen','damen-heimspiel-gegen-tc-topspin-ii','league','TC Topspin II',true,
  '2026-07-19 07:00:00+00'::timestamptz,'2026-07-19 13:00:00+00'::timestamptz,
  'TSV Feldkirchen Tennis','Olympiastrasse 1, 85622 Feldkirchen',
  'https://www.tennis-tsvfeldkirchen.de/termine/damen-heimspiel-gegen-tc-topspin-ii/','Mannschaft: Damen – Begegnung: Heim gegen TC Topspin II'
)
)
insert into public.matches(team_season_id,slug,match_type,opponent,is_home,starts_at,ends_at,venue_name,venue_address,external_url,notes,is_published)
select ts.id,i.slug,i.match_type,i.opponent,i.is_home,i.starts_at,i.ends_at,i.venue_name,i.venue_address,i.external_url,i.notes,true
from imported i
join public.teams t on t.name=i.team_name
join public.team_seasons ts on ts.team_id=t.id
join public.seasons s on s.id=ts.season_id and s.year=2026
on conflict (team_season_id,starts_at,opponent) do update
set slug=excluded.slug,match_type=excluded.match_type,is_home=excluded.is_home,ends_at=excluded.ends_at,
    venue_name=excluded.venue_name,venue_address=excluded.venue_address,external_url=excluded.external_url,
    notes=excluded.notes,is_published=true,updated_at=now();

insert into public.events(slug,title,description,category,starts_at,ends_at,all_day,location_name,address,status,external_url)
values
(
  'jahreshauptversammlung-fuer-die-geschaeftsjahre-2024-und-2025-mit-neuwahlen-am-freitag-27-3-2026','Jahreshauptversammlung für die Geschäftsjahre 2024 und 2025 mit Neuwahlen am Freitag, 27.3.2026','zur Jahreshauptversammlung für die Geschäftsjahre 2024 und 2025 des TSV Feldkirchen bei München von 1912 e.V. möchten wir Sie herzlich am Freitag, 27.3.2026 in den Sportlerwirt „Pomod‘ oro“, Olympiastraße, 1 einladen. Wir beginnen pünktlich um 19:00 Uhr.','club',
  '2026-03-27 18:00:00+00'::timestamptz,'2026-03-27 22:00:00+00'::timestamptz,false,
  'Sporti','Olympiastrasse 1, 85622, Feldkirchen','published',
  'https://www.tennis-tsvfeldkirchen.de/termine/jahreshauptversammlung-fuer-die-geschaeftsjahre-2024-und-2025-mit-neuwahlen-am-freitag-27-3-2026/'
),
(
  'aufbau-der-plaetze','Aufbau der Plätze','Am 28.03.2026 hat das lange Warten endlich ein Ende – unsere Tennisplätze werden wieder für die neue Saison vorbereitet! Beim gemeinsamen Platzaufbau packen wir zusammen an, damit wir bald wieder auf perfekt vorbereiteten Sandplätzen spielen können.




Nach getaner Arbeit lassen wir den Tag gemütlich ausklingen: Beim Leberkäs-Essen und einem geselligen Beisammensein auf der Anlage ist Zeit für gute Gespräche und Vorfreude auf die kommende Tennissaison.1




Wir freuen uns über jede helfende Hand und einen schönen gemeinsamen Start in die neue Saison! 🎾','club',
  '2026-03-28 09:00:00+00'::timestamptz,'2026-03-28 16:00:00+00'::timestamptz,false,
  'Sporti','Olympiastrasse 1, 85622, Feldkirchen','published',
  'https://www.tennis-tsvfeldkirchen.de/termine/aufbau-der-plaetze/'
),
(
  'schnuppertag','Schnuppertag','Jetzt hier anmelden:

https://www.tennisschule-alexbraun.de/','training',
  '2026-04-12 08:00:00+00'::timestamptz,'2026-04-12 15:00:00+00'::timestamptz,false,
  null,null,'published',
  'https://www.tennis-tsvfeldkirchen.de/termine/schnuppertag/'
)
on conflict (slug) do update
set title=excluded.title,description=excluded.description,category=excluded.category,starts_at=excluded.starts_at,
    ends_at=excluded.ends_at,all_day=excluded.all_day,location_name=excluded.location_name,address=excluded.address,
    status=excluded.status,external_url=excluded.external_url,updated_at=now();
