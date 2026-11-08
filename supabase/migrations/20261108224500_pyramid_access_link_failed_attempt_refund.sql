-- Do not impose a three-minute email lock when our own Auth/Gmail
-- service failed before delivering a message. IP limits remain consumed.
-- Only the Edge worker's service_role may refund a failed operation.
create or replace function public.pyramid_access_link_refund(p_email_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then
   raise exception 'Nur der E-Mail-Dienst darf einen Fehlversuch zurücksetzen'
   using errcode='42501';
 end if;
 if p_email_hash !~ '^[0-9a-f]{64}$' then
   raise exception 'Ungültiger Fingerabdruck' using errcode='22023';
 end if;
 update private.pyramid_access_link_limits
 set attempts=greatest(0,attempts-1)
 where fingerprint='email:'||p_email_hash
   and attempts>0
   and window_start>=now()-interval '3 minutes';
end;
$$;
revoke all on function public.pyramid_access_link_refund(text)
 from public,anon,authenticated;
grant execute on function public.pyramid_access_link_refund(text)
 to service_role;
