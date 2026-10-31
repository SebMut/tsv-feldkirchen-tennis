-- Atomic, authenticated roster import from an official nMM transcribed by a club editor.
-- No public names appear automatically; no user token or BTV credentials are stored.
create or replace function public.import_team_player_name(
  p_team_season_id uuid,
  p_display_name text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_id uuid;
begin
  v_name := btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));
  if length(v_name) < 3 or length(v_name) > 90
     or v_name ~ '[0-9@<>]'
     or v_name ~ '[[:cntrl:]]' then
    raise exception 'Ungültiger Spielername (3–90 Zeichen, keine Nummern oder Sonderdaten)' using errcode = '22023';
  end if;
  if not exists (select 1 from public.team_seasons ts where ts.id = p_team_season_id)
     or not private.can_edit_team_season(p_team_season_id) then
    raise exception 'Keine Berechtigung für diesen Mannschaftskader' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.team_players tp
    join public.players p on p.id=tp.player_id
    where tp.team_season_id=p_team_season_id
      and lower(btrim(p.display_name))=lower(v_name)
  ) then
    return false;
  end if;

  insert into public.players(display_name,active)
  values (v_name,true) returning id into v_id;
  insert into public.team_players(team_season_id,player_id,public_visible,is_captain)
  values(p_team_season_id,v_id,false,false);
  return true;
end;
$$;
revoke all on function public.import_team_player_name(uuid,text) from public;
grant execute on function public.import_team_player_name(uuid,text) to authenticated;
comment on function public.import_team_player_name(uuid,text) is
'Insert one validated player into an authorized team/season atomically, idempotent by roster display name; public_visible=false.';
