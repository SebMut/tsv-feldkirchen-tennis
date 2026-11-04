import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const r = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=r('src/pages/admin/index.astro');
const js=r('src/scripts/admin.ts');
const css=r('src/styles/global.css');

test('admin navigation is located above all panels, with category dropdowns and preserved role attributes',()=>{
 const nav=page.split('<nav class="card admin-nav"')[1].split('</nav>')[0];
 assert.ok(page.indexOf('<nav class="card admin-nav"')<page.indexOf('<section id="panel-dashboard"'));
 for(const name of ['spielbetrieb','inhalte','verwaltung']){
   assert.match(nav,new RegExp('<details class="admin-nav__group admin-nav__dropdown" data-admin-nav-group="'+name+'">'));
 }
 for(const panel of ['dashboard','matches','teams','players','news','galleries','users','operations','audit','settings','account']){
   assert.ok(nav.includes('data-panel="'+panel+'"'),panel);
 }
 for(const capability of ['data-super-only','data-editor-only','data-editorial-only','data-ticker-only'])
   assert.ok(nav.includes(capability),capability);
 assert.match(nav,/<summary class="admin-nav__label">Verwaltung<\/summary>/);
 assert.match(css,/\.admin-nav__group\[data-admin-nav-group="start"\]>\.admin-nav__label\{display:none\}/);
 assert.doesNotMatch(nav,/admin-nav__brand/);
 assert.match(nav,/aria-label="Verwaltungsbereiche"/);
 assert.match(page,/id="admin-current-group"/);
 assert.match(page,/id="admin-panel-select"/);
});
test('dropdowns keep existing panel routing, keyboard dismissal and responsive mobile picker',()=>{
 assert.match(js,/dropdowns\.forEach\(\(menu\) =>/);
 assert.match(js,/menu\.addEventListener\('toggle'/);
 assert.match(js,/event\.key !== 'Escape'/);
 assert.match(js,/menu\.classList\.toggle\('has-active', menu\.contains\(activeButton\)\)/);
 assert.match(js,/picker\.addEventListener\('change', \(\) => navigateToPanel\(picker\.value\)\)/);
 assert.match(js,/navigateToPanel\(button\.dataset\.panel\)/);
 assert.match(js,/currentGroup\.textContent = activeButton\.closest/);
 assert.match(js,/document\.getElementById\('admin-app'\)\?\.scrollIntoView/);
 assert.match(css,/display:flex;align-items:center;justify-content:flex-start;flex-wrap:nowrap/);
 assert.match(css,/position:sticky;top:82px/);
 assert.match(css,/\.admin-shell\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.admin-nav__dropdown:not\(\[open\]\)>\.admin-nav__items\{display:none\}/);
 assert.match(css,/@media\(max-width:980px\)[\s\S]*?\.admin-nav\.card\{display:none\}/);
});
