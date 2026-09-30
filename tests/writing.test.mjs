import {assertDocumentSchema} from './helpers/document-schema.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {writingRoute} from '../server/writing-routes.js';
import {writingRepository} from '../server/writing-repository.js';
import {repository} from '../server/db.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {contentText,emptyWritingContent,validateWritingContent,writingContentLimits,writingRequestMaxBytes} from '../public/writing/document.js';

const origin='https://novel.example';
const migrations=readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort();
const text=value=>({type:'text',text:value});
const paragraph=value=>({type:'paragraph',content:[text(value)]});
const document=value=>({type:'doc',content:[paragraph(value)]});
function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of migrations)sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const env={DB:d1Adapter(sqlite)};
 const request=(path,method='GET',body,owner='author',headers={})=>writingRoute(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),origin,'content-type':'application/json',...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}),env);
 const get=async(path,owner='author')=>{const response=await request(path,'GET',undefined,owner);assert.equal(response.status,200,await response.clone().text());return response.json();};
 const chapter=async(extra={},owner='author')=>{const response=await request('/api/chapters','POST',{id:crypto.randomUUID(),title:'First chapter',summary:'',...extra},owner);assert.equal(response.status,201,await response.clone().text());return response.json();};
 const scene=async(chapterId,extra={},owner='author')=>{const response=await request('/api/scenes','POST',{id:crypto.randomUUID(),chapterId,title:'First scene',summary:'',status:'draft',contentSchemaVersion:1,content:emptyWritingContent(),...extra},owner);assert.equal(response.status,201,await response.clone().text());return response.json();};
 return {request,get,chapter,scene,sqlite,env};
}

test('chapter profile metadata persists through older clients and keeps stale connections explicitly removable',async t=>{
 const {request,get,chapter,scene,sqlite,env}=setup(t),legacy=await chapter(),library=repository(env.DB);
 for(const key of ['status','chapterNumber','connectedArcIds'])assert.equal(Object.hasOwn(legacy,key),false,key);
 const arc=await library.createStoryArc('author',crypto.randomUUID(),{name:'The treaty'});
 const association=await library.createNovelAssociation('author',crypto.randomUUID(),legacy.novelId,'story_arc',arc.id,'referenced_by','');
 const entry=await chapter({novelId:legacy.novelId,status:'revising',chapterNumber:14,connectedArcIds:[arc.id]});
 assert.equal(entry.status,'revising');assert.equal(entry.chapterNumber,14);assert.deepEqual(entry.connectedArcIds,[arc.id]);
 assert.deepEqual(await get('/api/chapters/'+entry.id),entry);
 assert.deepEqual((await get('/api/chapters?novelId='+entry.novelId)).chapters.find(item=>item.id===entry.id),entry);
 const stored=JSON.parse(sqlite.prepare('SELECT document FROM chapters WHERE id = ?').get(entry.id).document);
 assertDocumentSchema('chapter',stored);assert.equal(Object.hasOwn(stored,'novelId'),false);
 let response=await request('/api/chapters/'+entry.id,'PUT',{version:1,title:'Updated by an older client'});
 assert.equal(response.status,200,await response.clone().text());let saved=await response.json();
 for(const key of ['status','chapterNumber','connectedArcIds'])assert.deepEqual(saved[key],entry[key]);
 await library.deleteNovelAssociation('author',association.id,association.version);
 sqlite.prepare('DELETE FROM story_arcs WHERE id = ?').run(arc.id);
 response=await request('/api/chapters/'+entry.id,'PUT',{version:saved.version,summary:'The prior connection is still visible.',connectedArcIds:[arc.id]});
 assert.equal(response.status,200,await response.clone().text());saved=await response.json();assert.deepEqual(saved.connectedArcIds,[arc.id]);
 response=await request('/api/chapters/'+entry.id,'PUT',{version:saved.version,status:'complete',chapterNumber:15,connectedArcIds:[]});
 assert.equal(response.status,200,await response.clone().text());saved=await response.json();assert.equal(saved.status,'complete');assert.equal(saved.chapterNumber,15);assert.deepEqual(saved.connectedArcIds,[]);
 assert.equal((await request('/api/chapters/'+entry.id,'PUT',{version:saved.version,connectedArcIds:[arc.id]})).status,400);
 assert.deepEqual(await get('/api/chapters/'+entry.id),saved);
 const child=await scene(entry.id,{status:'draft'});
 assert.equal(child.status,'draft');for(const key of ['chapterNumber','connectedArcIds'])assert.equal(Object.hasOwn(child,key),false,key);
});

