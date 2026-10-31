-- Applied migration: public_live_postgres_changes_fallback
-- Public live pages use RLS-protected Postgres Changes as a robust public realtime path.
-- Authenticated editors additionally receive private Broadcast events.
alter publication supabase_realtime add table public.match_live_state;
alter publication supabase_realtime add table public.live_ticker_entries;
