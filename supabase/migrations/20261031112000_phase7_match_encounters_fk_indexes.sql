-- Phase 7: cover foreign keys reported by the Supabase performance advisor.
-- Additive indexes only, no records are modified.
create index if not exists match_encounters_player_1_fk_idx on public.match_encounters(tsv_player_1_id);
create index if not exists match_encounters_player_2_fk_idx on public.match_encounters(tsv_player_2_id);
create index if not exists match_encounters_updated_by_fk_idx on public.match_encounters(updated_by);
