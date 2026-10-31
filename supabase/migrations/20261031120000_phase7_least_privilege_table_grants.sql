-- Phase 7 least privilege: all 23 public tables have RLS but anon retained
-- excessive SQL table-level write/TRUNCATE permissions from bootstrap grants.
-- PostgreSQL row-level security does not apply to TRUNCATE. Remove this risk.
-- Keep SELECT and existing RLS policies; keep authenticated DML for the club editors.
-- Do not change postgres or service_role permissions.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;

-- Signed-in club editors use INSERT/UPDATE/DELETE via RLS,
-- not TRUNCATE or schema-level REFERENCES/TRIGGER privileges.
revoke truncate, references, trigger
  on all tables in schema public from authenticated;
