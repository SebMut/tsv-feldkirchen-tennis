import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const baseSql=read('supabase/migrations/20261108153000_forderungspyramide_staging.sql');
const sql=read('supabase/migrations/20261108173000_pyramid_permissions_and_auto_decline.sql');
const admin=read('src/scripts/admin.ts');
const advanced=read('src/scripts/admin-advanced.ts');
const adminPage=read('src/pages/admin/index.astro');
const member=read('src/scripts/pyramid.ts');

test('pyramid staging migrations retain valid SQL dollar quoting and never run on production',()=>{
 for(const [file,text] of [['base',baseSql],['permissions',sql]]){
  assert.equal((text.match(/\bas \$\$/g)||[]).length,(text.match(/\n\$\$;/g)||[]).length,file);
  assert.doesNotMatch(text,/as \$\n/,'No truncated dollar quotes');
 }
 assert.equal((sql.match(/\$function\$/g)||[]).length,2);
 assert.match(sql,/\$function\$;/);
 assert.match(baseSql,/private\.pyramid_valid_winning_score\(p_score\)/);
 assert.match(baseSql,/pyramid_finalize_seed/);
});

test('SuperAdmin can delegate a dedicated global pyramid permission like events',()=>{
 assert.match(sql,/profiles_global_permissions_allowed/);
 assert.match(sql,/array\['events','news','ticker','pyramid'\]/);
 assert.match(sql,/array\['news','events','ticker','pyramid'\]/);
 assert.match(sql,/private\.has_global_permission\('pyramid'\)/);
 assert.match(sql,/create or replace function private\.can_manage_pyramid\(\)/);
 assert.match(sql,/if not private\.can_manage_pyramid\(\)/);
 assert.match(sql,/pyramid_requests_read/);
 const backend=read('supabase/functions/admin-users/index.ts');
 assert.match(backend,/allowedGlobalPermissions = new Set\(\["events", "news", "ticker", "pyramid"\]\)/);
 assert.match(backend,/const pyramid = superAdmin \|\| permissions\.has\("pyramid"\)/);
 assert.match(advanced,/value="\$\{permission\}"/);
 assert.match(advanced,/\['pyramid','Forderungspyramide verwalten'\]/);
 assert.match(advanced,/\['pyramid', 'Forderungspyramide verwalten'\]/);
 assert.match(read('src/lib/self-permissions.mjs'),/granted\.has\('pyramid'\)/);
});

test('own Admin panel is shown only to pyramid permission holders',()=>{
 assert.match(adminPage,/data-panel="pyramid" data-pyramid-only/);
 assert.match(adminPage,/id="panel-pyramid"/);
 assert.match(adminPage,/id="pyramid-admin-create"/);
 assert.match(adminPage,/id="pyramid-admin-pending"/);
 assert.match(adminPage,/id="pyramid-admin-result"/);
 assert.match(admin,/hasGlobalPermission\('pyramid'\)/);
 assert.match(admin,/initPyramidAdmin\(canPyramid\)/);
 assert.match(admin,/data-pyramid-only/);
 assert.match(admin,/if \(name === 'pyramid' && !hasGlobalPermission\('pyramid'\)\) return/);
 const manager=read('src/scripts/admin-pyramid.ts');
 for(const rpc of ['pyramid_approve_join','pyramid_move_entry','pyramid_finalize_seed','pyramid_report_result'])
  assert.match(manager,new RegExp(rpc));
});