test('chapter metadata rejects invalid bounds and new arcs outside the owner and parent novel without losing stored data',async t=>{
 const {request,get,chapter,env}=setup(t),parent=await chapter(),library=repository(env.DB);
 const owned=await library.createStoryArc('author',crypto.randomUUID(),{name:'Unlinked arc'}),foreign=await library.createStoryArc('other',crypto.randomUUID(),{name:'Foreign arc'});
 const otherNovel=await library.createNovel('author',crypto.randomUUID(),{title:'Another novel'});
 await library.createNovelAssociation('author',crypto.randomUUID(),otherNovel.id,'story_arc',owned.id,'referenced_by','');
 const path='/api/chapters/'+parent.id;
 for(const bad of [{status:'published'},{status:null},{chapterNumber:0},{chapterNumber:10000},{chapterNumber:1.5},{chapterNumber:'2'},{chapterNumber:null},{connectedArcIds:null},{connectedArcIds:'arc'},{connectedArcIds:['bad']},{connectedArcIds:[owned.id,owned.id]},{connectedArcIds:Array.from({length:51},()=>crypto.randomUUID())},{connectedArcIds:[owned.id]},{connectedArcIds:[foreign.id]},{connectedArcIds:[crypto.randomUUID()]}]){
  const response=await request(path,'PUT',{version:parent.version,...bad});
  assert.equal(response.status,400,JSON.stringify(bad)+': '+await response.text());assert.deepEqual(await get(path),parent);
 }
 assert.equal((await request(path+'?novelId='+otherNovel.id,'PUT',{version:parent.version,status:'complete'})).status,404);
 assert.equal((await request(path,'PUT',{version:parent.version,status:'complete'},'other')).status,404);
 await library.createNovelAssociation('author',crypto.randomUUID(),parent.novelId,'story_arc',owned.id,'referenced_by','');
 const response=await request(path,'PUT',{version:parent.version,status:'draft',chapterNumber:9999,connectedArcIds:[owned.id]});
 assert.equal(response.status,200,await response.clone().text());const saved=await response.json();assert.equal(saved.chapterNumber,9999);assert.deepEqual(saved.connectedArcIds,[owned.id]);
});

