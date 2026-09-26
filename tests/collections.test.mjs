import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {createWorker} from '../server/app.js';
import {blankLore} from '../public/lore/template.js';
import {libraryKey} from '../server/library-targets.js';

function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(sqlite)},origin='https://beta.example';
 const request=(path,method='GET',body,owner='author',headers={})=>worker.fetch(new Request(origin+path,{method,headers:{'oai-authenticated-user-id':owner,origin,'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 const read=async(path,owner)=>{const response=await request(path,'GET',undefined,owner);assert.equal(response.status,200,await response.clone().text());return response.json();};
 const create=async(path,body,owner)=>{const response=await request(path,'POST',{id:crypto.randomUUID(),...body},owner);assert.equal(response.status,201,await response.clone().text());return response.json();};
 return {sqlite,request,read,create};
}

test('mixed manual collections keep canonical references, nested note identity and checked order',async t=>{
 const {sqlite,request,read,create}=setup(t),novel=await create('/api/novels',{title:'First'}),character=await create('/api/characters',{name:'Shared'}),second=await create('/api/characters',{name:'Other'}),lore=await create('/api/lore',{...blankLore('book'),name:'Lore book'}),collection=await create('/api/collections',{name:'Royal court',kind:'manual'});
 const noteId='same-note';for(const record of [character,second]){const current=JSON.parse(sqlite.prepare('SELECT document FROM character_drafts WHERE id=?').get(record.id).document);current.notes=[{id:noteId,title:record.name+' note',text:'Independent note',field:'summary',type:'detail'}];sqlite.prepare('UPDATE character_drafts SET document=?,version=version+1 WHERE id=?').run(JSON.stringify(current),record.id);}
 const association=await create('/api/novels/'+novel.id+'/associations',{targetKind:'character',targetId:character.id});
 const refs=[{kind:'character',id:character.id},{kind:'lore',id:lore.id},{kind:'novel',id:novel.id},{kind:'note',id:noteId,characterId:character.id},{kind:'note',id:noteId,characterId:second.id}];let current=collection;
 for(const ref of refs){const response=await request('/api/collections/'+collection.id+'/members','POST',{version:current.version,ref});assert.equal(response.status,200,await response.clone().text());current=await response.json();}
 let entries=(await read('/api/collections/'+collection.id+'/entries')).entries;assert.equal(entries.length,5);assert.equal(entries.filter(entry=>entry.kind==='note').length,2);
 const order=refs.map(libraryKey).reverse();let response=await request('/api/collections/'+collection.id,'PUT',{version:current.version,order});assert.equal(response.status,200);current=await response.json();
 assert.deepEqual((await read('/api/collections/'+collection.id+'/entries')).entries.map(libraryKey),order);
 response=await request('/api/collections/'+collection.id,'PUT',{version:collection.version,order});assert.equal(response.status,409);assert.deepEqual((await response.json()).draft.order,order);
 response=await request('/api/collections/'+collection.id+'/members','DELETE',{version:current.version,ref:refs[0]});assert.equal(response.status,200);current=await response.json();
 assert.equal((await read('/api/characters/'+character.id)).name,'Shared');assert.equal((await read('/api/novels/'+novel.id+'/associations'))[0].id,association.id);
 assert.equal((await read('/api/lore/'+lore.id)).type,'book');assert.equal((await read('/api/collections/'+collection.id+'/entries')).entries.length,4);
 response=await request('/api/collections/'+collection.id,'DELETE',{version:current.version});assert.equal(response.status,204);assert.equal((await request('/api/collections/'+collection.id)).status,404);assert.equal((await read('/api/lore/'+lore.id)).name,'Lore book');
});

test('smart collections derive current distinct novel links without mutating source documents',async t=>{
 const {sqlite,request,read,create}=setup(t),one=await create('/api/novels',{title:'One'}),two=await create('/api/novels',{title:'Two'}),character=await create('/api/characters',{name:'Reusable'}),collection=await create('/api/collections',{name:'Recurring cast',kind:'smart',rules:{version:1,mode:'all',predicates:[{field:'entityType',value:'character'},{field:'minNovelCount',value:2}]}});
 const source=sqlite.prepare('SELECT document,version FROM character_drafts WHERE id=?').get(character.id);
 assert.deepEqual((await read('/api/collections/'+collection.id+'/entries')).entries,[]);
 const first=await create('/api/novels/'+one.id+'/associations',{targetKind:'character',targetId:character.id});
 await create('/api/novels/'+one.id+'/associations',{targetKind:'character',targetId:character.id});assert.deepEqual((await read('/api/collections/'+collection.id+'/entries')).entries,[]);
 const second=await create('/api/novels/'+two.id+'/associations',{targetKind:'character',targetId:character.id});
 assert.deepEqual((await read('/api/collections/'+collection.id+'/entries')).entries.map(entry=>entry.id),[character.id]);
 let response=await request('/api/novels/'+two.id+'/associations/'+second.id,'DELETE',{version:second.version});assert.equal(response.status,204);assert.deepEqual((await read('/api/collections/'+collection.id+'/entries')).entries,[]);
 assert.deepEqual(sqlite.prepare('SELECT document,version FROM character_drafts WHERE id=?').get(character.id),source);assert.equal(sqlite.prepare('SELECT count(*) AS count FROM character_drafts').get().count,1);
 assert.equal((await read('/api/novels/'+one.id+'/associations'))[0].id,first.id);
 response=await request('/api/collections/'+collection.id+'/members','POST',{version:collection.version,ref:{kind:'character',id:character.id}});assert.equal(response.status,400);
});

test('collection writes isolate owners, reject unsafe rules and preserve drafts on conflicts',async t=>{
 const {request,read,create}=setup(t),collection=await create('/api/collections',{name:'Private',kind:'manual'}),foreign=await create('/api/characters',{name:'Secret'},'other'),foreignNovel=await create('/api/novels',{title:'Private novel'},'other');
 for(const method of ['GET','PUT','DELETE'])assert.equal((await request('/api/collections/'+collection.id,method,method==='GET'?undefined:{version:1,name:'Intrusion'},'other')).status,404);
 let response=await request('/api/collections/'+collection.id+'/members','POST',{version:1,ref:{kind:'character',id:foreign.id}});assert.equal(response.status,404);assert.equal((await read('/api/collections/'+collection.id)).version,1);assert.deepEqual((await read('/api/collections/'+collection.id+'/entries')).entries,[]);
 for(const rules of [{version:1,mode:'all',predicates:[{field:'sql',value:'DROP TABLE novels'}]},{version:1,mode:'all',predicates:[]},{version:2,mode:'all',predicates:[{field:'unassigned'}]}])assert.equal((await request('/api/collections','POST',{id:crypto.randomUUID(),name:'Unsafe',kind:'smart',rules})).status,400);
 assert.equal((await request('/api/collections','POST',{id:crypto.randomUUID(),name:'Foreign',kind:'smart',rules:{version:1,mode:'all',predicates:[{field:'linkedNovel',value:foreignNovel.id}]}})).status,404);
 const smart=await create('/api/collections',{name:'Ideas',kind:'smart',rules:{version:1,mode:'all',predicates:[{field:'unassigned'}]}});
 response=await request('/api/collections/'+smart.id,'PUT',{version:1,name:'Saved'});assert.equal(response.status,200);
 const draft={version:1,name:'Kept draft',rules:{version:1,mode:'any',predicates:[{field:'entityType',value:'lore'}]}};response=await request('/api/collections/'+smart.id,'PUT',draft);assert.equal(response.status,409);assert.deepEqual((await response.json()).draft,draft);
 assert.equal((await request('/api/collections/'+collection.id,'PUT',{version:1,name:'Bad origin'},'author',{origin:'https://evil.example'})).status,403);
});

test('smart note scopes use parent-qualified identity and the parent character’s declared novel links',async t=>{
 const {sqlite,read,create}=setup(t),novel=await create('/api/novels',{title:'Notes in context'}),one=await create('/api/characters',{name:'Linked parent'}),two=await create('/api/characters',{name:'Library parent'});
 for(const record of [one,two]){const source=JSON.parse(sqlite.prepare('SELECT document FROM character_drafts WHERE id=?').get(record.id).document);source.notes=[{id:'shared-note-id',title:'Separate note',text:'Retained',field:'summary',type:'detail'}];sqlite.prepare('UPDATE character_drafts SET document=?,version=version+1 WHERE id=?').run(JSON.stringify(source),record.id);}
 await create('/api/novels/'+novel.id+'/associations',{targetKind:'character',targetId:one.id});
 const collection=await create('/api/collections',{name:'Linked character notes',kind:'smart',rules:{version:1,mode:'all',predicates:[{field:'entityType',value:'note'},{field:'linkedNovel',value:novel.id}]}});
 const payload=await read('/api/collections/'+collection.id+'/entries');
 assert.deepEqual(payload.entries.map(entry=>({id:entry.id,characterId:entry.characterId})),[{id:'shared-note-id',characterId:one.id}]);
 assert.match(payload.ruleSummary,/parent character/);
});

test('removing a collected note explains the dependency and keeps the saved article intact',async t=>{
 const {sqlite,read,create,request}=setup(t),character=await create('/api/characters',{name:'Note keeper'}),collection=await create('/api/collections',{name:'Notes',kind:'manual'});
 const source=JSON.parse(sqlite.prepare('SELECT document FROM character_drafts WHERE id=?').get(character.id).document);source.notes=[{id:'retained-note',title:'Retained',text:'Source text',field:'summary',type:'detail'}];sqlite.prepare('UPDATE character_drafts SET document=?,version=version+1 WHERE id=?').run(JSON.stringify(source),character.id);
 const ref={kind:'note',id:'retained-note',characterId:character.id};let response=await request('/api/collections/'+collection.id+'/members','POST',{version:1,ref});assert.equal(response.status,200);const current=await response.json();
 response=await request('/api/characters/'+character.id,'PUT',{version:2,relationships:[],notes:[]});assert.equal(response.status,400);assert.match((await response.json()).error,/collection membership/);assert.equal((await read('/api/characters/'+character.id)).notes[0].id,'retained-note');
 response=await request('/api/collections/'+collection.id+'/members','DELETE',{version:current.version,ref});assert.equal(response.status,200);
 response=await request('/api/characters/'+character.id,'PUT',{version:2,relationships:[],notes:[]});assert.equal(response.status,200);assert.deepEqual((await response.json()).notes,[]);
});
