import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createWorker} from '../server/app.js';
import {renderDirectoryPage} from '../server/directory-shell.js';

for(const kind of ['characters','factions','locations','story-arcs'])test(kind+' aliases use one complete directory shell and preserve route boundaries',async()=>{
 const worker=createWorker({}),origin='https://novel.example',pages=[];
 for(const path of ['/'+kind+'/','/'+kind+'/index.html']){
  const response=await worker.fetch(new Request(origin+path),{});assert.equal(response.status,200);
  const html=await response.text();pages.push(html);
  assert.equal((html.match(/data-directory-shell/g)||[]).length,1);assert.equal((html.match(/aria-label="Workspace sidebar"/g)||[]).length,1);
  assert.equal((html.match(/<h1 /g)||[]).length,1);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length);
  for(const hook of ['search','clear','sort','direction','view','count','list','results','empty','reset','error','error-message','retry'])assert.ok(html.includes('data-directory-'+hook),hook);
  if(kind==='characters'){
   assert.ok(html.includes('aria-describedby="character-archive-description"'));assert.ok(html.includes('Character archive is not available yet.'));
   assert.ok(html.includes('/components/character-card/card.css'));
  }else{
   assert.ok(html.includes('<option value="cards">Cards</option>'));
   assert.ok(html.includes('<option value="list">List</option>'));
   assert.ok(html.includes('/components/story-card/card.css'));
   assert.ok(html.includes('/'+kind+'/'+kind+'.css'));
  }
  if(kind==='locations'){
   assert.ok(html.includes('aria-label="Filter location types"'));
   assert.ok(html.includes('id="location-filter-toggle"'));assert.ok(html.includes('aria-controls="location-filter-menu"'));
   assert.ok(html.indexOf('data-directory-direction')<html.indexOf('id="location-filter-toggle"'));
   assert.ok(!html.includes('data-directory-slot="filters"><div class="type-filters"'));
   assert.equal((html.match(/id="new-location-dialog"/g)||[]).length,1);
   assert.ok(html.indexOf('<dialog')>html.indexOf('</main>'));
  }
  assert.ok(!html.includes('/characters/characters.css'));
  const head=await worker.fetch(new Request(origin+path,{method:'HEAD'}),{});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await worker.fetch(new Request(origin+path,{method:'POST'}),{})).status,405);
 }
 assert.equal(pages[0],pages[1]);
 assert.equal((await worker.fetch(new Request(origin+'/'+kind+'?sort=name'),{})).headers.get('location'),origin+'/'+kind+'/?sort=name');
 assert.equal((await worker.fetch(new Request(origin+'/api/'+kind),{})).status,401);
});

test('directory configuration escapes metadata and supports reusable actions, controls and slots',()=>{
 const config={id:'research',title:'Research <entry>',singular:'entry',plural:'entries',eyebrow:'A & B',description:'"Details"',script:'/research.js',styles:['/research.css'],leadingAction:{label:'Open notes',href:'/lore/?collection=notes'},primaryAction:{id:'new-research',label:'New <entry>',icon:'+'},views:[{value:'list',label:'List'}],sorts:[],slots:{filters:'<div id="filter-draft"></div>',toolbarActions:'<button id="toolbar-filter">Filter</button>',dialogs:'<dialog id="create-research"></dialog>'}};
 const html=renderDirectoryPage(config);
 assert.ok(html.includes('Research &lt;entry&gt;'));assert.ok(html.includes('A &amp; B'));assert.ok(html.includes('New &lt;entry&gt;'));assert.ok(html.includes('href="/lore/?collection=notes"'));
 assert.ok(html.includes('data-directory-view'));assert.ok(!html.includes('data-directory-direction'));assert.ok(!html.includes('data-directory-sort>'));
 assert.ok(html.indexOf('data-directory-view')<html.indexOf('id="toolbar-filter"'));
 assert.ok(html.indexOf('/directory/shell.css')<html.indexOf('/research.css'));assert.ok(html.indexOf('<dialog')>html.indexOf('</main>'));
 for(const script of ['https://evil.example/x.js','//evil.example/x.js','/\\evil.example/x.js'])assert.throws(()=>renderDirectoryPage({...config,script}));
 assert.throws(()=>renderDirectoryPage({...config,id:'bad"id'}));
 assert.throws(()=>renderDirectoryPage({...config,primaryAction:{label:'Bad',href:'javascript:alert(1)'}}));
});

