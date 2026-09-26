import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';

const origin='https://novel.example';
function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(sqlite)};
 const request=(path,method='GET',body,owner='author')=>worker.fetch(new Request(origin+path,{method,headers:{'oai-authenticated-user-id':owner,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 const success=async(path,method='GET',body,owner='author')=>{const response=await request(path,method,body,owner);assert.equal(response.status,method==='POST'?201:200,await response.clone().text());return response.json();};
 const create=(path,extra={},owner='author')=>success(path,'POST',{id:crypto.randomUUID(),...extra},owner);
 const link=(novelId,targetKind,targetId)=>create('/api/novels/'+novelId+'/associations',{targetKind,targetId});
 const edit=async(path,extra,owner='author')=>success(path,'PUT',{...await success(path,'GET',undefined,owner),...extra},owner);
 const snapshot=()=>Object.fromEntries(['novels','character_drafts','factions','locations','lore_entries','story_arcs','novel_associations','chapters','scenes'].map(table=>[table,sqlite.prepare('SELECT * FROM '+table+' ORDER BY id').all()]));
 return {sqlite,env,request,success,create,link,edit,snapshot};
}
const ids=rows=>rows.map(row=>row.id).sort();
const rich={type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Keep this heading'}]},{type:'paragraph',content:[{type:'text',text:'Private exact prose <script> & two  spaces',marks:[{type:'bold'}]},{type:'hardBreak'},{type:'text',text:'Second line'}]},{type:'blockquote',content:[{type:'paragraph',content:[{type:'text',text:'Remember.'}]}]}]};

test('novel directories scope linked shared articles while owner catalogs and canonical profile pickers stay complete',async t=>{
 const {create,success,link,edit}=setup(t),novel=await create('/api/novels',{title:'One'}),other=await create('/api/novels',{title:'Two'});
 const character=await create('/api/characters',{name:'Linked'}),unlinked=await create('/api/characters',{name:'Global only'}),privateCharacter=await create('/api/characters',{name:'Foreign'},'other');
 const faction=await create('/api/factions',{name:'Guild'}),country=await create('/api/locations',{name:'Country',type:'country',parentId:null}),city=await create('/api/locations',{name:'City',type:'city',parentId:country.id});
 const lore=await create('/api/lore',{type:'book',name:'Book',contents:'Permanent book text',questions:'Who owns it?'}),arc=await create('/api/story-arcs',{name:'Arc'});
 const noteId=crypto.randomUUID();
 await edit('/api/characters/'+character.id,{arc:'[1]An arc',notes:[{id:noteId,field:'arc',position:0,title:'A note',type:'lore',text:'Linked character note',links:[]}]});
 await edit('/api/characters/'+unlinked.id,{arc:'[1]Another arc',notes:[{id:noteId,field:'arc',position:0,title:'Other note',type:'lore',text:'Global character note',links:[]}]});
 await edit('/api/characters/claude',{firstName:'Effective sample'});
 for(const [kind,id] of [['character',character.id],['character','claude'],['faction',faction.id],['location',city.id],['lore',lore.id],['story_arc',arc.id]])await link(novel.id,kind,id);
 await link(other.id,'character',unlinked.id);
 for(const [path,key,expected] of [['/api/characters','characters',[character.id,'claude']],['/api/factions','factions',[faction.id]],['/api/locations','locations',[city.id]],['/api/lore','entries',[lore.id]],['/api/story-arcs','storyArcs',[arc.id]]]){
  const scoped=await success(path+'?novelId='+novel.id),global=await success(path);
  assert.deepEqual(ids(scoped[key]),expected.sort());assert.equal(scoped.scope.novelId,novel.id);
  assert.ok(global[key].length>scoped[key].length||path==='/api/lore'||path==='/api/story-arcs');
 }
 const global=await success('/api/characters');assert.ok(global.characters.some(row=>row.id===unlinked.id));assert.ok(!global.characters.some(row=>row.id===privateCharacter.id));
 const scoped=await success('/api/characters?novelId='+novel.id);assert.equal(scoped.characters.find(row=>row.id==='claude').firstName,'Effective sample');
 const places=await success('/api/locations?novelId='+novel.id);assert.ok(places.contextLocations.some(row=>row.id===country.id));assert.ok(!places.locations.some(row=>row.id===country.id));
 const library=await success('/api/lore?novelId='+novel.id);assert.deepEqual(ids(library.notes),['note-'+character.id+'-'+noteId]);
 assert.equal(new URL(library.notes[0].href,origin).hash,'#note-'+noteId);assert.equal(new URL(library.notes[0].href,origin).searchParams.get('novel'),novel.id);
 assert.equal(new URL(library.entries[0].href,origin).searchParams.get('novel'),novel.id);assert.equal(new URL(library.questions[0].href,origin).hash,'#field-questions');
 const canonical=await success('/api/characters/'+unlinked.id+'?novelId='+novel.id);assert.equal(canonical.id,unlinked.id);
 const connections=await success('/api/characters/'+character.id+'?view=connections&novelId='+novel.id);assert.ok(connections.options.some(row=>row.ref.id===unlinked.id));
 assert.equal((await success('/api/lore/'+lore.id)).contents,'Permanent book text');
});

test('scoped dashboards and timelines preserve canonical chronology, raw dates and URL anchors',async t=>{
 const {create,success,link,edit}=setup(t),first=await create('/api/novels',{title:'First'}),second=await create('/api/novels',{title:'Second'});
 await edit('/api/characters/claude',{firstName:'Scoped sample',birthDate:'1200 BCE',deathDate:'14 Harvest, 112',questions:'Why leave?'});
 await edit('/api/factions/sample-ember',{founded:'1800'});
 const book=await create('/api/lore',{type:'book',name:'Shared Book',originDate:'1984-02',questions:'Who wrote it?'}),undated=await create('/api/story-arcs',{name:'Undated arc'}),excluded=await create('/api/lore',{type:'book',name:'Unlinked Book',originDate:'2000'});
 for(const novel of [first,second])for(const [kind,id] of [['character','claude'],['faction','sample-ember'],['lore',book.id],['story_arc',undated.id]])await link(novel.id,kind,id);
 const global=await success('/api/timeline'),a=await success('/api/timeline?novelId='+first.id),b=await success('/api/timeline?novelId='+second.id);
 assert.deepEqual(a.events.map(row=>row.id),b.events.map(row=>row.id));assert.equal(new Set(a.events.map(row=>row.id)).size,3);
 assert.ok(!a.events.some(row=>row.entityId==='lore:'+excluded.id));assert.equal(a.unplaced.length,1);assert.equal(a.unplaced[0].rawDate,'14 Harvest, 112');
 assert.equal(a.undated,1);assert.deepEqual(a.counts,{character:1,faction:1,lore:1,storyArc:1});
 for(const row of [...a.events,...a.unplaced]){const canonical=[...global.events,...global.unplaced].find(event=>event.id===row.id);assert.deepEqual(row.date,canonical.date);assert.equal(row.rawDate,canonical.rawDate);const href=new URL(row.href,origin);assert.equal(href.searchParams.get('novel'),first.id);assert.equal(href.hash,new URL(canonical.href,origin).hash);}
 assert.ok(!a.events.some(row=>row.entityId.startsWith('novel:')));assert.match(a.scope.note,/does not assert when/);
 const dashboard=await success('/api/dashboard?novelId='+first.id);assert.deepEqual(ids(dashboard.novels),[first.id]);assert.deepEqual(ids(dashboard.lore),[book.id]);assert.deepEqual(ids(dashboard.storyArcs),[undated.id]);
 for(const key of ['characters','factions','lore','questions'])for(const row of dashboard[key])assert.equal(new URL(row.href,origin).searchParams.get('novel'),first.id);
 assert.deepEqual(dashboard.timeline,a);
 const full=await success('/api/dashboard');assert.deepEqual(ids(full.novels),[first.id,second.id].sort());assert.ok(full.lore.some(row=>row.id===excluded.id));
});

test('invalid, empty and foreign novel selectors reject catalog creation before any mutation',async t=>{
 const {create,request,snapshot}=setup(t),foreign=await create('/api/novels',{title:'Private'},'other');
 for(const selector of ['',foreign.id,'bad',crypto.randomUUID()])for(const path of ['/api/characters','/api/factions','/api/locations','/api/lore','/api/story-arcs','/api/dashboard','/api/timeline']){
  const before=snapshot();assert.equal((await request(path+'?novelId='+selector)).status,404,path+' '+selector);
  assert.equal((await request(path+'?novelId='+selector,'POST',{id:crypto.randomUUID(),name:'Blocked',type:'book'})).status,404,path+' POST '+selector);assert.deepEqual(snapshot(),before);
 }
});

test('creation in novel context links every source kind and keeps Lore books as shared book articles',async t=>{
 const {create,success}=setup(t),novel=await create('/api/novels',{title:'Context'}),scope='?novelId='+novel.id;
 for(const [path,kind,fields] of [['/api/characters','character',{name:'Person'}],['/api/factions','faction',{name:'Group'}],['/api/locations','location',{name:'World',type:'universe',parentId:null}],['/api/lore','lore',{name:'Book',type:'book',contents:'Keep prose'}],['/api/story-arcs','story_arc',{name:'Story'}]]){
  const record=await create(path+scope,fields),associations=await success('/api/novels/'+novel.id+'/associations'),association=associations.find(row=>row.targetId===record.id);
  assert.equal(association.targetKind,kind);assert.equal(association.relationKind,['lore','story_arc'].includes(kind)?'referenced_by':'appears_in');
  const retry=await success(path+scope,'POST',{id:record.id,...fields,name:'Do not replace'});assert.deepEqual(retry,record);
  assert.equal((await success('/api/novels/'+novel.id+'/associations')).filter(row=>row.targetId===record.id).length,1);
  if(kind==='lore'){assert.equal(record.type,'book');assert.equal(record.contents,'Keep prose');assert.equal((await success('/api/lore'+scope)).entries[0].type,'book');}
 }
});

test('failed contextual association returns 503 and retrying the same ID repairs the saved source',async t=>{
 const {env,sqlite,create,request,success}=setup(t),novel=await create('/api/novels',{title:'Recoverable'}),binding=env.DB;let fail=true;
 env.DB={...binding,prepare(sql){if(fail&&sql.startsWith('INSERT INTO novel_associations')){fail=false;throw new Error('Injected association failure');}return binding.prepare(sql);}};
 const input={id:crypto.randomUUID(),type:'book',name:'Original book',contents:'Original prose'},path='/api/lore?novelId='+novel.id;
 assert.equal((await request(path,'POST',input)).status,503);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM lore_entries').get().n,1);
 const source=await success('/api/lore/'+input.id);assert.equal(source.contents,'Original prose');assert.equal(source.version,1);
 const retry=await success(path,'POST',{...input,name:'Changed retry',contents:'Must not overwrite'});assert.deepEqual(retry,source);
 assert.deepEqual((await success('/api/novels/'+novel.id+'/associations')).map(row=>row.targetId),[source.id]);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM lore_entries').get().n,1);
});

test('sample character storage aliases cannot create duplicate canonical associations',async t=>{
 const {sqlite,create,edit,request,success,link}=setup(t),novel=await create('/api/novels',{title:'Samples'});
 await edit('/api/characters/claude',{firstName:'Owned sample'});
 const alias=sqlite.prepare("SELECT id FROM character_drafts WHERE owner_id=? AND json_extract(document,'$.sampleId')=?").get('author','claude').id;
 assert.notEqual(alias,'claude');await link(novel.id,'character','claude');
 assert.equal((await request('/api/novels/'+novel.id+'/associations','POST',{id:crypto.randomUUID(),targetKind:'character',targetId:alias})).status,404);
 assert.equal((await request('/api/novel-associations?targetKind=character&targetId='+alias)).status,404);
 assert.deepEqual((await success('/api/novels/'+novel.id+'/associations')).map(row=>row.targetId),['claude']);
});

test('multi-novel manuscript scope is content-free and requires consistent explicit creation context',async t=>{
 const {create,success,request,snapshot}=setup(t),a=await create('/api/novels',{title:'A'}),b=await create('/api/novels',{title:'B'}),foreign=await create('/api/novels',{title:'Foreign'},'other');
 const chapterA=await create('/api/chapters?novelId='+a.id,{title:'A chapter'}),chapterB=await create('/api/chapters',{title:'B chapter',novelId:b.id});
 const sceneA=await create('/api/scenes?novelId='+a.id,{chapterId:chapterA.id,title:'A scene',contentSchemaVersion:1,content:rich}),sceneB=await create('/api/scenes',{chapterId:chapterB.id,title:'B scene',contentSchemaVersion:1,content:rich});
 assert.deepEqual(ids((await success('/api/chapters?novelId='+a.id)).chapters),[chapterA.id]);
 const list=await success('/api/scenes?novelId='+a.id);assert.deepEqual(ids(list.scenes),[sceneA.id]);assert.ok(!Object.hasOwn(list.scenes[0],'content'));assert.ok(!JSON.stringify(list).includes('Private exact prose'));
 assert.deepEqual((await success('/api/scenes/'+sceneA.id+'?novelId='+a.id)).content,rich);
 const before=snapshot();
 for(const [path,body,status] of [
  ['/api/chapters',{id:crypto.randomUUID(),title:'Ambiguous'},400],
  ['/api/chapters?novelId='+a.id,{id:crypto.randomUUID(),title:'Wrong',novelId:b.id},400],
  ['/api/chapters?novelId='+a.id,{id:chapterB.id,title:'Retry'},404],
  ['/api/chapters',{id:chapterB.id,title:'Retry',novelId:a.id},404],
  ['/api/scenes?novelId='+a.id,{id:sceneB.id,chapterId:chapterB.id},404],
  ['/api/scenes?novelId='+a.id,{id:crypto.randomUUID(),chapterId:chapterB.id,title:'Wrong',contentSchemaVersion:1,content:rich},400],
  ['/api/scenes',{id:sceneA.id,chapterId:chapterB.id},409],
  ['/api/chapters?novelId='+foreign.id,{id:crypto.randomUUID(),title:'Foreign'},404]
 ]){assert.equal((await request(path,'POST',body)).status,status,path);assert.deepEqual(snapshot(),before);}
 for(const path of ['/api/chapters/'+chapterB.id+'?novelId='+a.id,'/api/scenes/'+sceneB.id+'?novelId='+a.id,'/api/scenes?chapterId='+chapterB.id+'&novelId='+a.id,'/api/chapters?novelId=','/api/scenes?novelId='+foreign.id])assert.equal((await request(path)).status,404,path);
 assert.deepEqual(snapshot(),before);
});

test('cross-novel moves reject atomically while same-novel scene moves retain rich prose',async t=>{
 const {create,success,request,snapshot}=setup(t),a=await create('/api/novels',{title:'A'}),b=await create('/api/novels',{title:'B'});
 const one=await create('/api/chapters',{title:'One',novelId:a.id}),two=await create('/api/chapters',{title:'Two',novelId:a.id}),foreign=await create('/api/chapters',{title:'Other novel',novelId:b.id}),scene=await create('/api/scenes',{chapterId:one.id,title:'Scene',contentSchemaVersion:1,content:rich});
 const before=snapshot();
 assert.equal((await request('/api/scenes/'+scene.id,'PUT',{version:1,chapterId:foreign.id,title:'Changed',content:{type:'doc',content:[]}})).status,400);
 assert.equal((await request('/api/chapters/'+one.id,'PUT',{version:1,novelId:b.id,title:'Changed'})).status,400);assert.deepEqual(snapshot(),before);
 const moved=await success('/api/scenes/'+scene.id+'?novelId='+a.id,'PUT',{version:1,chapterId:two.id});assert.equal(moved.chapterId,two.id);assert.equal(moved.version,2);assert.deepEqual(moved.content,rich);
 assert.equal((await request('/api/scenes/'+scene.id,'PUT',{version:1,content:rich})).status,409);assert.deepEqual(await success('/api/scenes/'+scene.id),moved);
});
