import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createWorker} from '../server/app.js';
import {renderDashboardPage} from '../server/dashboard-shell.js';

const origin='https://novel.example';
test('home aliases and Lore receive one complete dashboard shell without asset copies',async()=>{
 const worker=createWorker({}),pages=[];
 for(const path of ['/','/index.html','/dashboard/','/dashboard/index.html','/lore/','/lore/index.html']){
  const response=await worker.fetch(new Request(origin+path),{});assert.equal(response.status,200);
  const html=await response.text();pages.push(html);
  assert.equal((html.match(/data-dashboard-shell/g)||[]).length,1);
  assert.equal((html.match(/aria-label="Workspace sidebar"/g)||[]).length,1);
  assert.equal((html.match(/<h1 /g)||[]).length,1);
  for(const hook of ['body','rows','loading','error','error-message','retry','empty'])assert.ok(html.includes('data-dashboard-'+hook),hook);
  assert.ok(html.includes('/dashboard/shell.css'));
  const head=await worker.fetch(new Request(origin+path,{method:'HEAD'}),{});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await worker.fetch(new Request(origin+path,{method:'POST'}),{})).status,405);
 }
 assert.equal(pages[0],pages[1]);assert.equal(pages[0],pages[2]);assert.equal(pages[0],pages[3]);assert.equal(pages[4],pages[5]);
 for(const path of ['/dashboard','/lore'])assert.equal((await worker.fetch(new Request(origin+path+'?collection=books'),{})).headers.get('location'),origin+path+'/?collection=books');
 const css=readFileSync('public/dashboard/shell.css','utf8');
 for(const dependency of ['./dashboard.css','../styles.css?v=shared-1','../components/character-card/card.css?v=2','../components/character-card/details.css?v=1'])assert.ok(css.includes(dependency));
});

test('dashboard frame escapes metadata, supports action/slot variations and rejects unsafe links',()=>{
 const config={id:'research',title:'Research <script>',heading:'A & B',description:'"Details"',script:'/research/dashboard.js',styles:['/research/style.css'],breadcrumbs:[{label:'Home',href:'/'},{label:'Research'}],actions:[{id:'create-research',label:'New <entry>',icon:'＋',disabled:true},{label:'Open notes',href:'/lore/?collection=notes'}],slots:{toolbar:'<input id="draft">',beforeContent:'<nav id="collections"></nav>',afterContent:'<footer>More</footer>',dialogs:'<dialog id="new-entry"></dialog>'}};
 const html=renderDashboardPage(config);
 assert.ok(html.includes('Research &lt;script&gt;'));assert.ok(html.includes('A &amp; B'));assert.ok(html.includes('New &lt;entry&gt;'));
 assert.ok(html.includes('type="button" disabled'));assert.ok(html.includes('href="/lore/?collection=notes"'));
 assert.ok(html.indexOf('/dashboard/shell.css')<html.indexOf('/research/style.css'));
 assert.ok(html.includes('aria-current="page">Research'));assert.ok(html.includes('href="#research"'));
 for(const slot of ['toolbar','before-content','after-content'])assert.ok(html.includes('data-dashboard-slot="'+slot+'"'));
 assert.ok(html.indexOf('<dialog')>html.indexOf('</main>'));
 assert.throws(()=>renderDashboardPage({...config,actions:[{label:'Bad',href:'javascript:alert(1)'}]}));
 assert.throws(()=>renderDashboardPage({...config,script:'//external.example/code.js'}));
 assert.throws(()=>renderDashboardPage({...config,id:'bad"id'}));
});