function node(){
 const handlers=new Map();return {value:'',hidden:false,disabled:false,textContent:'',dataset:{},attrs:{},children:[],
  addEventListener(type,fn){if(!handlers.has(type))handlers.set(type,new Set());handlers.get(type).add(fn);},
  removeEventListener(type,fn){handlers.get(type)?.delete(fn);},
  dispatch(type,event={}){return [...handlers.get(type)||[]].map(fn=>fn(event));},listeners(type){return handlers.get(type)?.size||0;},
  setAttribute(key,value){this.attrs[key]=value;},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},focus(){this.focused=true;}
 };
}
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function session(){
 const hooks=new Map(['search','sort','view','direction','clear','reset','list','results','count','empty','empty-title','empty-description','error','error-message','retry'].map(name=>[name,node()]));
 hooks.get('sort').value='order';hooks.get('view').value='cards';hooks.get('empty').hidden=true;
 hooks.get('empty').dataset={emptyTitle:'No entries yet',emptyDescription:'Start writing',filteredTitle:'No matches',filteredDescription:'Try another name'};
 const root={...node(),dataset:{singular:'entry',plural:'entries'},querySelector:selector=>hooks.get(selector.slice(16,-1))},window=node();
 const context=vm.createContext({document:{querySelector:()=>root,createElement:()=>node()},window,AbortController,Promise});
 vm.runInContext(readFileSync('public/directory/shell.js','utf8').replace(/^export /gm,'')+'\nglobalThis.mount=initDirectoryShell;globalThis.fetchDirectory=fetchDirectory;',context);
 return {hooks,root,window,context,mount:options=>context.mount({root,autoload:false,...options}),names:()=>Array.from(hooks.get('list').children,item=>item.children[0].textContent)};
}
const select=(records,{query,sort,reversed})=>{const matches=records.filter(r=>r.name.toLowerCase().includes(query.trim().toLowerCase()));if(sort==='name')matches.sort((a,b)=>a.name.localeCompare(b.name));return reversed?matches.reverse():matches;};
const renderItem=record=>({...node(),textContent:record.name});

test('controls preserve source records, update counts, clear focus and dispose replaced views',async()=>{
 const s=session(),records=[{name:'Zulu'},{name:'Alpha'}];let disposed=0;
 const shell=s.mount({load:async()=>records,select,renderItem(record){return {element:renderItem(record),destroy(){disposed++;}};}});await shell.refresh();
 assert.deepEqual(s.names(),['Zulu','Alpha']);assert.equal(s.hooks.get('count').textContent,'1–2 of 2 entries');
 s.hooks.get('sort').value='name';s.hooks.get('sort').dispatch('change');assert.deepEqual(s.names(),['Alpha','Zulu']);assert.equal(records[0].name,'Zulu');
 s.hooks.get('direction').dispatch('click');assert.deepEqual(s.names(),['Zulu','Alpha']);assert.equal(s.hooks.get('direction').attrs['aria-pressed'],'true');
 s.hooks.get('search').value='missing';s.hooks.get('search').dispatch('input');assert.equal(s.hooks.get('empty-title').textContent,'No matches');assert.equal(s.hooks.get('count').textContent,'0 of 2 entries');
 s.hooks.get('reset').dispatch('click');assert.equal(s.hooks.get('search').value,'');assert.equal(s.hooks.get('search').focused,true);
 shell.records[0].name='Beta';shell.render();s.hooks.get('search').value='beta';s.hooks.get('search').dispatch('input');assert.deepEqual(s.names(),['Beta'],'item edits survive filtering');
 s.hooks.get('view').value='list';s.hooks.get('view').dispatch('change');assert.equal(s.hooks.get('list').dataset.view,'list');
 shell.destroy();assert.ok(disposed>0);assert.equal(s.hooks.get('search').listeners('input'),0);assert.equal(s.window.listeners('pageshow'),0);
});

test('initial failures are not empty results; failed refreshes preserve filters and last good cards',async()=>{
 const s=session();let fail=true;
 const shell=s.mount({load:async()=>{if(fail)throw new Error('Offline');return [{name:'Alpha'}];},select,renderItem});
 await shell.refresh();assert.equal(s.hooks.get('empty').hidden,true);assert.equal(s.hooks.get('count').textContent,'Unable to load entries');assert.equal(s.hooks.get('retry').hidden,false);
 fail=false;await s.hooks.get('retry').dispatch('click')[0];s.hooks.get('search').value='alp';s.hooks.get('search').dispatch('input');
 const previous=s.hooks.get('list').children;fail=true;await shell.refresh();assert.equal(s.hooks.get('list').children,previous);assert.equal(s.hooks.get('search').value,'alp');assert.equal(s.hooks.get('search').disabled,false);
 shell.clearError();shell.showError('Creation failed');assert.equal(s.hooks.get('retry').hidden,true);assert.equal(s.hooks.get('error-message').textContent,'Creation failed');shell.destroy();
});

