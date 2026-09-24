import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {workspaceShell} from '../server/workspace-shell.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';

test('every directory and entity profile receives one shared sidebar and header search', async () => {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
  const assets = {};
  for (const path of ['/timeline/']) {
    assets[path+'index.html'] = {content:readFileSync('public'+path+'index.html','utf8'),type:'text/html'};
  }
  const worker = createWorker(assets);
  for (const path of ['/', '/dashboard/', '/characters/', '/factions/', '/locations/', '/timeline/', '/characters/claude/', '/factions/sample-ember/', '/locations/countries/sample-kingdom/', '/locations/cities/sample-capital/']) {
    const response = await worker.fetch(new Request('https://novel.example'+path,{headers:{'oai-authenticated-user-id':'author'}}),{DB:d1Adapter(sqlite)});
    assert.equal(response.status,200,path);
    const html = await response.text();
    assert.equal((html.match(/aria-label="Workspace sidebar"/g)||[]).length,1,path);
    assert.equal((html.match(/id="novel-search"/g)||[]).length,1,path);
    assert.match(html,/<header class="workspace-topbar">[\s\S]*?<search[\s\S]*?<\/search>[\s\S]*?<\/header>/);
    assert.doesNotMatch(html,/workspace-stats|data-count=/);
    const active = path === '/' ? '/dashboard/' : '/'+path.split('/')[1]+'/';
    assert.ok(html.includes(`href="${active}" aria-label="${active === '/dashboard/' ? 'Dashboard' : active === '/characters/' ? 'Characters' : active === '/factions/' ? 'Factions' : active === '/locations/' ? 'Locations' : 'Timeline'}"`));
    assert.equal(workspaceShell(html,path),html,'does not double-wrap pages');
  }
  sqlite.close();
});

import vm from 'node:vm';
function navigationSession(saved = new Map(), mobile = false) {
  const node = () => ({value:'',hidden:false,attrs:{},handlers:{},dataset:{},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);},setAttribute(name,value){this.attrs[name]=value;},contains(){return false;},focus(){},select(){},replaceChildren(){}});
  const elements = new Map(['#novel-search','#search-results','#search-list','#search-status','.workspace-search kbd','.sidebar-toggle','#workspace-sidebar'].map(selector=>[selector,node()]));
  const document = {...node(),documentElement:node(),querySelector:selector=>elements.get(selector)};
  const media = {...node(),matches:mobile};
  const context = vm.createContext({document,window:node(),navigator:{platform:'Mac'},matchMedia:()=>media,localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)}});
  vm.runInContext(readFileSync('public/workspace-state.js','utf8'),context);
  vm.runInContext(readFileSync('public/dashboard/workspace.js','utf8').replace(/^import .*\n/,'').replace('export function updateWorkspace','function updateWorkspace'),context);
  return {document,media,menu:elements.get('.sidebar-toggle'),click(){elements.get('.sidebar-toggle').handlers.click[0]();}};
}
test('sidebar collapse survives navigation and mobile menu does not overwrite desktop preference', () => {
  const saved = new Map();
  const first = navigationSession(saved);
  assert.equal(first.menu.attrs['aria-expanded'],'true');
  first.click();
  assert.equal(first.document.documentElement.dataset.sidebar,'collapsed');
  assert.equal(first.menu.attrs['aria-expanded'],'false');
  const next = navigationSession(saved);
  assert.equal(next.document.documentElement.dataset.sidebar,'collapsed');
  assert.equal(next.menu.attrs['aria-label'],'Expand sidebar');
  const phone = navigationSession(saved,true);
  phone.click();
  assert.equal(phone.document.documentElement.dataset.mobileNav,'open');
  assert.equal(phone.menu.attrs['aria-expanded'],'true');
  for (const listener of phone.document.handlers.keydown) listener({key:'Escape'});
  assert.equal(phone.document.documentElement.dataset.mobileNav,'closed');
  assert.equal(saved.get('wtf-sidebar-collapsed'),'true');
  next.click();
  assert.equal(saved.get('wtf-sidebar-collapsed'),'false');
});
