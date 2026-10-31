-- TSV Feldkirchen: manuelle, nicht-amtliche Ergebnisse strikt getrennt von BTV.
-- Einzig zulässiges Ziel: eaurnufdochjapfzqwvm.
CREATE TABLE public.manual_match_results (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  result_status text NOT NULL DEFAULT 'played'
    CHECK (result_status IN ('played','walkover','withdrawn','cancelled','abandoned','postponed','unknown')),
  home_points integer CHECK (home_points BETWEEN 0 AND 99),
  away_points integer CHECK (away_points BETWEEN 0 AND 99),
  source_type text NOT NULL DEFAULT 'club_confirmation'
    CHECK (source_type IN ('club_confirmation','btv_report','tennis_de','other')),
  source_url text CHECK (source_url IS NULL OR (length(source_url)<=1000 AND source_url ~ '^https://[^[:space:]]+$')),
  notes text CHECK (notes IS NULL OR length(notes)<=1200),
  review_status text NOT NULL DEFAULT 'manual_pending'
    CHECK (review_status IN ('manual_pending','official_reviewed')),
  entered_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_scores_both_or_neither CHECK ((home_points IS NULL)=(away_points IS NULL)),
  CONSTRAINT manual_played_has_score CHECK (
    result_status <> 'played' OR
    (home_points IS NOT NULL AND away_points IS NOT NULL AND home_points+away_points>0)
  )
);

ALTER TABLE public.manual_match_results ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.manual_results_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $body$
BEGIN
  IF TG_OP='UPDATE' THEN
    NEW.entered_by=OLD.entered_by;
    NEW.created_at=OLD.created_at;
    NEW.review_status=OLD.review_status;
  END IF;
  NEW.updated_by=auth.uid();
  NEW.updated_at=now();
  RETURN NEW;
END;
$body$;

CREATE TRIGGER trg_manual_results_stamp
BEFORE INSERT OR UPDATE ON public.manual_match_results
FOR EACH ROW EXECUTE FUNCTION private.manual_results_stamp();

CREATE POLICY manual_results_authorized_read ON public.manual_match_results
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.matches m
  WHERE m.id = match_id AND private.can_edit_team_season(m.team_season_id)
));

CREATE POLICY manual_results_authorized_insert ON public.manual_match_results
FOR INSERT TO authenticated
WITH CHECK (
  entered_by=(select auth.uid()) AND updated_by=(select auth.uid())
  AND review_status='manual_pending'
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id=match_id
      AND private.can_edit_team_season(m.team_season_id)
      AND nullif(btrim(m.btv_result_text),'') IS NULL
  )
);

CREATE POLICY manual_results_authorized_update ON public.manual_match_results
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.matches m
  WHERE m.id=match_id AND private.can_edit_team_season(m.team_season_id)
    AND nullif(btrim(m.btv_result_text),'') IS NULL
))
WITH CHECK (
  updated_by=(select auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id=match_id AND private.can_edit_team_season(m.team_season_id)
      AND nullif(btrim(m.btv_result_text),'') IS NULL
  )
);

REVOKE ALL ON public.manual_match_results FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.manual_match_results TO authenticated;
GRANT INSERT (match_id,result_status,home_points,away_points,source_type,source_url,notes)
  ON public.manual_match_results TO authenticated;
GRANT UPDATE (result_status,home_points,away_points,source_type,source_url,notes)
  ON public.manual_match_results TO authenticated;

-- Nur tatsächlich zum Bearbeiten berechtigte Mannschafts-/Saisoneinträge.
CREATE VIEW public.manual_editable_matches
WITH (security_invoker=true) AS
SELECT m.id AS match_id, m.starts_at, m.opponent, m.is_home,
       m.btv_result_text, m.team_season_id,
       t.name AS team_name, s.name AS season_name, s.code AS season_code,
       ts.group_name, ts.btv_url, ts.tennis_de_portrait_url
FROM public.matches m
JOIN public.team_seasons ts ON ts.id=m.team_season_id
JOIN public.teams t ON t.id=ts.team_id
JOIN public.seasons s ON s.id=ts.season_id
WHERE private.can_edit_team_season(m.team_season_id);

REVOKE ALL ON public.manual_editable_matches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.manual_editable_matches TO authenticated;
