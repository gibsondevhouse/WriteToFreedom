import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {validateNoteConnections} from '../server/note-connections.js';

function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(sqlite)},origin='https://novel.example';
 const request=(path,method='GET',body)=>worker.fetch(new Request(origin+path,{method,headers:{origin,'content-type':'application/json','oai-authenticated-user-id':'author'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 const get=async path=>{const response=await request(path);assert.equal(response.status,200,await response.clone().text());return response.json();};
 const create=async(path,body)=>{const response=await request(path,'POST',body);assert.equal(response.status,201,await response.clone().text());return response.json();};
 return {sqlite,request,get,create};
}

test('story arc scenes keep their identities through edits, reordering, and partial saves',async t=>{
 const {request,get,create}=setup(t),scene=title=>({title,chapter:'Chapter 1',beat:'exposition',summary:'A beginning.'});
 const created=await create('/api/story-arcs',{id:crypto.randomUUID(),name:'An authored arc',summary:'Persist the creation payload.',keyScenes:[scene('First'),scene('Second')]});
 const path='/api/story-arcs/'+created.id;
 assert.equal(created.name,'An authored arc');assert.equal(created.summary,'Persist the creation payload.');
 const ids=created.keyScenes.map(scene=>scene.id);assert.equal(new Set(ids).size,2);for(const id of ids)assert.match(id,/^[0-9a-f-]{36}$/);
 const reordered=[{...created.keyScenes[1],title:'Second revised'},created.keyScenes[0]];
 let response=await request(path,'PUT',{...created,keyScenes:reordered});assert.equal(response.status,200,await response.clone().text());let saved=await response.json();
 assert.deepEqual(saved.keyScenes.map(scene=>scene.id),[ids[1],ids[0]]);assert.equal(saved.keyScenes[0].title,'Second revised');
 response=await request(path,'PUT',{version:saved.version,summary:'An unrelated edit.'});assert.equal(response.status,200);saved=await response.json();assert.deepEqual(saved.keyScenes,reordered);
 const missingIds=saved.keyScenes.map(({id,...scene})=>scene);
 for(const keyScenes of [missingIds,[saved.keyScenes[0],saved.keyScenes[0]],[{...saved.keyScenes[0],id:'unstable'}],[{...saved.keyScenes[0],chapter:'x'.repeat(10001)}]]){
  assert.equal((await request(path,'PUT',{...saved,keyScenes})).status,400);
  assert.deepEqual(await get(path),saved);
 }
});

test('legacy story arc scenes receive stable IDs across reads and persist them on the next save',async t=>{
 const {sqlite,request,get,create}=setup(t),arc=await create('/api/story-arcs',{id:crypto.randomUUID()});
 const {document}=sqlite.prepare('SELECT document FROM story_arcs WHERE id = ?').get(arc.id),legacy=JSON.parse(document);
 legacy.name='Legacy arc';legacy.keyScenes=[{title:'An old scene',chapter:'Existing long chapter notes. '.repeat(20),beat:'',summary:''}];
 sqlite.prepare('UPDATE story_arcs SET document = ?, version = version + 1 WHERE id = ?').run(JSON.stringify(legacy),arc.id);
 const path='/api/story-arcs/'+arc.id,first=await get(path),second=await get(path);
 assert.equal(first.keyScenes[0].id,second.keyScenes[0].id);assert.ok(first.keyScenes[0].id);
 const response=await request(path,'PUT',{...first,keyScenes:[{...first.keyScenes[0],title:'Edited old scene'}]});assert.equal(response.status,200);
 const persisted=JSON.parse(sqlite.prepare('SELECT document FROM story_arcs WHERE id = ?').get(arc.id).document);
 assert.equal(persisted.keyScenes[0].id,first.keyScenes[0].id);assert.equal(persisted.keyScenes[0].title,'Edited old scene');assert.equal(persisted.keyScenes[0].chapter,legacy.keyScenes[0].chapter.trim());
});

test('profile writes reject conflicting identities, unsupported formats, and unsafe revisions without changes',async t=>{
 const {request,get,create}=setup(t);
 const lore=await create('/api/lore',{id:crypto.randomUUID(),type:'book',name:'A book'}),arc=await create('/api/story-arcs',{id:crypto.randomUUID(),name:'An arc'});
 const paths=['/api/characters/claude','/api/lore/'+lore.id,'/api/story-arcs/'+arc.id,'/api/factions/sample-ember','/api/countries/sample-kingdom','/api/cities/sample-capital','/api/locations/sample-royal-archive'];
 for(const path of paths){
  const current=await get(path);
  for(const extra of [{id:crypto.randomUUID()},{schemaVersion:2},{schemaVersion:'1'},{version:-1},{version:Number.MAX_SAFE_INTEGER},{version:Number.MAX_SAFE_INTEGER+1}]){
   const response=await request(path,'PUT',{...current,...extra});assert.equal(response.status,400,path+': '+JSON.stringify(extra));
   assert.deepEqual(await get(path),current,path+' must remain unchanged');
  }
 }
 for(const [path,type] of [['/api/countries/sample-kingdom','city'],['/api/cities/sample-capital','country']]){
  const current=await get(path);assert.equal((await request(path,'PUT',{...current,type})).status,400);assert.deepEqual(await get(path),current);
 }
});

test('creation rejects unknown formats and incompatible retries instead of returning a different type',async t=>{
 const {request,create}=setup(t);
 for(const [path,payload] of [
  ['/api/lore',{type:'book',name:'A book'}],['/api/story-arcs',{}],['/api/factions',{blank:true}],['/api/locations',{type:'country',name:'A country'}]
 ])assert.equal((await request(path,'POST',{id:crypto.randomUUID(),...payload,schemaVersion:2})).status,400,path);
 const lore=await create('/api/lore',{id:crypto.randomUUID(),type:'book',name:'A book'});
 assert.equal((await request('/api/lore','POST',{id:lore.id,type:'species',name:'A species'})).status,409);
 const location=await create('/api/locations',{id:crypto.randomUUID(),type:'country',name:'A country'});
 assert.equal((await request('/api/locations','POST',{id:location.id,type:'planet',name:'A planet'})).status,409);
 for(const parentId of [false,0,[],{}])assert.equal((await request('/api/locations','POST',{id:crypto.randomUUID(),type:'country',name:'Invalid parent',parentId})).status,400);
});

test('note identity includes its owning character when checking self-references',()=>{
 const id=crypto.randomUUID(),other={kind:'note',id,characterId:'claude'},self={kind:'note',id,characterId:'gemini'};
 assert.doesNotThrow(()=>validateNoteConnections([{id,links:[other]}],[other,self],[],'gemini'));
 assert.throws(()=>validateNoteConnections([{id,links:[self]}],[other,self],[],'gemini'),/different note/);
 assert.throws(()=>validateNoteConnections([{id,links:[other]}],[self],[],'gemini'),/linked items/);
});