test('deleting a chapter removes its scenes atomically and preserves other manuscripts',async t=>{
 const {request,get,chapter,scene,sqlite}=setup(t);
 sqlite.exec('PRAGMA foreign_keys = ON');
 const parent=await chapter(),empty=await chapter(),other=await chapter(),foreign=await chapter({},'other');
 const entries=[await scene(parent.id),await scene(parent.id,{content:document('Second scene prose')})];
 const kept=await scene(other.id,{content:document('Other chapter prose')}),privateScene=await scene(foreign.id,{},'other');
 const novelId=crypto.randomUUID(),now=new Date().toISOString();
 sqlite.prepare('INSERT INTO novels (id,owner_id,document,created_at,updated_at) VALUES (?,?,?,?,?)').run(novelId,'author','{"title":"Another novel"}',now,now);
 const otherNovel=await chapter({novelId}),otherNovelScene=await scene(otherNovel.id,{content:document('Other novel prose')});
 const preserved=await Promise.all([get('/api/scenes/'+kept.id),get('/api/scenes/'+privateScene.id,'other'),get('/api/scenes/'+otherNovelScene.id)]);
 const response=await request('/api/chapters/'+parent.id+'?novelId='+parent.novelId,'DELETE',{version:parent.version});
 assert.equal(response.status,204,await response.clone().text());assert.equal(await response.text(),'');
 assert.equal((await request('/api/chapters/'+parent.id)).status,404);
 for(const entry of entries)assert.equal((await request('/api/scenes/'+entry.id)).status,404);
 assert.deepEqual(await Promise.all([get('/api/scenes/'+kept.id),get('/api/scenes/'+privateScene.id,'other'),get('/api/scenes/'+otherNovelScene.id)]),preserved);
 assert.deepEqual((await get('/api/chapters?novelId='+parent.novelId)).chapters.map(c=>c.id).sort(),[empty.id,other.id].sort());
 assert.equal((await request('/api/chapters/'+empty.id,'DELETE',{version:empty.version})).status,204);
 assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('invalid, stale, foreign and incorrectly scoped chapter deletions preserve all writing',async t=>{
 const {request,get,chapter,scene}=setup(t),parent=await chapter(),entry=await scene(parent.id,{content:document('Preserved prose')}),foreign=await chapter({},'other');
 assert.equal((await request('/api/chapters/'+parent.id,'PUT',{version:1,title:'Newer chapter'})).status,200);
 const before=await get('/api/chapters/'+parent.id),prose=await get('/api/scenes/'+entry.id),path='/api/chapters/'+parent.id;
 for(const body of [{},{version:0},{version:1.5},{version:Number.MAX_SAFE_INTEGER+1}])assert.equal((await request(path,'DELETE',body)).status,400);
 assert.equal((await request(path,'DELETE',{version:1})).status,409);
 assert.equal((await request(path,'DELETE',{version:2},'other')).status,404);
 assert.equal((await request(path,'DELETE',{version:2},null)).status,401);
 assert.equal((await request(path,'DELETE',{version:2},'author',{origin:'https://evil.example'})).status,403);
 assert.equal((await request(path+'?novelId='+foreign.novelId,'DELETE',{version:2})).status,404);
 assert.equal((await request('/api/scenes/'+entry.id,'DELETE',{version:1})).status,405);
 assert.deepEqual(await get(path),before);assert.deepEqual(await get('/api/scenes/'+entry.id),prose);
});

test('a chapter update after the delete read preserves its scenes and returns a conflict',async t=>{
 const {request,get,chapter,scene,sqlite,env}=setup(t),parent=await chapter(),entry=await scene(parent.id,{content:document('Keep concurrent prose')}),base=env.DB;
 const prose=await get('/api/scenes/'+entry.id);let interleaved=false;
 env.DB={...base,batch(statements){
  interleaved=true;
  sqlite.prepare('UPDATE chapters SET document = ?, version = version + 1 WHERE id = ?').run('{"title":"Concurrent chapter","summary":""}',parent.id);
  return base.batch(statements);
 }};
 assert.equal((await request('/api/chapters/'+parent.id,'DELETE',{version:1})).status,409);assert.ok(interleaved);
 assert.equal((await get('/api/chapters/'+parent.id)).title,'Concurrent chapter');
 assert.deepEqual(await get('/api/scenes/'+entry.id),prose);
});

test('collected chapters and scenes block deletion with an actionable conflict and roll back prose',async t=>{
 const {request,get,chapter,scene,sqlite}=setup(t);
 for(const kind of ['chapter','scene']){
  const parent=await chapter(),first=await scene(parent.id),second=await scene(parent.id,{content:document('Collected prose')}),collectionId=crypto.randomUUID(),now=new Date().toISOString();
  sqlite.prepare('INSERT INTO collections (id,owner_id,kind,document,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(collectionId,'author','manual','{"name":"Reading list"}',now,now);
  sqlite.prepare('INSERT INTO collection_members (owner_id,collection_id,target_kind,target_id,target_parent_id,created_at) VALUES (?,?,?,?,?,?)').run('author',collectionId,kind,kind==='chapter'?parent.id:second.id,'',now);
  const path='/api/chapters/'+parent.id,scenePaths=['/api/scenes/'+first.id,'/api/scenes/'+second.id];
  const before=await Promise.all([get(path),...scenePaths.map(path=>get(path))]);
  const response=await request(path,'DELETE',{version:parent.version});
  assert.equal(response.status,409,await response.clone().text());assert.match((await response.json()).error,/Remove those collection memberships/);
  assert.deepEqual(await Promise.all([get(path),...scenePaths.map(path=>get(path))]),before);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM collection_members WHERE collection_id = ?').get(collectionId).n,1);
  sqlite.prepare('DELETE FROM collection_members WHERE collection_id = ?').run(collectionId);
  assert.equal((await request(path,'DELETE',{version:parent.version})).status,204);
 }
});

test('storage failures during chapter deletion roll back every removed scene',async t=>{
 const {request,get,chapter,scene,sqlite}=setup(t),parent=await chapter(),entry=await scene(parent.id,{content:document('Keep failed deletion prose')});
 const path='/api/chapters/'+parent.id,before=await Promise.all([get(path),get('/api/scenes/'+entry.id)]);
 sqlite.exec("CREATE TRIGGER fail_chapter_delete BEFORE DELETE ON chapters BEGIN SELECT RAISE(ABORT, 'Injected deletion failure'); END");
 assert.equal((await request(path,'DELETE',{version:parent.version})).status,503);
 assert.deepEqual(await Promise.all([get(path),get('/api/scenes/'+entry.id)]),before);
});

test('chapters and scenes round-trip structured writing with deterministic content-free catalogs',async t=>{
 const {request,get,chapter,scene,sqlite}=setup(t),first=await chapter({title:'  The   beginning  ',summary:'Opening chapter'}),second=await chapter({title:'Afterward'});
 assert.equal(first.title,'The beginning');assert.equal(first.schemaVersion,1);assert.equal(first.version,1);assert.ok(first.createdAt);assert.equal(first.updatedAt,first.createdAt);
 const rich={type:'doc',content:[{type:'heading',attrs:{level:3},content:[text('A scene')]},{type:'paragraph',content:[{type:'text',text:'Exact <script> text & spaces  ',marks:[{type:'bold'},{type:'italic'},{type:'underline'},{type:'strike'}]},{type:'hardBreak'},text('Second line'),{type:'text',text:'const dawn = true',marks:[{type:'code'}]}]},{type:'orderedList',attrs:{start:3,type:'A'},content:[{type:'listItem',content:[paragraph('First'),{type:'bulletList',content:[{type:'listItem',content:[paragraph('Nested')]}]}]}]},{type:'blockquote',content:[paragraph('Remember this.')]},{type:'horizontalRule'}]};
 const one=await scene(first.id,{content:rich,summary:'Outline text'}),two=await scene(first.id,{title:'Second scene'}),other=await scene(second.id);
 for(const row of sqlite.prepare('SELECT document FROM chapters').all())assertDocumentSchema('chapter',JSON.parse(row.document));
 for(const row of sqlite.prepare('SELECT document FROM scenes').all())assertDocumentSchema('scene',JSON.parse(row.document));
 assert.deepEqual(one.content,rich);assert.deepEqual((await get('/api/scenes/'+one.id)).content,rich);assert.equal(one.chapterId,first.id);
 sqlite.prepare('UPDATE chapters SET created_at = ?').run('2026-01-01T00:00:00.000Z');sqlite.prepare('UPDATE scenes SET created_at = ?').run('2026-01-01T00:00:00.000Z');
 assert.deepEqual((await get('/api/chapters')).chapters.map(c=>c.id),[first.id,second.id].sort());
 const all=(await get('/api/scenes')).scenes;assert.deepEqual(all.map(s=>s.id),[one.id,two.id,other.id].sort());assert.ok(all.every(s=>s.schemaVersion===1&&!Object.hasOwn(s,'content')&&!Object.hasOwn(s,'ownerId')));
 assert.deepEqual((await get('/api/scenes?chapterId='+first.id)).scenes.map(s=>s.id),[one.id,two.id].sort());
 let response=await request('/api/scenes/'+one.id,'PUT',{version:1,chapterId:second.id,title:'New title',status:'revising'});assert.equal(response.status,200);const updated=await response.json();
 assert.equal(updated.version,2);assert.equal(updated.status,'revising');assert.deepEqual(updated.content,rich);assert.equal(updated.summary,'Outline text');assert.equal(updated.chapterId,second.id);
 response=await request('/api/chapters/'+first.id,'PUT',{version:1,title:'Revised chapter'});assert.equal(response.status,200);assert.equal((await response.json()).summary,'Opening chapter');
 assert.equal((await get('/api/scenes?chapterId='+first.id)).scenes.length,1);
});

test('writing reads and writes remain owner-scoped including scene parents and UUID collisions',async t=>{
 const {request,get,chapter,scene}=setup(t),parent=await chapter(),entry=await scene(parent.id,{content:document('Private writing')}),foreign=await chapter({},'other');
 for(const path of ['/api/chapters/'+parent.id,'/api/scenes/'+entry.id,'/api/scenes?chapterId='+parent.id])assert.equal((await request(path,'GET',undefined,'other')).status,404);
 assert.deepEqual((await get('/api/scenes','other')).scenes,[]);
 assert.deepEqual((await get('/api/chapters','other')).chapters.map(c=>c.id),[foreign.id]);
 assert.equal((await request('/api/scenes/'+entry.id,'PUT',{version:1,chapterId:foreign.id})).status,400);
 assert.equal((await request('/api/scenes','POST',{id:crypto.randomUUID(),chapterId:foreign.id,title:'Intrusion',status:'draft',contentSchemaVersion:1,content:emptyWritingContent()})).status,400);
 assert.equal((await request('/api/chapters','POST',{id:parent.id,title:'Replacement'},'other')).status,409);
 assert.equal((await request('/api/scenes','POST',{...entry,chapterId:foreign.id,title:'Replacement'},'other')).status,409);
 assert.equal((await request('/api/scenes/'+entry.id,'PUT',{...entry,title:'Replacement'},'other')).status,404);
 assert.equal((await get('/api/scenes/'+entry.id)).title,'First scene');
 for(const path of ['/api/chapters','/api/scenes','/api/scenes/'+entry.id])assert.equal((await request(path,'GET',undefined,null)).status,401);
});

test('UUID creation retries preserve existing writing and version checks reject stale or concurrent changes',async t=>{
 const {request,get,chapter,scene}=setup(t),parent=await chapter(),entry=await scene(parent.id,{content:document('Original writing')});
 const retry=await request('/api/scenes','POST',{id:entry.id,title:'Do not overwrite',content:null});assert.equal(retry.status,201);assert.deepEqual(await retry.json(),entry);
 const chapterRetry=await request('/api/chapters','POST',{id:parent.id,title:'Do not overwrite'});assert.equal(chapterRetry.status,201);assert.equal((await chapterRetry.json()).title,parent.title);
 const writes=await Promise.all([request('/api/scenes/'+entry.id,'PUT',{version:1,content:document('First writer')}),request('/api/scenes/'+entry.id,'PUT',{version:1,content:document('Second writer')})]);
 assert.deepEqual(writes.map(response=>response.status).sort(),[200,409]);
 const winner=await writes.find(response=>response.status===200).json(),stored=await get('/api/scenes/'+entry.id);assert.equal(stored.version,2);assert.deepEqual(stored,winner);
 assert.equal((await request('/api/scenes/'+entry.id,'PUT',{version:1,content:document('Stale overwrite')})).status,409);assert.deepEqual(await get('/api/scenes/'+entry.id),stored);
 assert.deepEqual((await get('/api/scenes')).scenes.map(s=>s.id),[entry.id]);
});

test('writing request gates reject cross-origin, non-JSON, invalid methods, malformed payloads and oversized bodies',async t=>{
 const {request,chapter,scene,get}=setup(t),parent=await chapter(),entry=await scene(parent.id),url='/api/scenes/'+entry.id;
 for(const headers of [{origin:'https://evil.example'},{origin:''},{'content-type':'text/plain'},{'content-type':'application/json-invalid'}])assert.equal((await request(url,'PUT',{version:1,title:'Changed'},'author',headers)).status,403);
 for(const method of ['DELETE','PATCH','HEAD','POST'])assert.equal((await request(url,method,method==='HEAD'?undefined:{})).status,405);
 assert.equal((await request('/api/scenes','PUT',{})).status,405);
 for(const body of ['{','null','[]','true'])assert.equal((await request(url,'PUT',body)).status,400);
 assert.equal((await request(url,'PUT','x'.repeat(writingRequestMaxBytes+1))).status,413);
 // The byte limit counts UTF-8, including multibyte text, before parsing JSON.
 assert.equal((await request(url,'PUT','界'.repeat(Math.ceil(writingRequestMaxBytes/3)+1))).status,413);
 assert.equal((await request('/api/scenes/not-an-id')).status,404);assert.equal((await request('/api/scenes?chapterId=bad')).status,404);
 assert.equal((await get(url)).version,1);
});

test('writing rejects identity changes, imprecise revisions, and newer envelope schemas without losing stored data',async t=>{
 const {request,get,chapter,scene}=setup(t),parent=await chapter(),entry=await scene(parent.id,{content:document('Keep this revision')});
 for(const [collection,record] of [['chapters',parent],['scenes',entry]]){
  for(const bad of [{id:crypto.randomUUID()},{id:null},{version:Number.MAX_SAFE_INTEGER+1},{schemaVersion:2},{schemaVersion:'1'}]){
   const response=await request(`/api/${collection}/${record.id}`,'PUT',{version:record.version,...bad});
   assert.equal(response.status,400,JSON.stringify(bad));
   assert.deepEqual(await get(`/api/${collection}/${record.id}`),record);
  }
 }
 assert.equal((await request('/api/chapters','POST',{id:crypto.randomUUID(),title:'Future chapter',schemaVersion:2})).status,400);
});

test('creation acknowledges its exact revision even when another writer saves before the insert returns',async t=>{
 const {sqlite}=setup(t),binding=d1Adapter(sqlite),id=crypto.randomUUID(),initial={title:'Original title',summary:'Original summary'};
 const interleaved={prepare(sql){
  const statement=binding.prepare(sql);
  return {bind(...args){
   const bound=statement.bind(...args);
   return {...bound,async run(){
    const result=await bound.run();
    if(sql.startsWith('INSERT INTO chapters')&&result.meta.changes)sqlite.prepare('UPDATE chapters SET document = ?, version = version + 1 WHERE id = ?').run(JSON.stringify({title:'Another writer',summary:'Keep this newer revision'}),id);
    return result;
   }};
  }};
 }};
 const created=await writingRepository(interleaved).createChapter('author',id,initial);
 assert.equal(created.version,1);assert.equal(created.title,initial.title);assert.equal(created.schemaVersion,1);
 const current=await writingRepository(binding).getChapter('author',id);
 assert.equal(current.version,2);assert.equal(current.title,'Another writer');
 assert.equal(await writingRepository(binding).saveChapter('author',created,{title:'Stale overwrite',summary:''}),null);
});

test('newer stored writing schemas fail closed in reads, catalogs, and saves',async t=>{
 const {request,chapter,scene,sqlite}=setup(t),parent=await chapter(),entry=await scene(parent.id,{content:document('Newer format must remain intact')});
 t.mock.method(console,'error',()=>{});
 sqlite.prepare('UPDATE scenes SET schema_version = 2, version = version + 1 WHERE id = ?').run(entry.id);
 const before=sqlite.prepare('SELECT * FROM scenes WHERE id = ?').get(entry.id);
 assert.equal((await request('/api/scenes/'+entry.id)).status,503);
 assert.equal((await request('/api/scenes')).status,503);
 assert.equal((await request('/api/scenes/'+entry.id,'PUT',{version:2,title:'An old client overwrite'})).status,503);
 // Even a stale in-memory caller that bypasses the decoder cannot downgrade
 // a stored format after reading a revision written by a newer deployment.
 assert.equal(await writingRepository(d1Adapter(sqlite)).saveScene('author',{...entry,version:2},{...entry,title:'Another old client overwrite'}),null);
 assert.deepEqual(sqlite.prepare('SELECT * FROM scenes WHERE id = ?').get(entry.id),before);
 sqlite.prepare('UPDATE chapters SET schema_version = 2, version = version + 1 WHERE id = ?').run(parent.id);
 assert.equal((await request('/api/chapters')).status,503);
 assert.equal((await request('/api/chapters/'+parent.id,'PUT',{version:2,title:'An old client overwrite'})).status,503);
});

test('an exhausted revision is never rounded into an unsafe version',async t=>{
 const {request,sqlite}=setup(t),id=crypto.randomUUID(),now='2026-09-24T12:00:00.000Z';
 sqlite.prepare('INSERT INTO chapters (id,owner_id,document,version,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id,'author',JSON.stringify({title:'Last exact revision',summary:''}),Number.MAX_SAFE_INTEGER,now,now);
 assert.equal((await request('/api/chapters/'+id,'PUT',{version:Number.MAX_SAFE_INTEGER,title:'Cannot increment exactly'})).status,409);
 assert.equal(sqlite.prepare('SELECT version FROM chapters WHERE id = ?').get(id).version,Number.MAX_SAFE_INTEGER);
});

test('writing metadata and content versions validate without mutating stored drafts',async t=>{
 const {request,get,chapter,scene}=setup(t),parent=await chapter(),entry=await scene(parent.id,{content:document('Retain me')});
 for(const bad of [{title:''},{title:' '},{title:'x'.repeat(161)},{summary:42},{summary:'x'.repeat(10001)},{status:'unknown'},{chapterId:'bad'},{contentSchemaVersion:2},{contentSchemaVersion:'1'},{content:null},{version:0},{version:1.5}])assert.equal((await request('/api/scenes/'+entry.id,'PUT',{version:1,...bad})).status,400,JSON.stringify(bad).slice(0,100));
 for(const bad of [{title:''},{summary:null},{version:0}])assert.equal((await request('/api/chapters/'+parent.id,'PUT',{version:1,...bad})).status,400);
 const base={id:crypto.randomUUID(),chapterId:parent.id,title:'Scene'};
 assert.equal((await request('/api/scenes','POST',{...base,content:emptyWritingContent()})).status,400);
 assert.equal((await request('/api/scenes','POST',{...base,contentSchemaVersion:1})).status,400);
 assert.deepEqual(await get('/api/scenes/'+entry.id),entry);
});

test('structured document validation rejects unsupported and silently lossy editor structures',()=>{
 const bad=[
  null,[],{type:'doc',content:[]},{type:'doc',content:[text('inline at root')]},
  {type:'doc',content:[{type:'codeBlock',content:[text('code')]}]},
  {type:'doc',content:[{type:'heading',attrs:{level:4},content:[text('Heading')]}]},
  {type:'doc',content:[{type:'paragraph',attrs:{onclick:'alert(1)'}}]},
  {type:'doc',content:[{type:'paragraph',content:[{type:'image',attrs:{src:'https://example.com'}}]}]},
  {type:'doc',content:[{type:'bulletList',content:[paragraph('Not a list item')]}]},
  {type:'doc',content:[{type:'orderedList',attrs:{start:0},content:[{type:'listItem',content:[paragraph('Item')]}]}]},
  {type:'doc',content:[{type:'orderedList',attrs:{type:'unsupported'},content:[{type:'listItem',content:[paragraph('Item')]}]}]},
  {type:'doc',content:[{type:'bulletList',content:[{type:'listItem',content:[{type:'heading',attrs:{level:1},content:[text('No initial paragraph')]}]}]}]},
  {type:'doc',content:[{type:'horizontalRule',content:[]}]},
  {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:''}]}]},
  {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Link',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]}]},
  {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Bold',marks:[{type:'bold',attrs:{style:'color:red'}}]}]}]},
  {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Mixed',marks:[{type:'code'},{type:'bold'}]}]}]},
 ];
 for(const value of bad)assert.throws(()=>validateWritingContent(value),Error,JSON.stringify(value));
 const original={type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'Kept',marks:[{type:'underline'}]}]}]},before=structuredClone(original);
 const clean=validateWritingContent(original);assert.deepEqual(clean,original);assert.notEqual(clean,original);assert.deepEqual(original,before);
});

