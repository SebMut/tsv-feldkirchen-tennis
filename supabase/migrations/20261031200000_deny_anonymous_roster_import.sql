-- Supabase default FUNCTION privileges can grant EXECUTE directly to anon.
-- Explicitly revoke all anonymous and PUBLIC rights, leaving authenticated only.
revoke execute on function public.import_team_player_name(uuid,text) from anon;
revoke execute on function public.import_team_player_name(uuid,text) from public;
grant execute on function public.import_team_player_name(uuid,text) to authenticated;
