import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env.PUBLIC_SUPABASE_URL || 'https://eaurnufdochjapfzqwvm.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_HlsXh7GAiHvydk9rTve8Hg_r9PNTjw9';

export const COURTBOOKING_URL =
  import.meta.env.PUBLIC_COURTBOOKING_URL || 'https://tsvfeldkirchen.courtbooking.de/';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function mediaUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

export function calendarFeedUrl(params: Record<string, string> = {}) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/calendar-feed`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}
