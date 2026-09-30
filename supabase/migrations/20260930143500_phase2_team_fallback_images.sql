-- Phase 2: use existing category images until real team photos are uploaded.

update public.teams
set image_path = case
  when gender = 'men' then 'teams/herren.png'
  when gender = 'women' then 'teams/damen.png'
  when gender = 'youth' then 'teams/jugend.png'
  else image_path
end,
updated_at = now()
where image_path is null;
