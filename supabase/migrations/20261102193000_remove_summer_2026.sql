-- Remove the retired Sommer 2026 competition and ALL records scoped to it.
-- Preserve reusable teams, player profiles, roles, club content, Winter 2026/27,
-- Sommer 2027, and all future competitions.
-- Match-dependent live states, rubbers, galleries, rosters and standings are
-- removed by the verified ON DELETE CASCADE foreign keys. Summer snapshots are
-- explicitly removed first because their team_season_id has NO ACTION FK.
DO $$
DECLARE
  summer_id uuid;
  winter_id uuid;
  winter_matches_before integer;
  summer_matches integer;
BEGIN
  SELECT id INTO summer_id FROM public.seasons WHERE code='sommer-2026' FOR UPDATE;
  IF summer_id IS NULL THEN RETURN; END IF;

  SELECT id INTO winter_id FROM public.seasons WHERE code='winter-2026-2027';
  IF winter_id IS NULL THEN
    RAISE EXCEPTION 'Winter 2026/27 missing; summer deletion aborted';
  END IF;
  SELECT count(*) INTO winter_matches_before
    FROM public.matches m JOIN public.team_seasons ts ON ts.id=m.team_season_id
    WHERE ts.season_id=winter_id;
  IF winter_matches_before < 15 THEN
    RAISE EXCEPTION 'Winter 2026/27 has only % matches; aborting', winter_matches_before;
  END IF;
  SELECT count(*) INTO summer_matches FROM public.matches m
    JOIN public.team_seasons ts ON ts.id=m.team_season_id
    WHERE ts.season_id=summer_id;
  IF summer_matches < 1 THEN
    RAISE EXCEPTION 'Sommer 2026 already has no matches: review the target before deletion';
  END IF;

  -- Delete old BTV logs, timestamp snapshots, and generated rescheduling records.
  DELETE FROM public.btv_schedule_changes WHERE season_code='sommer-2026';
  DELETE FROM public.btv_fixture_snapshots WHERE season_code='sommer-2026';
  DELETE FROM public.btv_import_runs WHERE season_code='sommer-2026';

  -- Only match-specific news for this competition, not general club news.
  DELETE FROM public.news n WHERE n.match_id IN (
    SELECT m.id FROM public.matches m
      JOIN public.team_seasons ts ON ts.id=m.team_season_id
      WHERE ts.season_id=summer_id
  );

  -- Old official report details are CASCADE children of their report;
  -- delete import issues before the report to avoid detached issue rows.
  DELETE FROM public.official_import_issues WHERE season_id=summer_id;
  DELETE FROM public.official_meeting_reports WHERE season_id=summer_id;
  DELETE FROM public.official_season_sources WHERE season_id=summer_id;

  -- All official season references, team rosters, standings, 124 fixtures,
  -- 124 live states, any encounter/ticker/result/gallery records cascade.
  DELETE FROM public.team_seasons WHERE season_id=summer_id;
  DELETE FROM public.seasons WHERE id=summer_id;

  IF EXISTS (SELECT 1 FROM public.team_seasons WHERE season_id=summer_id)
     OR EXISTS (SELECT 1 FROM public.btv_fixture_snapshots WHERE season_code='sommer-2026')
     OR EXISTS (SELECT 1 FROM public.official_meeting_reports WHERE season_id=summer_id)
     OR EXISTS (SELECT 1 FROM public.btv_schedule_changes WHERE season_code='sommer-2026')
     OR EXISTS (SELECT 1 FROM public.btv_import_runs WHERE season_code='sommer-2026') THEN
     RAISE EXCEPTION 'Sommer 2026 residual data found; rollback';
  END IF;

  IF (SELECT count(*) FROM public.matches m JOIN public.team_seasons ts
      ON ts.id=m.team_season_id WHERE ts.season_id=winter_id)<>winter_matches_before THEN
    RAISE EXCEPTION 'Winter match data changed unexpectedly; rollback';
  END IF;
  RAISE NOTICE 'Removed Sommer 2026 (% matches). Winter 2026/27 preserved (% matches).',
    summer_matches,winter_matches_before;
END $$;