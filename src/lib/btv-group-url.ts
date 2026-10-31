/** Safely links to the official BTV table/schedule of a single team season.
 * Never guess a group ID; an absent/invalid ID becomes an absent link.
 */
export function officialBtvGroupUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.hostname !== 'www.btv.de' ||
        u.pathname !== '/de/spielbetrieb/tabelle-spielplan.html') return null;
    const groupId = u.searchParams.get('groupid');
    if (!groupId || !/^\d{7,8}$/.test(groupId)) return null;
    return 'https://www.btv.de/de/spielbetrieb/tabelle-spielplan.html?groupid=' + groupId;
  } catch { return null; }
}

/** BTV recommends a permanent club page when a seasonal group deep link is not confirmed. */
export const OFFICIAL_BTV_CLUB_URL =
  'https://www.btv.de/de/mein-verein/vereinsseite/tsv-feldkirchen.html#Mannschaften';

export function officialBtvTeamDestination(verifiedUrl: unknown): {href: string; isDirect: boolean} {
  const direct = officialBtvGroupUrl(verifiedUrl);
  return { href: direct || OFFICIAL_BTV_CLUB_URL, isDirect: !!direct };
}
