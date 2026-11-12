-- TSV Feldkirchen – ausschließlich lesender Abgleich / SQL
-- Nur im freigegebenen Supabase-Projekt eaurnufdochjapfzqwvm ausführen.
-- Keine Namen, Spielbericht-Rohdaten oder Zugangsdaten abfragen.
-- 1. Saisonüberblick mit Heim-/Auswärtsspielen
SELECT s.code,
       COUNT(DISTINCT ts.id) AS team_seasons,
       COUNT(m.id) AS fixtures,
       COUNT(m.id) FILTER (WHERE NULLIF(BTRIM(m.btv_result_text),'') IS NOT NULL) AS with_btv_result,
       COUNT(m.id) FILTER (WHERE m.is_home) AS home,
       COUNT(m.id) FILTER (WHERE NOT m.is_home) AS away
FROM seasons s
LEFT JOIN team_seasons ts ON ts.season_id=s.id
LEFT JOIN matches m ON m.team_season_id=ts.id
GROUP BY s.id, s.code
ORDER BY s.code;

-- 2. Official snapshot coverage by season
SELECT b.season_code, COUNT(*) AS snapshots,
       COUNT(*) FILTER (WHERE b.match_id IS NULL) AS unlinked_snapshots,
       COUNT(DISTINCT b.match_id) AS linked_matches
FROM btv_fixture_snapshots b
GROUP BY b.season_code
ORDER BY b.season_code;

-- 3. Unlinked official BTV snapshots (club/opponent names only)
SELECT b.season_code, t.name AS tsv_team, b.opponent,
       b.starts_at::date AS official_day, b.is_home,
       b.source_url
FROM btv_fixture_snapshots b
JOIN team_seasons ts ON ts.id=b.team_season_id
JOIN teams t ON t.id=ts.team_id
WHERE b.match_id IS NULL
ORDER BY b.season_code, b.starts_at, t.name;

-- 4. Internal fixtures not referenced by snapshot
SELECT s.code, t.name AS tsv_team, m.opponent,
       m.starts_at::date AS internal_day, m.is_home
FROM matches m
JOIN team_seasons ts ON ts.id=m.team_season_id
JOIN seasons s ON s.id=ts.season_id
JOIN teams t ON t.id=ts.team_id
LEFT JOIN btv_fixture_snapshots b ON b.match_id=m.id
WHERE b.match_id IS NULL
ORDER BY s.code, m.starts_at, t.name;

-- 5. Missing BTV final results, official pairings and unresolved issues
SELECT s.code, t.name AS tsv_team, m.opponent,
       m.starts_at::date AS internal_day, m.is_home
FROM matches m
JOIN team_seasons ts ON ts.id=m.team_season_id
JOIN seasons s ON s.id=ts.season_id
JOIN teams t ON t.id=ts.team_id
WHERE NULLIF(BTRIM(m.btv_result_text),'') IS NULL
ORDER BY s.code, m.starts_at, t.name;

SELECT verification_status, COUNT(*) AS reports
FROM official_meeting_reports
GROUP BY verification_status;

SELECT COUNT(*) AS imported_rubbers FROM official_report_rubbers;
SELECT issue_code, COUNT(*) AS unresolved FROM official_import_issues
WHERE resolved_at IS NULL GROUP BY issue_code;