test('acceptance atomically declines other pending challenges to both players',()=>{
 assert.match(sql,/for update/);
 assert.match(sql,/create or replace function public\.pyramid_respond/);
 assert.match(sql,/status='accepted'/);
 assert.match(sql,/where ladder_id=c\.ladder_id and id<>c\.id and status='pending'/);
 assert.match(sql,/defender_id in \(c\.challenger_id,c\.defender_id\)/);
 assert.match(sql,/or challenger_id in \(c\.challenger_id,c\.defender_id\)/);
 assert.match(sql,/decline_reason='another_match_accepted'/);
 assert.match(sql,/insert into private\.pyramid_auto_decline_notices\(challenge_id\)/);
 assert.match(sql,/select id from rejected on conflict\(challenge_id\) do nothing/);
 assert.match(baseSql,/status='accepted'/);
 assert.match(baseSql,/Diese Person hat bereits ein angesetztes Spiel/);
 assert.match(member,/c\.status==='accepted'/);
 assert.match(member,/function canSendChallenge/);
});

test('rejected challengers receive idempotent retryable CI email from existing Gmail sender',()=>{
 const mail=read('supabase/functions/pyramid-auto-decline-email/index.ts');
 const config=read('supabase/config.toml');
 assert.match(sql,/unique references public\.pyramid_challenges/);
 assert.match(sql,/next_attempt_at/);
 assert.match(sql,/for update skip locked/);
 assert.match(sql,/consume_pyramid_cron_token/);
 assert.match(sql,/claim_pyramid_auto_decline_notice/);
 assert.match(sql,/complete_pyramid_auto_decline_notice/);
 assert.match(sql,/tsv-pyramid-auto-decline-mail/);
 assert.match(sql,/pg_cron|cron\.schedule/);
 assert.match(mail,/GMAIL_CLIENT_ID/);
 assert.match(mail,/GMAIL_REFRESH_TOKEN/);
 assert.match(mail,/Forderung automatisch abgelehnt/);
 assert.match(mail,/TSV FELDKIRCHEN TENNIS/);
 assert.match(mail,/dispatch_token/);
 assert.match(mail,/consume_pyramid_cron_token/);
 assert.match(mail,/claim_pyramid_notification/);
 assert.match(mail,/complete_pyramid_auto_decline_notice/);
 assert.match(config,/\[functions\.pyramid-auto-decline-email\][\s\S]*verify_jwt = false/);
 assert.doesNotMatch(mail,/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+/);
});

test('demo allows acceptance by selected defender and simulates auto-email without database writes',()=>{
 assert.match(member,/demoRole\(role:string\)/);
 assert.match(member,/myEntry\(\)\?\.id!==item\.defender_id/);
 assert.match(member,/function demoRespond/);
 assert.match(member,/demoAutomaticMailLog\.push/);
 assert.match(member,/c\.decline_reason='another_match_accepted'/);
 assert.match(member,/function renderDemoMails/);
 assert.match(member,/This browser-only staging simulation|This browser-only/);
 assert.match(read('scripts/pyramid-demo-browser-qa.mjs'),/Forderung gegen Spieler 12 erstellt/);
 assert.match(member,/demoAutomaticMailLog\.push/);
 assert.match(read('scripts/pyramid-demo-browser-qa.mjs'),/pyramid-entry-away/);
 assert.match(read('scripts/pyramid-demo-browser-qa.mjs'),/pending request blocks BOTH players/);
});

test('the administrative result entry is a real modal with X, cancel, Escape and backdrop',()=>{
 const page=read('src/pages/admin/index.astro');
 const code=read('src/scripts/admin-pyramid.ts');
 assert.match(page,/id="pyramid-admin-result-dialog" class="pyramid-dialog"/);
 assert.match(page,/id="pyramid-admin-result-close"/);
 assert.match(page,/id="pyramid-admin-result-cancel"/);
 assert.match(page,/id="pyramid-admin-result-error"/);
 assert.match(page,/id="pyramid-admin-result-open"/);
 assert.match(code,/dialog\.showModal\(\)/);
 assert.match(code,/dialog\?\.close\(\)/);
 assert.match(code,/event\.target===dialog/);
 assert.match(code,/data-pyramid-admin-report/);
 assert.match(code,/reportError/);
 assert.match(page,/import '\.\.\/\.\.\/styles\/pyramid\.css'/);
});
