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
  const context = vm.createContext({document,window:node(),navigator:{platform:'Mac'},matchMedia:()=>media,localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},observeWorkspaceChanges:()=>()=>{}});
  vm.runInContext(readFileSync('public/workspace-state.js','utf8'),context);
  vm.runInContext(readFileSync('public/profiles/request.js','utf8').replace(/^export /gm,''),context);
  vm.runInContext(readFileSync('public/dashboard/workspace.js','utf8').replace(/^import .*\n/gm,'').replace('export function updateWorkspace','function updateWorkspace'),context);
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

test('a saved change refreshes global search and the selected novel breadcrumb', async () => {
 const novelId='d1bf0371-9115-4d74-9903-77831ca6bd47';
 let title='Original title',changed,stopped=false;
 const node=()=>({children:[],handlers:{},dataset:{},attrs:{},value:'',hidden:false,
  addEventListener(type,handler){(this.handlers[type]??=[]).push(handler);},
  setAttribute(name,value){this.attrs[name]=value;},
  replaceChildren(...children){this.children=children;},
  append(...children){this.children.push(...children);},
  contains(){return false;},focus(){},select(){},closest(){return null}
 });
 const elements=new Map(['#novel-search','#search-results','#search-list','#search-status','.workspace-search kbd','.sidebar-toggle','#workspace-sidebar','.workspace-context'].map(selector=>[selector,node()]));
 const document={...node(),documentElement:node(),body:{classList:{contains:()=>false}},
  querySelector:selector=>elements.get(selector),createElement:()=>node()};
 const window=node(),media={...node(),matches:false};
 const response=data=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>data});
 const context=vm.createContext({document,window,navigator:{platform:'Mac'},matchMedia:()=>media,
  localStorage:{setItem(){}},location:{href:'https://novel.example/characters/?novel='+novelId},URL,
  observeWorkspaceChanges(callback){changed=callback;return()=>{stopped=true;}},
  searchCatalog(catalog,query){return catalog.novels.filter(record=>record.title.includes(query)).map(record=>({name:record.title,href:'/novels/'+record.id+'/',label:'Novel'}));},
  fetch:async url=>response(url.startsWith('/api/dashboard')?{novels:[{id:novelId,title}]}:{title})
 });
 vm.runInContext(readFileSync('public/profiles/request.js','utf8').replace(/^export /gm,''),context);
 vm.runInContext(readFileSync('public/dashboard/workspace.js','utf8').replace(/^import .*\n/gm,'').replace('export function updateWorkspace','function updateWorkspace'),context);
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 await flush();
 const breadcrumb=elements.get('.workspace-context').children[2];
 assert.equal(breadcrumb.textContent,'Original title');
 const searchInput=elements.get('#novel-search');searchInput.value='title';
 searchInput.handlers.input[0]();await flush();
 assert.equal(elements.get('#search-list').children[0].children[0].children[0].children[0].textContent,'Original title');
 title='Revised title';changed();await flush();
 assert.equal(breadcrumb.textContent,'Revised title');
 assert.equal(elements.get('#search-list').children[0].children[0].children[0].children[0].textContent,'Revised title');
 window.handlers.pagehide[0]({persisted:false});assert.equal(stopped,true);
});

test('the workspace gives every page asset one coherent revision',()=>{
 const html=workspaceShell('<!doctype html><html><head><link rel="stylesheet" href="/profiles/profile.css?v=old"><script type="module" src="/profiles/editor.js?v=old"></script></head><body></body></html>','/characters/example/');
 const urls=[...html.matchAll(/(?:href|src)="(\/(?:[^" ]+)\.(?:css|js)\?v=([^"]+))"/g)];
 assert.ok(urls.length>=5);assert.equal(new Set(urls.map(match=>match[2])).size,1);assert.equal(urls[0][2],'dev');
});