test('a successful directory read does not erase a newer creation failure',async()=>{
 const s=session(),read=defer(),shell=s.mount({load:()=>read.promise,renderItem});
 const pending=shell.refresh();await tick();shell.showError('Creation failed');read.resolve([{name:'Alpha'}]);await pending;
 assert.deepEqual(s.names(),['Alpha']);assert.equal(s.hooks.get('error').hidden,false);assert.equal(s.hooks.get('error-message').textContent,'Creation failed');assert.equal(s.root.dataset.directoryState,'error');
 shell.clearError();assert.equal(s.root.dataset.directoryState,'ready');shell.destroy();
});

test('queued reads discard stale results; teardown aborts late paints; back navigation refreshes once',async()=>{
 const s=session(),first=defer(),second=defer(),late=defer();let reads=0,signal;
 const shell=s.mount({load:options=>{signal=options.signal;return [first.promise,second.promise,late.promise][reads++];},renderItem});
 const pending=shell.refresh();await tick();assert.equal(shell.refresh(),pending);first.resolve([{name:'Stale'}]);await tick();assert.equal(reads,2);assert.deepEqual(s.names(),[]);
 second.resolve([{name:'Fresh'}]);await pending;assert.deepEqual(s.names(),['Fresh']);s.window.dispatch('pageshow',{persisted:false});assert.equal(reads,2);
 s.window.dispatch('pageshow',{persisted:true});await tick();assert.equal(reads,3);shell.destroy();assert.equal(signal.aborted,true);late.resolve([{name:'Late'}]);await tick();assert.deepEqual(s.names(),['Fresh']);
});

test('a renderer failure preserves existing records and disposes incomplete items',async()=>{
 const s=session();let records=[{name:'First'}],fail=false,disposed=0;
 const shell=s.mount({load:async()=>records,renderItem(record){if(fail&&record.name==='Bad')throw new Error('Bad card');return {element:renderItem(record),destroy(){disposed++;}};}});
 await shell.refresh();records=[{name:'Staged'},{name:'Bad'}];fail=true;await shell.refresh();assert.deepEqual(s.names(),['First']);assert.equal(shell.records[0].name,'First');assert.equal(disposed,1);shell.destroy();assert.equal(disposed,2);
});

test('directory reads require JSON, preserve server errors and forward cancellation',async()=>{
 const s=session(),abort=new AbortController();let options;
 s.context.fetch=async(url,input)=>{options=input;return new Response('{"records":[]}',{headers:{'content-type':'application/json'}});};
 await s.context.fetchDirectory('/api/items',{signal:abort.signal});assert.equal(options.signal,abort.signal);assert.equal(options.cache,'no-store');assert.equal(options.credentials,'same-origin');
 s.context.fetch=async()=>new Response('<html>Sign in</html>');await assert.rejects(s.context.fetchDirectory('/api/items'),/sign in again/);
 s.context.fetch=async()=>new Response('{"error":"Private"}',{status:403,headers:{'content-type':'application/json'}});await assert.rejects(s.context.fetchDirectory('/api/items'),/Private/);
});

test('character adapter retains creation IDs across retries, excludes double submits and keeps card edits',async()=>{
 const button=node(),window=node(),calls=[],navigations=[],errors=[];let config,uuid=0,request=defer(),cardOptions;
 const directory={render(){},clearError(){},showError:error=>errors.push(error.message)};
 const context=vm.createContext({document:{querySelector:()=>button},window,location:{hash:'#claude',assign:path=>navigations.push(path),replace:path=>navigations.push(path)},crypto:{randomUUID:()=>String(++uuid)},
  characters:[{id:'claude',provider:'Anthropic'}],selectCharacters:()=>[],fetchDirectory:async()=>({characters:[{id:'claude',name:'Claude'}]}),
  initDirectoryShell:options=>{config=options;return directory;},createCharacterCard:(record,options)=>{cardOptions=options;return record;},
  fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return request.promise;}
 });
 vm.runInContext(readFileSync('public/characters/characters.js','utf8').replace(/^import .*\n/gm,''),context);
 assert.deepEqual(navigations,['/characters/claude/']);const loaded=await config.load({});assert.equal(loaded[0].provider,'Anthropic');config.renderItem(loaded[0]);cardOptions.onUpdate({alignment:'Good'});assert.equal(loaded[0].alignment,'Good');
 const first=button.dispatch('click')[0];button.dispatch('click');assert.equal(calls.length,1);request.resolve(new Response('{"error":"Try again"}',{status:503,headers:{'content-type':'application/json'}}));await first;
 assert.equal(button.disabled,false);assert.deepEqual(errors,['Try again']);request=defer();const retry=button.dispatch('click')[0];assert.equal(calls[1].id,calls[0].id);
 request.resolve(new Response('{"id":"created"}',{headers:{'content-type':'application/json'}}));await retry;assert.equal(navigations.at(-1),'/characters/created/');
 window.dispatch('pageshow',{persisted:true});assert.equal(button.disabled,false);assert.equal(button.textContent,'+ New character');
});


