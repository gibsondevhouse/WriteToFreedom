import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {repository} from '../server/db.js';
import {assertDocumentSchema} from './helpers/document-schema.mjs';

function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 return {sqlite,db:repository(d1Adapter(sqlite))};
}
const novel=(title,seriesId='')=>({title,synopsis:'',status:'drafting',coverUrl:'',seriesId,seriesOrder:0,hiddenFields:[]});
const series=title=>({title,summary:'',coverUrl:'',hiddenFields:[]});

test('novels and series have owner-scoped CRUD and conditional revisions',async t=>{
 const {db,sqlite}=setup(t),owner='author',other='other',novelId=crypto.randomUUID(),seriesId=crypto.randomUUID();
 const firstSeries=await db.createSeries(owner,seriesId,series('Cycle'));
 const firstNovel=await db.createNovel(owner,novelId,novel('First',seriesId));
 assert.equal(firstSeries.version,1);assert.equal(firstNovel.version,1);
 assert.equal(firstNovel.schemaVersion,1);assert.equal(firstNovel.seriesId,seriesId);
 assertDocumentSchema('series',JSON.parse(sqlite.prepare('SELECT document FROM series WHERE id = ?').get(seriesId).document));
 assertDocumentSchema('novel',JSON.parse(sqlite.prepare('SELECT document FROM novels WHERE id = ?').get(novelId).document));
 assert.deepEqual(await db.getNovel(other,novelId),null);assert.deepEqual(await db.getSeries(other,seriesId),null);
 assert.deepEqual(await db.listNovels(other),[]);assert.deepEqual(await db.listSeries(other),[]);
 assert.equal((await db.createNovel(owner,novelId,novel('Not an overwrite'))).title,'First');
 assert.equal(await db.createNovel(other,novelId,novel('Foreign collision')),null);
 const savedNovel=await db.saveNovel(owner,novelId,1,{...novel('Revised',seriesId),seriesOrder:2});
 const savedSeries=await db.saveSeries(owner,seriesId,3,series('Revised cycle'));
 assert.equal(savedNovel.version,2);assert.equal(savedNovel.seriesOrder,2);assert.equal(savedSeries.version,4);
 assert.equal(await db.saveNovel(owner,novelId,1,novel('Stale')),null);
 assert.equal(await db.saveSeries(owner,seriesId,1,series('Stale')),null);
 assert.equal(await db.saveNovel(other,novelId,2,novel('Intrusion')),null);
 assert.equal((await db.getNovel(owner,novelId)).title,'Revised');
 assert.equal((await db.listNovels(owner)).length,1);assert.equal((await db.listSeries(owner)).length,1);
});

test('novel associations are idempotent, independently versioned, and unlink without deleting targets',async t=>{
 const {db,sqlite}=setup(t),owner='author',novelId=crypto.randomUUID(),characterId=crypto.randomUUID(),associationId=crypto.randomUUID();
 await db.createNovel(owner,novelId,novel('Linked'));
 const now=new Date().toISOString();
 sqlite.prepare('INSERT INTO character_drafts (id, owner_id, document, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)').run(characterId,owner,JSON.stringify({name:'Kept character'}),now,now);
 const first=await db.createNovelAssociation(owner,associationId,novelId,'character',characterId,'appears_in','Opening scene');
 assert.equal(first.id,associationId);assert.equal(first.version,1);
 assert.equal((await db.listNovelAssociations(owner,novelId)).length,1);
 assert.equal((await db.listNovelAssociationsByTarget(owner,'character',characterId)).length,1);
 const retry=await db.createNovelAssociation(owner,crypto.randomUUID(),novelId,'character',characterId,'linked','Do not replace');
 assert.deepEqual(retry,first);
 const saved=await db.saveNovelAssociation(owner,associationId,1,'referenced_by','Later mention');
 assert.equal(saved.version,2);assert.equal(saved.relationKind,'referenced_by');assert.equal(saved.prose,'Later mention');
 assert.equal(await db.saveNovelAssociation(owner,associationId,1,'linked','Stale'),null);
 assert.equal(await db.getNovelAssociation('other',associationId),null);
 assert.equal(await db.createNovelAssociation('other',crypto.randomUUID(),novelId,'character',characterId,'linked',''),null);
 assert.equal(await db.deleteNovelAssociation('other',associationId,2),false);
 assert.equal(await db.deleteNovelAssociation(owner,associationId,1),false);assert.deepEqual(await db.getNovelAssociation(owner,associationId),saved);
 assert.equal(await db.deleteNovelAssociation(owner,associationId,2),true);
 assert.equal(await db.getNovelAssociation(owner,associationId),null);
 assert.ok(sqlite.prepare('SELECT id FROM character_drafts WHERE owner_id = ? AND id = ?').get(owner,characterId));
});

