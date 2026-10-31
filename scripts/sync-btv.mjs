// Six-hourly BTV schedule monitor for TSV Feldkirchen (01012).
// Safe by default: --apply plus BTV_IMPORT_ENABLED=true and server-only key
// required for *any* DB access. Never retries or bypasses BTV rate limits.
import { getClubSchedule, normalizedName } from './btv-schedule.mjs';

const apply = process.argv.includes('--apply');
const year = Number(process.env.BTV_SEASON_YEAR || 2026);
if (!Number.isInteger(year) || year < 2025 || year > 2100) throw new Error('Invalid BTV season year');
if (apply && process.env.BTV_IMPORT_ENABLED !== 'true') throw new Error('BTV_IMPORT_ENABLED=true is required to write');
const schedule = await getClubSchedule(year);
const counts = new Map();
for (const fixture of schedule.fixtures) counts.set(fixture.slug, (counts.get(fixture.slug) || 0) + 1);
console.log(`BTV ${year} / TSV 01012: ${schedule.fixtures.length} fixtures, ${counts.size} teams, ${schedule.pages} PDF pages.`);
if (year === 2026 && counts.size !== 20) throw new Error('Expected exactly 20 TSV teams; stopping');
if (!apply) {
  console.log('PREVIEW ONLY: source verified; no Supabase access and no news published.');
  process.exit(0);
}

const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('BTV_SUPABASE_SECRET_KEY is not configured; no database changes');
const { createClient } = await import('@supabase/supabase-js');
const db = createClient('https://eaurnufdochjapfzqwvm.supabase.co', key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { 'X-Client-Info': 'tsv-btv-6h-sync' } },
});
const get = async (query, name) => {
  const { data, error } = await query;
  if (error) throw new Error(`${name}: ${error.message}`);
  return data ?? [];
};
const identity = (seasonId, home, opponent) =>
  [seasonId, home ? 'H' : 'A', normalizedName(opponent)].join('|');