test('external type filters stay active when clearing search and reset through Show all',async()=>{
 const s=session();let filter=true,failed=false;const indices=[];
 const shell=s.mount({load:async()=>{if(failed)throw new Error('Offline');return [];},isFiltered:()=>filter,onReset(){filter=false;},renderItem(record,state,index){indices.push(index);return renderItem(record);}});
 assert.equal(await shell.refresh(),true);assert.equal(s.hooks.get('empty-title').textContent,'No matches');assert.equal(s.hooks.get('reset').hidden,false);
 s.hooks.get('search').value='old';s.hooks.get('clear').dispatch('click');assert.equal(filter,true);assert.equal(s.hooks.get('search').value,'');
 s.hooks.get('reset').dispatch('click');assert.equal(filter,false);assert.equal(s.hooks.get('empty-title').textContent,'No entries yet');assert.equal(s.hooks.get('reset').hidden,true);
 failed=true;assert.equal(await shell.refresh(),false);shell.destroy();
 const loaded=session(),ordered=loaded.mount({load:async()=>[{name:'Second'},{name:'First'}],select,renderItem(record,state,index){indices.push(index);return renderItem(record);}});
 await ordered.refresh();assert.deepEqual(indices,[0,1]);ordered.destroy();
});

test('faction adapter retains retries, guards double creation, and sorts without losing profile details',async()=>{
 const button=node(),window=node(),calls=[],navigations=[],errors=[];let config,request=defer(),uuid=0;
 const directory={clearError(){},showError:error=>errors.push(error.message)};
 const records=[{id:'house',name:'The House',type:'House',motto:'Quiet promises',summary:'Keep the peace'},{id:'guild',name:'The Guild',type:'Guild',location:'Harbor'}];
 const context=vm.createContext({document:{querySelector:()=>button,createElement:()=>node()},window,location:{assign:path=>navigations.push(path)},crypto:{randomUUID:()=>String(++uuid)},
  fetchDirectory:async()=>({factions:records}),initDirectoryShell:options=>{config=options;return directory;},
  createProfileStoryCard:(record,options)=>({record,options}),
  fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return request.promise;}
 });
 vm.runInContext(readFileSync('public/factions/factions.js','utf8').replace(/^import .*\n/gm,''),context);
 assert.deepEqual(await config.load({}),records);
 assert.deepEqual(Array.from(config.select(records,{query:'promises',sort:'order'}),r=>r.id),['house']);
 assert.deepEqual(Array.from(config.select(records,{query:'',sort:'type'}),r=>r.id),['guild','house']);assert.equal(records[0].id,'house');
 assert.deepEqual(Array.from(config.select(records,{query:'',sort:'name',reversed:true}),r=>r.id),['house','guild']);
 const card=config.renderItem(records[0],{},0);assert.equal(card.record.href,'/factions/house/');assert.equal(card.options.contextText,'Quiet promises');assert.equal(card.options.label,'House');assert.equal(card.options.cardClass,'faction-card');assert.equal(card.options.sections.length,4);assert.equal(card.options.sections[3].hash,'ratings');
 const first=button.dispatch('click')[0];button.dispatch('click');assert.equal(calls.length,1);assert.equal(calls[0].blank,true);
 request.resolve(new Response('{"error":"Try again"}',{status:503,headers:{'content-type':'application/json'}}));await first;assert.equal(button.disabled,false);assert.deepEqual(errors,['Try again']);
 request=defer();const retry=button.dispatch('click')[0];assert.equal(calls[1].id,calls[0].id);
 request.resolve(new Response('{"id":"created"}',{headers:{'content-type':'application/json'}}));await retry;assert.equal(navigations.at(-1),'/factions/created/');
 window.dispatch('pageshow',{persisted:true});assert.equal(button.disabled,false);assert.equal(button.textContent,'+ New faction');
});
