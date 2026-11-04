import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../' + path,import.meta.url),'utf8');

test('invite validates teams before sending email and sets roles atomically afterwards',()=>{
 const source=read('supabase/functions/admin-users/index.ts');
 const invite=source.split('if (action === "invite") {')[1].split('if (action === "memberships")')[0];
 assert.match(invite,/uniqueMemberships\.size/);
 assert.ok(invite.indexOf('const { data: validTeams')<invite.indexOf('inviteUserByEmail('));
 assert.match(invite,/admin\.rpc\("admin_apply_user_permissions"/);
 assert.match(invite,/desired_memberships: \[\.\.\.uniqueMemberships\.values\(\)\]/);
 assert.match(invite,/code: "invitation_partially_created"/);
 assert.match(invite,/Nicht erneut einladen/);
 assert.doesNotMatch(invite,/admin\.from\("team_memberships"\)\.upsert/);
});
test('UI does not recommend repeat sends when server response failed after mail delivery',()=>{
 const admin=read('src/scripts/admin.ts');
 const advanced=read('src/scripts/admin-advanced.ts');
 const helper=read('src/lib/admin-function-errors.ts');
 assert.match(admin,/Die E-Mail könnte bereits zugestellt worden sein/);
 assert.match(admin,/data\?\.ok !== true/);
 assert.match(advanced,/Bitte erst den Posteingang prüfen/);
 assert.match(advanced,/button\.disabled = true/);
 assert.match(helper,/FunctionsHttpError/);
 assert.match(helper,/error\.context\.clone\(\)\.json\(\)/);
});