test('structured document limits reject deep, cyclic, node-heavy and oversized content without truncation',()=>{
 let deep=paragraph('Deep');for(let index=0;index<31;index++)deep={type:'blockquote',content:[deep]};assert.throws(()=>validateWritingContent({type:'doc',content:[deep]}),/nesting/);
 const cycle={type:'blockquote',content:[]};cycle.content.push(cycle);assert.throws(()=>validateWritingContent({type:'doc',content:[cycle]}),/circular/);
 assert.throws(()=>validateWritingContent({type:'doc',content:Array.from({length:20000},()=>({type:'paragraph'}))}),/too many elements/);
 assert.throws(()=>validateWritingContent(document('x'.repeat(200001))),/200,000/);
 // JSON escapes count toward bytes even when the text-character limit is met.
 assert.throws(()=>validateWritingContent(document('\u0000'.repeat(200000))),/1 MiB/);
 const large=document('exact words '.repeat(10000));assert.deepEqual(validateWritingContent(large),large);assert.equal(contentText(large),'exact words '.repeat(10000));
 assert.equal(contentText({type:'doc',content:[paragraph('First'),{type:'paragraph',content:[text('Second'),{type:'hardBreak'},text('Third')]}]}),'First\nSecond\nThird');
});

test('schema-valid content near the byte limit still saves with its metadata envelope',async t=>{
 const {request,get,chapter}=setup(t),parent=await chapter(),content=document('\u0000'.repeat(174730));
 const bytes=new TextEncoder().encode(JSON.stringify(content)).byteLength;assert.ok(bytes<writingContentLimits.bytes);assert.ok(bytes>writingContentLimits.bytes-500);
 const payload={id:crypto.randomUUID(),chapterId:parent.id,title:'Near the content limit',summary:'x'.repeat(10000),status:'draft',contentSchemaVersion:1,content};
 assert.ok(new TextEncoder().encode(JSON.stringify(payload)).byteLength>writingContentLimits.bytes);
 const response=await request('/api/scenes','POST',payload);assert.equal(response.status,201,await response.clone().text());assert.deepEqual((await get('/api/scenes/'+payload.id)).content,content);
});

