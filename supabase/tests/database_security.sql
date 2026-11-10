begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

select ok(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity
  ),
  'Every public application table has RLS enabled'
);

select ok(not has_table_privilege('anon','public.team_standings','insert'), 'anon cannot insert standings');
select ok(not has_table_privilege('anon','public.team_standings','update'), 'anon cannot update standings');
select ok(not has_table_privilege('anon','public.team_standings','delete'), 'anon cannot delete standings');
select ok(not has_table_privilege('authenticated','public.team_standings','insert'), 'authenticated cannot insert standings');
select ok(not has_table_privilege('authenticated','public.team_standings','update'), 'authenticated cannot update standings');
select ok(not has_table_privilege('authenticated','public.team_standings','delete'), 'authenticated cannot delete standings');
select ok(has_table_privilege('anon','public.team_standings','select'), 'anon can read published standings');

select ok(not has_schema_privilege('anon','private','usage'), 'anon cannot access the private schema');
select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and has_function_privilege('anon',p.oid,'execute')
  ),
  'anon cannot execute private helper functions'
);

select ok(has_function_privilege('anon','public.event_rsvp_summary(uuid)'::regprocedure,'execute'), 'public RSVP aggregate remains available');
select ok(has_function_privilege('anon','public.pyramid_public_standings()'::regprocedure,'execute'), 'public pyramid standings remain available');
select ok(has_function_privilege('anon','public.track_site_analytics(text,text,text,text,text,text)'::regprocedure,'execute'), 'public analytics counter remains available');
select ok(not has_function_privilege('public','public.event_rsvp_summary(uuid)'::regprocedure,'execute'), 'PUBLIC has no implicit RSVP RPC execution');
select ok(not has_function_privilege('public','public.pyramid_public_standings()'::regprocedure,'execute'), 'PUBLIC has no implicit pyramid RPC execution');
select ok(not has_function_privilege('public','public.track_site_analytics(text,text,text,text,text,text)'::regprocedure,'execute'), 'PUBLIC has no implicit analytics RPC execution');

select * from finish();
rollback;
