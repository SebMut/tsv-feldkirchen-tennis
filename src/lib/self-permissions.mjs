/** Explanatory view model only. Real authorization remains enforced by Supabase/RLS. */
/** @typedef {{ key: 'news' | 'events' | 'ticker' | 'pyramid', name: string, detail: string }} GlobalGrant */
/**
 * @param {{
 *   userId: string,
 *   profile: { global_role?: string, global_permissions?: string[] } | null,
 *   teams?: Array<{ id: string, name?: string }>,
 *   memberships?: Array<{ user_id: string, team_id: string, role: string, active: boolean }>
 * }} input
 */
export function describeSelfPermissions({ userId, profile, teams = [], memberships = [] }) {
  const superAdmin = profile?.global_role === 'super_admin';
  const granted = new Set(Array.isArray(profile?.global_permissions) ? profile.global_permissions : []);
  /** @type {GlobalGrant[]} */
  const globals = [];
  if (!superAdmin) {
    if (granted.has('news')) globals.push({ key: 'news', name: 'News', detail: 'Beiträge erstellen und bearbeiten' });
    if (granted.has('events')) globals.push({ key: 'events', name: 'Veranstaltungen', detail: 'Termine und Anmeldungen verwalten' });
    if (granted.has('ticker')) globals.push({ key: 'ticker', name: 'Liveticker', detail: 'Ticker aller Mannschaften bearbeiten' });
    if (granted.has('pyramid')) globals.push({ key: 'pyramid', name: 'Forderungspyramide', detail: 'Ranglisten und Teilnahmen verwalten' });
  }
  const teamNames = new Map(teams.filter(team => team?.id).map(team => [team.id, team.name || 'Mannschaft']));
  const teamRights = superAdmin ? [] : memberships
    .filter(row => row?.active === true && row.user_id === userId &&
      teamNames.has(row.team_id) && ['manager', 'editor', 'ticker'].includes(row.role))
    .map(row => ({
      id: row.team_id,
      name: teamNames.get(row.team_id),
      role: row.role,
      roleName: row.role === 'manager' ? 'Manager' : row.role === 'editor' ? 'Editor' : 'Ticker',
      editTeam: row.role === 'manager' || row.role === 'editor',
      editTicker: true,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'));
  return { superAdmin, globals, teamRights, hasEditRights: superAdmin || globals.length > 0 || teamRights.length > 0 };
}