test('stored writing schema is compatible with the installed StarterKit and survives its JSON round trip',()=>{
 const schema=getSchema([StarterKit.configure({heading:{levels:[1,2,3]},codeBlock:false,link:false,trailingNode:false})]);
 const fixture={type:'doc',content:[
  {type:'paragraph'},
  ...[1,2,3].map(level=>({type:'heading',attrs:{level},content:[text('Heading '+level)]})),
  {type:'paragraph',content:[...['bold','italic','strike','underline','code'].map(type=>({type:'text',text:type+' ',marks:[{type}]})),{type:'hardBreak'},text('After break')]},
  {type:'blockquote',content:[paragraph('Quoted text')]},
  {type:'bulletList',content:[{type:'listItem',content:[paragraph('Bullet'),{type:'blockquote',content:[paragraph('Nested quote')]}]}]},
  ...[null,'1','a','A','i','I'].map(type=>({type:'orderedList',attrs:{start:7,type},content:[{type:'listItem',content:[paragraph('Numbered '+type)]}]})),
  {type:'horizontalRule'},
 ]};
 const stored=validateWritingContent(fixture),editor=schema.nodeFromJSON(stored);editor.check();
 // ProseMirror uses null-prototype attribute objects internally; persistence
 // compares their JSON value, not an implementation-specific object prototype.
 assert.deepEqual(JSON.parse(JSON.stringify(editor.toJSON())),stored);
 assert.deepEqual(validateWritingContent(editor.toJSON()),stored);
 assert.deepEqual(schema.nodeFromJSON(emptyWritingContent()).toJSON(),emptyWritingContent());
});