const report = {
  source_fixture_count: schedule.fixtures.length,
  existing_count: 0, inserted_count: 0, updated_count: 0,
  skipped_count: 0, rescheduled_count: 0, news_count: 0, conflicts_count: 0,
};
let runId = null;
try {
  const [seasons, teams, teamSeasons] = await Promise.all([
    get(db.from('seasons').select('id,year').eq('year', year), 'Seasons'),
    get(db.from('teams').select('id,slug'), 'Teams'),
    get(db.from('team_seasons').select('id,team_id,season_id,btv_url'), 'Team seasons'),
  ]);
  if (seasons.length !== 1) throw new Error('No single configured season for ' + year);
  const teamsBySlug = new Map(teams.map(team => [team.slug, team]));
  const registered = new Map(teamSeasons
    .filter(row => row.season_id === seasons[0].id).map(row => [row.team_id, row]));
  const missing = [...counts.keys()].filter(slug =>
    !teamsBySlug.has(slug) || !registered.has(teamsBySlug.get(slug).id));
  if (missing.length) throw new Error('Unmapped TSV season teams: ' + missing.join(', '));

  const ids = [...registered.values()].map(row => row.id);
  const existing = await get(db.from('matches')
    .select('id,team_season_id,opponent,is_home,starts_at,btv_source_key,btv_imported')
    .in('team_season_id', ids), 'Existing matches');
  const keyed = new Map(existing.filter(row => row.btv_source_key)
    .map(row => [row.btv_source_key, row]));
  const byIdentity = new Map();
  const countPerSeason = new Map();
  for (const row of existing) {
    countPerSeason.set(row.team_season_id, (countPerSeason.get(row.team_season_id) || 0) + 1);
    const key = identity(row.team_season_id, row.is_home, row.opponent);
    byIdentity.set(key, [...(byIdentity.get(key) || []), row]);
  }
  // Repeated meetings of the same opponents on the same side are ambiguous
  // and cannot safely be assigned by a date-independent fixture key.
  const sourceIdentities = new Map();
  for (const fixture of schedule.fixtures) {
    const seasonId = registered.get(teamsBySlug.get(fixture.slug).id).id;
    const key = identity(seasonId, fixture.isHome, fixture.opponent);
    sourceIdentities.set(key, (sourceIdentities.get(key) || 0) + 1);
  }

  const baselineRows = [], candidates = [], unresolved = [];
  for (const fixture of schedule.fixtures) {
    const teamId = teamsBySlug.get(fixture.slug).id;
    const season = registered.get(teamId);
    const matchKey = identity(season.id, fixture.isHome, fixture.opponent);
    const same = byIdentity.get(matchKey) || [];
    const specific = keyed.get(fixture.sourceKey);
    let matched = null;
    if (specific && specific.team_season_id === season.id) matched = specific;
    else if (same.length === 1 && sourceIdentities.get(matchKey) === 1) matched = same[0];
    else if (same.length > 1 || sourceIdentities.get(matchKey) > 1) {
      unresolved.push(fixture.slug + ': ' + fixture.opponent + ' (mehrdeutig)');
      report.conflicts_count++;
    }

    if (!matched && !same.length && sourceIdentities.get(matchKey) === 1) {
      // Existing seasons curated by club volunteers (2026) are protected.
      // Future newly created seasons with no games may import complete fixtures.
      if ((countPerSeason.get(season.id) || 0) === 0) {
        candidates.push({
          team_season_id: season.id, opponent: fixture.opponent,
          is_home: fixture.isHome, starts_at: fixture.startsAt,
          ends_at: null, match_type: 'league',
          lineup_format: fixture.four ? '4_2' : '6_3',
          is_published: true, external_url: season.btv_url || null,
          btv_imported: true, btv_source_key: fixture.sourceKey,
          btv_last_synced_at: new Date().toISOString(),
          btv_result_text: fixture.score,
        });
      } else {
        unresolved.push(fixture.slug + ': ' + fixture.opponent + ' (manuell gepflegte Saison)');
        report.skipped_count++;
      }
    }
    if (matched) report.existing_count++;
    baselineRows.push({
      season_year: year, source_key: fixture.sourceKey,
      team_season_id: season.id, match_id: matched?.id || null,
      opponent: fixture.opponent, is_home: fixture.isHome,
      starts_at: fixture.startsAt, source_url: schedule.sourceUrl,
      last_seen_at: new Date().toISOString(),
    });
  }

  if (existing.length && candidates.length > 30) throw new Error('Unexpected number of new fixtures');
  if (unresolved.length > 20) throw new Error('Too many ambiguous fixtures: ' + unresolved.length);
  const startedAt = new Date().toISOString();
  const { data: run, error: startError } = await db.from('btv_import_runs')
    .insert({ season_year: year, source_url: schedule.sourceUrl, ...report, started_at: startedAt })
    .select('id').single();
  if (startError) throw new Error('Cannot start import log: ' + startError.message);
  runId = run.id;

  // Only unmatched fixtures for brand-new (empty) team seasons may be inserted.
  // We never delete existing matches or change result/ticker fields.
  for (const fixture of candidates) {
    const { data: inserted, error } = await db.from('matches').insert(fixture).select('id').single();
    if (error?.code === '23505') continue;
    if (error) throw new Error('New fixture insert failed: ' + error.message);
    report.inserted_count++;
    const row = baselineRows.find(row => row.source_key === fixture.btv_source_key);
    if (row) row.match_id = inserted.id;
  }

  // First insert = baseline, no news; subsequent timestamp difference =
  // atomic Supabase trigger that updates only safe match dates and inserts
  // an independently published story linked to the affected match.
  // One single upsert avoids partial baseline/news history commits.
  const { error: snapshotError } = await db.from('btv_fixture_snapshots')
    .upsert(baselineRows, { onConflict: 'season_year,source_key' });
  if (snapshotError) throw new Error('Snapshot comparison failed: ' + snapshotError.message);
  const changes = await get(db.from('btv_schedule_changes')
    .select('id,status,news_id').eq('season_year', year).gte('detected_at', startedAt),
  'Schedule changes');
  report.rescheduled_count = changes.filter(row => row.status === 'published').length;
  report.news_count = changes.filter(row => row.news_id).length;
  report.conflicts_count += changes.filter(row => row.status === 'protected' || row.status === 'unmatched').length;

  const { error: endError } = await db.from('btv_import_runs').update({
    ...report, status: 'success', completed_at: new Date().toISOString(),
  }).eq('id', runId);
  if (endError) throw new Error('Could not finalize schedule sync: ' + endError.message);
  console.log('BTV 6H SUCCESS:', JSON.stringify(report));
  if (unresolved.length) console.log('Needs editorial review:', unresolved.slice(0, 15));
} catch (error) {
  console.error('BTV SYNC FAILED:', String(error.message || error));
  if (runId) await db.from('btv_import_runs').update({
    ...report, status: 'failed', completed_at: new Date().toISOString(),
    error_message: String(error.message || error).slice(0, 480),
  }).eq('id', runId);
  process.exitCode = 1;
}
