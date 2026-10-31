// Server-side one-time TSV Feldkirchen roster import.
// Only verified adult and youth NAME fields, no birth data, LK, player IDs or raw PDFs.
// Never run from a public page; the service key exists only inside GitHub Actions.
import { assertVerifiedSummerSnapshot, CONFIRMED_SUMMER_CLASSES } from './btv-roster-pdf-parser.mjs';
import { rosterTeams, planPrivateRosterImport } from './btv-roster-age-classes.mjs';

const PROJECT = 'https://eaurnufdochjapfzqwvm.supabase.co';
const SEASON = 'sommer-2026';
const normalize = value => String(value).normalize('NFKC')
  .replace(/\s+/gu, ' ').trim().toLocaleLowerCase('de-DE');

export function buildPrivateRosterPlan(parsed, availableTeamSlugs) {
  assertVerifiedSummerSnapshot(parsed);
  const players = new Map();
  const pairs = new Map();
  for (const ageClass of CONFIRMED_SUMMER_CLASSES) {
    const selection = planPrivateRosterImport({
      seasonCode: SEASON, ageClass, names: parsed.rows[ageClass],
      existingTeams: availableTeamSlugs,
    });
    for (const name of selection.names) {
      const id = normalize(name);
      if (!players.has(id)) players.set(id, name);
      for (const slug of rosterTeams(ageClass, SEASON)) {
        pairs.set(slug + '|' + id, {slug, nameKey:id});
      }
    }
  }
  if (players.size < 50 || players.size > 250 || pairs.size < players.size || pairs.size > 900) {
    throw Error('ROSTER_IMPORT_PLAN_OUT_OF_RANGE');
  }
  return { players, pairs:[...pairs.values()] };
}

export async function importVerifiedPrivateRosters(parsed, secretKey) {
  if (process.env.BTV_ROSTER_WRITE_ENABLED !== 'true') throw Error('ROSTER_WRITE_NOT_ENABLED');
  if (!secretKey) throw Error('ROSTER_SERVICE_KEY_MISSING');

  // Do source validation before creating the server client or writing any rows.
  assertVerifiedSummerSnapshot(parsed);
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(PROJECT, secretKey, {
    auth: { persistSession:false, autoRefreshToken:false },
    global: { headers: { 'X-Client-Info':'tsv-btv-nmm-once' } },
  });
  const read = async (query, errorCode) => {
    const { data, error } = await query;
    if (error || !Array.isArray(data)) throw Error(errorCode);
    return data;
  };
  const seasons = await read(db.from('seasons').select('id,code').eq('code', SEASON), 'SEASON_LOOKUP_FAILED');
  if (seasons.length !== 1) throw Error('SEASON_NOT_UNIQUE');
  const [teams, memberships, existingPlayers] = await Promise.all([
    read(db.from('teams').select('id,slug').limit(500), 'TEAM_LOOKUP_FAILED'),
    read(db.from('team_seasons').select('id,team_id,season_id').eq('season_id', seasons[0].id).limit(500),
      'TEAM_SEASONS_LOOKUP_FAILED'),
    read(db.from('players').select('id,display_name').limit(2000), 'PLAYERS_LOOKUP_FAILED'),
  ]);
  if (teams.length >= 500 || memberships.length !== 20 || existingPlayers.length >= 2000) {
    throw Error('ROSTER_DATABASE_SHAPE_UNEXPECTED');
  }
  const byTeamId = new Map(teams.map(t => [t.id, t.slug]));
  const teamSeasons = new Map(memberships.map(row => [byTeamId.get(row.team_id), row.id]));
  if (teamSeasons.size !== 20 || [...teamSeasons.keys()].some(x => !x)) {
    throw Error('ROSTER_TEAM_SEASON_MAPPING_INVALID');
  }
  const planned = buildPrivateRosterPlan(parsed, [...teamSeasons.keys()]);
  const existingByName = new Map();
  for (const player of existingPlayers) {
    const k = normalize(player.display_name);
    if (existingByName.has(k)) throw Error('AMBIGUOUS_EXISTING_NAME');
    existingByName.set(k, player.id);
  }
  const newNames = [...planned.players.entries()]
    .filter(([k]) => !existingByName.has(k)).map(([,name]) => ({ display_name:name,active:true }));
  const existingMemberships = await read(db.from('team_players')
    .select('team_season_id,player_id')
    .in('team_season_id', [...teamSeasons.values()]).limit(3000), 'ROSTER_EXISTING_MEMBERSHIPS_FAILED');
  if (existingMemberships.length >= 3000) throw Error('ROSTER_MEMBERSHIPS_TOO_MANY');

  // The entire name batch inserts in one PostgREST request. Retry can safely
  // resume the second (membership) batch by re-reading existing rows.
  if (newNames.length) {
    const inserted = await read(db.from('players').insert(newNames)
      .select('id,display_name'), 'ROSTER_PLAYER_INSERT_FAILED');
    if (inserted.length !== newNames.length) throw Error('ROSTER_PLAYER_INSERT_COUNT_MISMATCH');
    for (const row of inserted) existingByName.set(normalize(row.display_name), row.id);
  }
  const existingPairs = new Set(existingMemberships.map(row => row.team_season_id + '|' + row.player_id));
  const toInsert = [];
  for (const assignment of planned.pairs) {
    const playerId = existingByName.get(assignment.nameKey);
    const teamSeasonId = teamSeasons.get(assignment.slug);
    if (!playerId || !teamSeasonId) throw Error('ROSTER_ID_MAPPING_INVALID');
    const key = teamSeasonId + '|' + playerId;
    if (existingPairs.has(key)) continue;
    existingPairs.add(key);
    // The schema's default for public_visible is TRUE. Always set FALSE.
    toInsert.push({
      team_season_id:teamSeasonId, player_id:playerId,
      public_visible:false, is_captain:false,
    });
  }
  if (toInsert.length) {
    const inserted = await read(db.from('team_players').insert(toInsert)
      .select('id'), 'ROSTER_MEMBERSHIP_INSERT_FAILED');
    if (inserted.length !== toInsert.length) throw Error('ROSTER_MEMBERSHIP_COUNT_MISMATCH');
  }
  return {
    ageClasses:CONFIRMED_SUMMER_CLASSES.length,
    distinctNames:planned.players.size, newPlayers:newNames.length,
    newMemberships:toInsert.length, totalMemberships:planned.pairs.length,
    privateByDefault:true,
  };
}
