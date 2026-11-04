/** Explanatory view model only. Real authorization remains enforced by Supabase/RLS. */
export function describeSelfPermissions({ userId, profile, teams = [], memberships = [] }) {
  const superAdmin = profile?.global_role === 'super_admin';
  const granted = new Set(Array.isArray(profile?.global_permissions) ? profile.global_permissions : []);
  const globals = superAdmin ? [] : [
    granted.has('news') && { key: 'news', name: 'News', detail: 'Beiträge erstellen und bearbeiten' },
    granted.has('events') && { key: 'events', name: 'Veranstaltungen', detail: 'Termine und Anmeldungen verwalten' },
    granted.has('ticker') && { key: 'ticker', name: 'Liveticker', detail: 'Ticker aller Mannschaften bearbeiten' },
  ].filter(Boolean);
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
