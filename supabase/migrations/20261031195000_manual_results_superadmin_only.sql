-- Nur TSV-Superadmins ("Masteradmins") dürfen manuelle Ergebnisse verwalten.
-- Das automatische BTV-Ergebnis in matches.btv_result_text bleibt unverändert.
-- Zielprojekt: eaurnufdochjapfzqwvm.
DROP POLICY IF EXISTS manual_results_authorized_read ON public.manual_match_results;
DROP POLICY IF EXISTS manual_results_authorized_insert ON public.manual_match_results;
DROP POLICY IF EXISTS manual_results_authorized_update ON public.manual_match_results;

CREATE POLICY manual_results_authorized_read
ON public.manual_match_results FOR SELECT TO authenticated
USING (private.is_super_admin());

CREATE POLICY manual_results_authorized_insert
ON public.manual_match_results FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin()
  AND entered_by = (SELECT auth.uid())
  AND updated_by = (SELECT auth.uid())
  AND review_status = 'manual_pending'
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = manual_match_results.match_id
      AND nullif(btrim(m.btv_result_text), '') IS NULL
  )
);

CREATE POLICY manual_results_authorized_update
ON public.manual_match_results FOR UPDATE TO authenticated
USING (
  private.is_super_admin()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = manual_match_results.match_id
      AND nullif(btrim(m.btv_result_text), '') IS NULL
  )
)
WITH CHECK (
  private.is_super_admin()
  AND updated_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = manual_match_results.match_id
      AND nullif(btrim(m.btv_result_text), '') IS NULL
  )
);

CREATE OR REPLACE VIEW public.manual_editable_matches
WITH (security_invoker = true)
AS
SELECT m.id AS match_id, m.starts_at, m.opponent, m.is_home,
       m.btv_result_text, m.team_season_id,
       t.name AS team_name, s.name AS season_name, s.code AS season_code,
       ts.group_name, ts.btv_url, ts.tennis_de_portrait_url
FROM public.matches m
JOIN public.team_seasons ts ON ts.id = m.team_season_id
JOIN public.teams t ON t.id = ts.team_id
JOIN public.seasons s ON s.id = ts.season_id
WHERE private.is_super_admin();

-- Keine anonymen Tabellen- und Ansichtsrechte.
REVOKE ALL ON public.manual_match_results FROM anon;
REVOKE ALL ON public.manual_editable_matches FROM anon;
