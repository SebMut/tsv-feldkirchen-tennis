// Pure Supabase GoTrue verification-token adapter.
// GoTrue's hashed_token is an opaque string; do not assume a specific hash
// alphabet/length, and do not require the auth URL to be on a fixed hostname.
// The generated GoTrue action URL is *never* emailed; only our own URL is.
const types = new Set(['magiclink','signup','invite','recovery','email']);
const opaqueToken = value =>
  typeof value === 'string' && value.length >= 8 && value.length <= 1024
  && !/[\s<>\x00-\x1f\x7f]/.test(value);

export function makePasswordSetupLink(properties, siteUrl) {
  if (!properties || typeof properties !== 'object')
    return {ok:false,reason:'missing_properties'};
  let action = null;
  if (typeof properties.action_link === 'string') {
    try {
      action = new URL(properties.action_link);
      if(action.protocol !== 'https:')return {ok:false,reason:'insecure_action_url'};
    } catch {return {ok:false,reason:'malformed_action_url'};}
  }
  const token = opaqueToken(properties.hashed_token)
    ? properties.hashed_token
    : action?.searchParams.get('token') || null;
  const type = typeof properties.verification_type === 'string'
    ? properties.verification_type
    : action?.searchParams.get('type');
  if (!opaqueToken(token)) return {ok:false,reason:'missing_token'};
  if (!types.has(type)) return {ok:false,reason:'missing_type'};
  if (typeof siteUrl !== 'string' || !siteUrl.startsWith('https://'))
    return {ok:false,reason:'site_url_invalid'};
  const fragment = new URLSearchParams({
    pyramid_token_hash:token,pyramid_token_type:type
  });
  return {ok:true,url:siteUrl+'#'+fragment.toString()};
}
