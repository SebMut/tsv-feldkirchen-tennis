-- Phase 7: remove unintended anonymous access to privileged matchday RPCs.
-- Authenticated callers remain allowed; each function additionally checks
-- private.can_tick_match(target_match) before changing match data.
revoke execute on function public.ensure_match_encounters(uuid) from public, anon;
revoke execute on function public.configure_match_encounters(uuid, text) from public, anon;
grant execute on function public.ensure_match_encounters(uuid) to authenticated;
grant execute on function public.configure_match_encounters(uuid, text) to authenticated;