function node(){
 const handlers=new Map();
 return {hidden:false,disabled:false,textContent:'',value:'',dataset:{},attrs:{},children:[],
  addEventListener(type,fn){if(!handlers.has(type))handlers.set(type,new Set());handlers.get(type).add(fn);},
  removeEventListener(type,fn){handlers.get(type)?.delete(fn);},
  dispatch(type,event={}){return [...handlers.get(type)||[]].map(fn=>fn(event));},
  listeners(type){return handlers.get(type)?.size||0;},
  setAttribute(key,value){this.attrs[key]=value;},replaceChildren(...children){this.children=children;}
 };
}
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function shellSession(){
 const root={...node(),id:'test-dashboard'},window=node(),hooks=new Map();
 for(const name of ['body','rows','loading','error','error-message','retry','empty'])hooks.set(name,node());
 root.querySelector=selector=>hooks.get(selector.match(/^\[data-dashboard-(.*)\]$/)[1]);
 const counts={rails:0,banners:0,prefixes:[]};
 const context=vm.createContext({window,document:{querySelector:()=>root},AbortController,Promise,
  el:()=>node(),tone:()=>'',initial:()=>'',
  createRails({idPrefix}){counts.rails++;counts.prefixes.push(idPrefix);let destroyed=false;return {rail(title,records){return {title,records};},destroy(){assert.equal(destroyed,false,'one disposal per view');destroyed=true;counts.rails--;}};},
  createQuestionBanner(records,{idPrefix}){counts.banners++;counts.prefixes.push(idPrefix);return {element:{questions:records},destroy(){counts.banners--;}};}
 });
 const source=readFileSync('public/dashboard/shell.js','utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,'');
 vm.runInContext(source+'\nglobalThis.mount=initDashboardShell;globalThis.readDashboard=fetchDashboard;',context);
 return {root,window,counts,hooks,context,mount:options=>context.mount({root,autoload:false,...options})};
}

test('refresh after an in-flight read waits for fresh data instead of losing a mutation',async()=>{
 const session=shellSession(),first=defer(),second=defer(),painted=[],published=[];let reads=0;
 const shell=session.mount({load:()=>++reads===1?first.promise:second.promise,render(data,view){painted.push(data.name);view.append(data.name);},onData:data=>published.push(data.name)});
 const pending=shell.refresh();await tick();assert.equal(reads,1);assert.equal(session.hooks.get('body').attrs['aria-busy'],'true');
 assert.equal(shell.refresh(),pending);
 first.resolve({name:'stale'});await tick();assert.equal(reads,2);assert.deepEqual(painted,[]);
 second.resolve({name:'saved'});await pending;
 assert.deepEqual(painted,['saved']);assert.deepEqual(published,['saved']);assert.equal(shell.data.name,'saved');
 assert.equal(session.hooks.get('body').attrs['aria-busy'],'false');assert.equal(session.root.dataset.dashboardState,'ready');shell.destroy();
});

test('errors retain content and draft slots; retry and filter rerenders own their cleanup',async()=>{
 const session=shellSession(),draft=node();draft.value='Unsaved research';session.root.draft=draft;
 let fail=false,empty=false;
 const shell=session.mount({load:async()=>{if(fail)throw new Error('Offline');return {name:'Kept'};},render(data,view){if(empty)view.empty();else{view.rail({id:'entries',title:'Entries',records:[data],card:()=>node()});view.questions([data]);}}});
 await shell.refresh();const previous=session.hooks.get('rows').children;
 assert.equal(session.counts.rails,1);assert.equal(session.counts.banners,1);
 fail=true;await shell.refresh();assert.equal(session.hooks.get('rows').children,previous);
 assert.equal(session.root.draft.value,'Unsaved research');assert.equal(session.hooks.get('error-message').textContent,'Offline');assert.equal(session.hooks.get('error').hidden,false);
 fail=false;await session.hooks.get('retry').dispatch('click')[0];assert.equal(session.hooks.get('error').hidden,true);assert.equal(session.counts.rails,1);assert.equal(session.counts.banners,1);
 empty=true;shell.render();assert.equal(session.hooks.get('empty').hidden,false);assert.equal(session.counts.banners,0);
 empty=false;shell.render();assert.equal(session.hooks.get('empty').hidden,true);assert.equal(session.counts.banners,1);
 assert.equal(session.root.draft.value,'Unsaved research');assert.ok(session.counts.prefixes.includes('test-dashboard-questions-1'));
 shell.destroy();assert.equal(session.counts.rails,0);assert.equal(session.counts.banners,0);
 assert.equal(session.window.listeners('pageshow'),0);assert.equal(session.hooks.get('retry').listeners('click'),0);
});

test('destroy aborts pending reads and prevents late rendering; persisted pages refresh',async()=>{
 const session=shellSession(),late=defer();let reads=0,signal,painted=0;
 const shell=session.mount({load:options=>{signal=options.signal;reads++;return reads===1?Promise.resolve({}):late.promise;},render(data,view){painted++;view.append(data);}});
 await shell.refresh();session.window.dispatch('pageshow',{persisted:false});assert.equal(reads,1);
 session.window.dispatch('pageshow',{persisted:true});await tick();assert.equal(reads,2);
 shell.destroy();assert.equal(signal.aborted,true);late.resolve({late:true});await tick();assert.equal(painted,1);
 assert.equal(session.counts.rails,0);assert.equal(session.window.listeners('pagehide'),0);
});

test('a failed renderer disposes its unfinished view and preserves the previous content',async()=>{
 const session=shellSession();let broken=false;
 const shell=session.mount({load:async()=>({}),render(data,view){view.questions([]);if(broken)throw new Error('Render failed');view.append('ready');}});
 await shell.refresh();const previous=session.hooks.get('rows').children;broken=true;shell.render();
 assert.equal(session.hooks.get('rows').children,previous);assert.equal(session.counts.rails,1);assert.equal(session.counts.banners,1);assert.equal(session.root.dataset.dashboardState,'error');shell.destroy();
});

test('dashboard fetch verifies JSON and server errors and forwards cancellation',async()=>{
 const {context}=shellSession(),abort=new AbortController();let options;
 context.fetch=async(url,input)=>{assert.equal(url,'/api/example');options=input;return new Response('{"entries":[]}',{headers:{'content-type':'application/json'}});};
 const result=await context.readDashboard('/api/example',{signal:abort.signal});assert.equal(result.entries.length,0);assert.equal(options.signal,abort.signal);assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');
 context.fetch=async()=>new Response('<html>Sign in</html>',{headers:{'content-type':'text/html'}});
 await assert.rejects(context.readDashboard('/api/example'),/sign in again/);
 context.fetch=async()=>new Response('{"error":"Unavailable"}',{status:503,headers:{'content-type':'application/json'}});
 await assert.rejects(context.readDashboard('/api/example'),/Unavailable/);
});
