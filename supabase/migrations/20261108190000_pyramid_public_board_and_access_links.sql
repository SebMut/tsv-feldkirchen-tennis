-- TSV Forderungspyramide: intentionally public, minimum-data board.
-- The underlying ladder, entry, requests, profile and media RLS remains unchanged.
-- No user IDs, profile photos, emails, neutralization or player availability
-- are returned to unauthenticated visitors.
create or replace function public.pyramid_public_standings()
returns table(
 ladder_id uuid, ladder_title text, season_label text, starts_on date,
 ends_on date, seeded boolean, "position" integer, display_name text
) language sql stable security definer set search_path='' as $$
 select l.id,l.title,l.season_label,l.starts_on,l.ends_on,
        (l.seeded_at is not null),e.position,e.display_name
 from public.pyramid_ladders l
 left join public.pyramid_entries e on e.ladder_id=l.id and e.qualified
 where l.active
 order by l.starts_on desc,l.title,e.position
$$;
revoke all on function public.pyramid_public_standings() from public;
grant execute on function public.pyramid_public_standings() to anon,authenticated;

-- The existing event-mail Gmail OAuth and Cloudflare Turnstile also serve the
-- access link; separate private atomic throttles prevent email enumeration
-- and abuse. Only the server-side service role may use the limiter.
create table if not exists private.pyramid_access_link_limits(
 fingerprint text primary key,
 window_start timestamptz not null default now(),
 attempts integer not null default 0
);
revoke all on private.pyramid_access_link_limits from public,anon,authenticated;
create or replace function public.pyramid_access_link_allow(
 p_email_hash text,p_ip_hash text
) returns boolean language plpgsql security definer set search_path='' as $$
declare email_allowed boolean:=false; ip_allowed boolean:=false;
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then
   raise exception 'Nur der Mailservice darf das Ratenlimit prüfen' using errcode='42501';
 end if;
 if p_email_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' then
   raise exception 'Ungültige Anfrage' using errcode='22023';
 end if;
 insert into private.pyramid_access_link_limits(fingerprint,window_start,attempts)
 values('email:'||p_email_hash,now(),1)
 on conflict(fingerprint) do update
 set window_start=case when private.pyramid_access_link_limits.window_start<now()-interval '3 minutes'
   then now() else private.pyramid_access_link_limits.window_start end,
     attempts=case when private.pyramid_access_link_limits.window_start<now()-interval '3 minutes'
   then 1 else private.pyramid_access_link_limits.attempts+1 end
 returning attempts<=1 into email_allowed;
 insert into private.pyramid_access_link_limits(fingerprint,window_start,attempts)
 values('ip:'||p_ip_hash,now(),1)
 on conflict(fingerprint) do update
 set window_start=case when private.pyramid_access_link_limits.window_start<now()-interval '1 hour'
   then now() else private.pyramid_access_link_limits.window_start end,
     attempts=case when private.pyramid_access_link_limits.window_start<now()-interval '1 hour'
   then 1 else private.pyramid_access_link_limits.attempts+1 end
 returning attempts<=10 into ip_allowed;
 return email_allowed and ip_allowed;
end;
$$;
revoke all on function public.pyramid_access_link_allow(text,text) from public,anon,authenticated;
grant execute on function public.pyramid_access_link_allow(text,text) to service_role;
