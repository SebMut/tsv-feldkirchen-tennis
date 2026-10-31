import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261101000000_private_official_meeting_reports.sql',import.meta.url),'utf8');
test('official result entities have row level security',()=>{
  for(const t of ['official_season_sources','official_team_season_refs','official_meeting_reports','official_report_rubbers','official_import_issues']){
    assert.ok(sql.includes('alter table public.'+t+' enable row level security'));
  }
});
test('reports and lineup details do not modify TSV live ticker',()=>{
  assert.ok(sql.includes('home_participants jsonb'));
  assert.ok(sql.includes('unique(report_id, discipline, position)'));
  assert.ok(!sql.includes('alter table public.match_encounters'));
});