test('membership inserts, moves and order edits advance affected series once; retries and metadata do not',async t=>{
 const {db}=setup(t),owner='author',a=await db.createSeries(owner,crypto.randomUUID(),series('A')),b=await db.createSeries(owner,crypto.randomUUID(),series('B')),id=crypto.randomUUID();
 const first=await db.createNovel(owner,id,novel('One',a.id));assert.equal((await db.getSeries(owner,a.id)).version,2);
 assert.deepEqual(await db.createNovel(owner,id,novel('Retry',b.id)),first);assert.equal((await db.getSeries(owner,a.id)).version,2);assert.equal((await db.getSeries(owner,b.id)).version,1);
 assert.equal(await db.createNovel('other',id,novel('Foreign collision')),null);
 const foreign=await db.createNovel('other',crypto.randomUUID(),novel('Foreign'));assert.equal(await db.createNovel(owner,foreign.id,novel('Collision',b.id)),null);assert.equal((await db.getSeries(owner,b.id)).version,1);
 const metadata=await db.saveNovel(owner,id,1,{...novel('Renamed',a.id),synopsis:'Exact prose'});assert.equal(metadata.version,2);assert.equal((await db.getSeries(owner,a.id)).version,2);
 const ordered=await db.saveNovel(owner,id,2,{...metadata,seriesOrder:4});assert.equal(ordered.version,3);assert.equal((await db.getSeries(owner,a.id)).version,3);
 const moved=await db.saveNovel(owner,id,3,{...ordered,seriesId:b.id});assert.equal(moved.version,4);assert.equal(moved.synopsis,'Exact prose');assert.equal((await db.getSeries(owner,a.id)).version,4);assert.equal((await db.getSeries(owner,b.id)).version,2);
 const detached=await db.saveNovel(owner,id,4,{...moved,seriesId:''});assert.equal(detached.version,5);assert.equal((await db.getSeries(owner,b.id)).version,3);
});

test('creation cannot use a series snapshot superseded by a concurrent reorder',async t=>{
 const {db,sqlite}=setup(t),owner='author',group=await db.createSeries(owner,crypto.randomUUID(),series('Cycle')),member=await db.createNovel(owner,crypto.randomUUID(),novel('Member',group.id)),base=d1Adapter(sqlite),id=crypto.randomUUID();let once=true;
 const racing=repository({...base,async batch(statements){if(once){once=false;assert.ok(await db.reorderSeriesNovels(owner,group.id,2,[member.id]));}return base.batch(statements);}});
 assert.equal(await racing.createNovel(owner,id,novel('Concurrent new member',group.id)),null);
 assert.equal(await db.getNovel(owner,id),null);assert.equal((await db.getSeries(owner,group.id)).version,3);assert.equal((await db.getNovel(owner,member.id)).version,2);
});

test('order edits conflict with a reorder that commits after their snapshots',async t=>{
 const {db,sqlite}=setup(t),owner='author',group=await db.createSeries(owner,crypto.randomUUID(),series('Cycle')),member=await db.createNovel(owner,crypto.randomUUID(),novel('Member',group.id)),base=d1Adapter(sqlite);let once=true;
 const racing=repository({...base,async batch(statements){if(once){once=false;assert.ok(await db.reorderSeriesNovels(owner,group.id,2,[member.id]));}return base.batch(statements);}});
 assert.equal(await racing.saveNovel(owner,member.id,1,{...novel('Unsaved title',group.id),seriesOrder:9,synopsis:'Unsaved prose'}),null);
 const stored=await db.getNovel(owner,member.id);assert.equal(stored.seriesOrder,0);assert.equal(stored.title,'Member');assert.equal(stored.synopsis,'');assert.equal(stored.version,2);assert.equal((await db.getSeries(owner,group.id)).version,3);
});

for(const changed of ['old','new'])test(`moving between series rolls back when the ${changed} series snapshot becomes stale`,async t=>{
 const {db,sqlite}=setup(t),owner='author',a=await db.createSeries(owner,crypto.randomUUID(),series('A')),b=await db.createSeries(owner,crypto.randomUUID(),series('B')),member=await db.createNovel(owner,crypto.randomUUID(),novel('Member',a.id)),base=d1Adapter(sqlite);let once=true;
 const racing=repository({...base,async batch(statements){if(once){once=false;const group=changed==='old'?a:b;assert.ok(await db.saveSeries(owner,group.id,changed==='old'?2:1,series('Changed '+changed)));}return base.batch(statements);}});
 assert.equal(await racing.saveNovel(owner,member.id,1,{...novel('Must remain unchanged',b.id),seriesOrder:3}),null);
 assert.deepEqual(await db.getNovel(owner,member.id),member);assert.equal((await db.getSeries(owner,a.id)).version,changed==='old'?3:2);assert.equal((await db.getSeries(owner,b.id)).version,changed==='new'?2:1);
});

