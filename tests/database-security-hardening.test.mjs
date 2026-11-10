import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20261110124313_harden_public_database_access.sql', import.meta.url), 'utf8');
const dbTest = readFileSync(new URL('../supabase/tests/database_security.sql', import.meta.url), 'utf8');

test('standings expose read-only privileges to browser roles', () => {
  assert.match(migration, /revoke all on table public\.team_standings from anon, authenticated/i);
  assert.match(migration, /grant select on table public\.team_standings to anon, authenticated/i);
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete|all)[^;]*team_standings[^;]*(?:anon|authenticated)/i);
});

test('public definer RPCs use explicit narrowly documented execution grants', () => {
  for (const signature of [
    'event_rsvp_summary\\(uuid\\)',
    'pyramid_public_standings\\(\\)',
    'track_site_analytics\\(text,text,text,text,text,text\\)',
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated`, 'i'));
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature}[\\s\\S]*?to anon, authenticated`, 'i'));
  }
  assert.match(migration, /revoke execute on all functions in schema private from public, anon/i);
  assert.match(migration, /alter default privileges in schema private revoke execute on functions from public/i);
});

test('database regression suite covers RLS, grants, private helpers and public RPCs', () => {
  assert.match(dbTest, /Every public application table has RLS enabled/);
  assert.match(dbTest, /anon cannot (?:insert|update|delete) standings/);
  assert.match(dbTest, /authenticated cannot (?:insert|update|delete) standings/);
  assert.match(dbTest, /anon cannot execute private helper functions/);
  assert.match(dbTest, /PUBLIC has no implicit .* RPC execution/);
  assert.match(dbTest, /select plan\(16\)/);
});
