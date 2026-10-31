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
