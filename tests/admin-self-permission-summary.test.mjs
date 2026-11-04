import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeSelfPermissions } from '../src/lib/self-permissions.mjs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const teams=[{id:'a',name:'Herren'},{id:'b',name:'Jugend'},{id:'c',name:'Damen'}];
const example={userId:'me',profile:{global_role:'user',global_permissions:[]},teams,memberships:[]};

test('self-rights: other users and inactive memberships never appear',()=>{
 const r=describeSelfPermissions({...example,memberships:[
 {user_id:'someone-else',team_id:'a',role:'manager',active:true},
 {user_id:'me',team_id:'b',role:'editor',active:false},
 {user_id:'me',team_id:'c',role:'ticker',active:true},
 ]});
 assert.deepEqual(r.teamRights.map(t=>t.name),['Damen']);
 assert.equal(r.teamRights[0].editTeam,false);
 assert.equal(r.teamRights[0].editTicker,true);
 assert.deepEqual(r.globals,[]);
});

test('self-rights: manager/editor can edit their teams, ticker only assigned ticker',()=>{
 const r=describeSelfPermissions({...example,memberships:[
 {user_id:'me',team_id:'a',role:'manager',active:true},
 {user_id:'me',team_id:'b',role:'editor',active:true},
 {user_id:'me',team_id:'c',role:'ticker',active:true},
 ]});
 assert.deepEqual(r.teamRights.map(x=>[x.name,x.roleName,x.editTeam]),[
 ['Damen','Ticker',false],['Herren','Manager',true],['Jugend','Editor',true],
 ]);
 assert.equal(r.hasEditRights,true);
});

test('self-rights: global grants are independent of team memberships',()=>{
 const r=describeSelfPermissions({...example,profile:{global_role:'user',global_permissions:['events','ticker']}});
 assert.deepEqual(r.globals.map(g=>g.key),['events','ticker']);
 assert.deepEqual(r.teamRights,[]);
 assert.equal(r.hasEditRights,true);
});

test('self-rights: super admins have full access; ordinary users without grants see no editing rights',()=>{
 const admin=describeSelfPermissions({...example,profile:{global_role:'super_admin',global_permissions:[]}});
 assert.equal(admin.superAdmin,true);
 assert.equal(admin.hasEditRights,true);
 const standard=describeSelfPermissions(example);
 assert.equal(standard.hasEditRights,false);
 assert.equal(standard.superAdmin,false);
});

test('self-rights display only within authenticated admin app and account',()=>{
 const page=read('src/pages/admin/index.astro');
 const script=read('src/scripts/admin.ts');
 const css=read('src/styles/global.css');
 assert.equal((page.match(/data-self-permissions-summary/g)||[]).length,2);
 assert.ok(page.indexOf('data-self-permissions-summary')>page.indexOf('<section id="admin-app"'));
 assert.equal((page.match(/aria-label="Meine gespeicherten Berechtigungen"/g)||[]).length,2);
 assert.ok(!page.includes('self-permissions-card__head'),'Old duplicate summary heading must not appear');
 assert.ok(page.includes('id="admin-my-rights-link"'));
 assert.match(script,/await loadCore\(\);\s*renderMyPermissions\(\)/);
 assert.match(script,/document\.querySelectorAll<HTMLElement>\('\[data-self-permissions-summary\]'\)/);
 assert.match(script,/navigateToPanel\('account'\)/);
 assert.match(script,/renderStoredUserPermissions\(ownUser, state, false\)/);
 assert.match(script,/team_memberships: rights\.teamRights\.map/);
 assert.match(script,/import \{[^\n]*renderStoredUserPermissions \} from '\.\/admin-advanced'/);
 const shared=read('src/scripts/admin-advanced.ts');
 assert.match(shared,/export function renderStoredUserPermissions\(user: Row, base: BaseState, editing = true\)/);
 assert.match(shared,/Aktuell vergebene Berechtigungen/);
 assert.match(shared,/In Supabase gespeichert/);
 assert.match(shared,/user-rights-summary__tags/);
 assert.match(shared,/user-rights-summary__teams/);
 assert.match(css,/@media\(max-width:600px\)\{[\s\S]*?\.user-rights-summary__team\{flex-basis:100%\}/);
});

test('self rights use identical card markup as super admin and exclude other users',()=>{
 const script=read('src/scripts/admin.ts');
 const shared=read('src/scripts/admin-advanced.ts');
 const page=read('src/pages/admin/index.astro');
 const impl=script.slice(script.indexOf('function renderMyPermissions()'),script.indexOf('function hasGlobalPermission'));
 assert.match(impl,/userId: state\.user\.id/);
 assert.match(impl,/memberships: state\.memberships/);
 assert.match(impl,/renderStoredUserPermissions\(ownUser, state, false\)/);
 assert.match(shared,/const memberships = \(Array\.isArray\(user\.team_memberships\)/);
 assert.equal((page.match(/data-self-permissions-summary/g)||[]).length,2);
 assert.doesNotMatch(page,/self-permissions-card/);
});