test('membership batches roll back novel and earlier series writes if a later series update fails',async t=>{
 const {db,sqlite}=setup(t),owner='author',a=await db.createSeries(owner,crypto.randomUUID(),series('A')),b=await db.createSeries(owner,crypto.randomUUID(),series('B')),member=await db.createNovel(owner,crypto.randomUUID(),novel('Member',a.id));
 const before=sqlite.prepare('SELECT * FROM series ORDER BY id').all();
 sqlite.exec(`CREATE TRIGGER injected_series_failure BEFORE UPDATE ON series WHEN OLD.id = '${b.id}' BEGIN SELECT RAISE(ABORT, 'injected late series failure'); END`);
 await assert.rejects(db.saveNovel(owner,member.id,1,novel('Unsaved',b.id)),/injected late series failure/);
 assert.deepEqual(await db.getNovel(owner,member.id),member);assert.deepEqual(sqlite.prepare('SELECT * FROM series ORDER BY id').all(),before);
 const id=crypto.randomUUID();await assert.rejects(db.createNovel(owner,id,novel('Unsaved creation',b.id)),/injected late series failure/);assert.equal(await db.getNovel(owner,id),null);assert.deepEqual(sqlite.prepare('SELECT * FROM series ORDER BY id').all(),before);
});

test('membership saves acknowledge the exact request even if another writer saves before batch returns',async t=>{
 const {db,sqlite}=setup(t),owner='author',group=await db.createSeries(owner,crypto.randomUUID(),series('Cycle')),member=await db.createNovel(owner,crypto.randomUUID(),novel('Member',group.id)),base=d1Adapter(sqlite);let once=true;
 const interleaved=repository({...base,async batch(statements){const result=await base.batch(statements);if(once){once=false;const saved=await db.getNovel(owner,member.id);assert.ok(await db.saveNovel(owner,member.id,saved.version,{...saved,title:'Later writer',synopsis:'Later prose'}));}return result;}});
 const acknowledged=await interleaved.saveNovel(owner,member.id,1,{...novel('Acknowledged title',group.id),seriesOrder:7,synopsis:'Acknowledged prose'});
 assert.equal(acknowledged.version,2);assert.equal(acknowledged.title,'Acknowledged title');assert.equal(acknowledged.synopsis,'Acknowledged prose');
 const persisted=await db.getNovel(owner,member.id);assert.equal(persisted.version,3);assert.equal(persisted.title,'Later writer');assert.equal((await db.getSeries(owner,group.id)).version,3);
});

test('metadata saves acknowledge their returned SQL revision rather than a later writer revision',async t=>{
 const {db,sqlite}=setup(t),owner='author',member=await db.createNovel(owner,crypto.randomUUID(),novel('Member')),base=d1Adapter(sqlite);let once=true;
 const interleaved=repository({...base,prepare(sql){const statement=base.prepare(sql);return {bind(...args){const bound=statement.bind(...args);return {...bound,async first(){const result=await bound.first();if(once&&sql.startsWith('UPDATE novels SET document')){once=false;assert.ok(await db.saveNovel(owner,member.id,2,novel('Later writer')));}return result;}};}};}});
 const acknowledged=await interleaved.saveNovel(owner,member.id,1,{...novel('Acknowledged'),synopsis:'Requested prose'});
 assert.equal(acknowledged.version,2);assert.equal(acknowledged.title,'Acknowledged');assert.equal(acknowledged.synopsis,'Requested prose');
 const persisted=await db.getNovel(owner,member.id);assert.equal(persisted.version,3);assert.equal(persisted.title,'Later writer');
});

test('repository reorder rejects duplicate member IDs without changing either member',async t=>{
 const {db,sqlite}=setup(t),owner='author',group=await db.createSeries(owner,crypto.randomUUID(),series('Cycle')),a=await db.createNovel(owner,crypto.randomUUID(),novel('A',group.id));
 await db.createNovel(owner,crypto.randomUUID(),novel('B',group.id));
 const before=sqlite.prepare('SELECT * FROM novels ORDER BY id').all(),beforeSeries=await db.getSeries(owner,group.id);
 assert.equal(await db.reorderSeriesNovels(owner,group.id,beforeSeries.version,[a.id,a.id]),null);
 assert.deepEqual(sqlite.prepare('SELECT * FROM novels ORDER BY id').all(),before);assert.deepEqual(await db.getSeries(owner,group.id),beforeSeries);
});