test('additive writing migration preserves existing character and lore storage',()=>{
 const sqlite=new DatabaseSync(':memory:');
 try{
  const writingMigration=migrations.find(file=>file.startsWith('0009_'));assert.ok(writingMigration);
  for(const file of migrations.filter(file=>file<writingMigration))sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
  const now='2026-01-01T00:00:00.000Z',character='{"name":"Existing character","history":"Keep exactly"}',lore='{"type":"note","name":"Existing note","body":"Keep [1] text"}';
  sqlite.prepare('INSERT INTO character_drafts (id,owner_id,document,version,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('existing-character','author',character,7,now,now);
  sqlite.prepare('INSERT INTO lore_entries (id,owner_id,document,version,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('existing-note','author',lore,5,now,now);
  const before=sqlite.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').all('table').map(row=>row.name);
  sqlite.exec(readFileSync('drizzle/'+writingMigration,'utf8'));
  assert.equal(sqlite.prepare('SELECT document FROM character_drafts').get().document,character);assert.equal(sqlite.prepare('SELECT version FROM character_drafts').get().version,7);
  assert.equal(sqlite.prepare('SELECT document FROM lore_entries').get().document,lore);assert.equal(sqlite.prepare('SELECT version FROM lore_entries').get().version,5);
  const after=sqlite.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').all('table').map(row=>row.name);assert.deepEqual(after,[...before,'chapters','scenes'].sort());
 }finally{sqlite.close();}
});
