import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {repository} from '../server/db.js';
import {decodeStoredDocument} from '../server/document-storage.js';

const migrations=readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort();
const now='2026-09-24T12:00:00.000Z';
function setup(t,through='9999'){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const name of migrations.filter(name=>name<through))sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
 return sqlite;
}
function insert(sqlite,table,values){
 return sqlite.prepare(`INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.keys(values).map(()=>'?').join(',')})`).run(...Object.values(values));
}
const row=(id,document='{}',owner='author')=>({id,owner_id:owner,document,version:1,created_at:now,updated_at:now});
const profileTargets={faction_profiles:['faction_id','sample-ember'],country_profiles:['location_id','sample-kingdom'],city_profiles:['location_id','sample-capital'],location_details:['location_id','sample-royal-archive']};
function fixture(table){
 const target=profileTargets[table];
 if(target)return {owner_id:'author',[target[0]]:target[1],document:'{}',version:1,...(table==='location_details'?{}:{updated_at:now})};
 return {...row('entry'),...(table==='scenes'?{chapter_id:'chapter',document:'{"chapterId":"chapter"}'}:{})};
}

test('all document tables reject malformed envelopes and unsafe revisions at the SQL boundary',t=>{
 const sqlite=setup(t);insert(sqlite,'chapters',row('chapter'));
 for(const table of ['character_drafts','lore_entries','story_arcs','novels','series','chapters','scenes',...Object.keys(profileTargets)]){
  const valid=fixture(table);
  for(const document of ['not json','null','[]','"text"','42'])assert.throws(()=>insert(sqlite,table,{...valid,document}),/invalid JSON|must be an object/,table);
  for(const version of [0,-1,1.5,9007199254740992])assert.throws(()=>insert(sqlite,table,{...valid,version}),/invalid revision/,table);
  for(const schema_version of [0,-1,1.5])assert.throws(()=>insert(sqlite,table,{...valid,schema_version}),/invalid schema version/,table);
  assert.throws(()=>insert(sqlite,table,{...valid,owner_id:' '}),/identity is required/,table);
  insert(sqlite,table,valid);
  assert.throws(()=>sqlite.prepare(`UPDATE ${table} SET document = ? WHERE owner_id = ?`).run('{"changed":true}','author'),/revision must advance|conflicting chapter/,table);
  assert.throws(()=>sqlite.prepare(`UPDATE ${table} SET owner_id = ?`).run('another-author'),/immutable identity/,table);
  const idColumn=profileTargets[table]?.[0]||'id';
  assert.throws(()=>sqlite.prepare(`UPDATE ${table} SET ${idColumn} = ?`).run('renamed'),/immutable identity|invalid owner-scoped target/,table);
 }
});

test('novel and series revisions advance exactly once and typed associations keep immutable owner-scoped identities',t=>{
 const sqlite=setup(t);sqlite.exec('PRAGMA foreign_keys = OFF');
 for(const table of ['novels','series']){
  const id=table+'-revision';insert(sqlite,table,row(id));
  assert.throws(()=>sqlite.prepare(`UPDATE ${table} SET version = version + 2 WHERE id = ?`).run(id),/revision must advance exactly once/);
  assert.throws(()=>sqlite.prepare(`UPDATE ${table} SET schema_version = 2 WHERE id = ?`).run(id),/revision must advance exactly once/);
  sqlite.prepare(`UPDATE ${table} SET document = ?, version = version + 1 WHERE id = ?`).run('{"title":"Saved"}',id);
  assert.equal(sqlite.prepare(`SELECT version FROM ${table} WHERE id = ?`).get(id).version,2);
 }
 insert(sqlite,'novels',row('association-novel'));
 insert(sqlite,'novels',row('foreign-novel','{}','another-author'));
 insert(sqlite,'character_drafts',row('character'));
 const association={id:'association',owner_id:'author',novel_id:'association-novel',target_kind:'character',target_id:'character',relation_kind:'appears_in',prose:'',version:1,created_at:now,updated_at:now};
 for(const field of ['id','owner_id','novel_id','target_kind','target_id'])assert.throws(()=>insert(sqlite,'novel_associations',{...association,[field]:' '}),/identity is required/);
 assert.throws(()=>insert(sqlite,'novel_associations',{...association,relation_kind:'invalid'}),/invalid relation kind/);
 for(const version of [0,-1,1.5,9007199254740992])assert.throws(()=>insert(sqlite,'novel_associations',{...association,version}),/invalid revision/);
 assert.throws(()=>insert(sqlite,'novel_associations',{...association,novel_id:'foreign-novel'}),/same owner/);
 assert.throws(()=>insert(sqlite,'novel_associations',{...association,novel_id:'missing'}),/same owner/);
 insert(sqlite,'novel_associations',association);
 for(const field of ['id','owner_id','novel_id','target_kind','target_id'])assert.throws(()=>sqlite.prepare(`UPDATE novel_associations SET ${field} = ? WHERE id = ?`).run('changed','association'),/immutable identity/);
 assert.throws(()=>sqlite.prepare('UPDATE novel_associations SET version = version + 2 WHERE id = ?').run('association'),/revision must advance exactly once/);
 assert.throws(()=>sqlite.prepare('UPDATE novel_associations SET prose = ? WHERE id = ?').run('Unsafely changed','association'),/revision must advance exactly once/);
 assert.throws(()=>insert(sqlite,'novel_associations',{...association,id:'duplicate'}),/UNIQUE constraint failed/);
 sqlite.prepare('UPDATE novel_associations SET prose = ?, relation_kind = ?, version = version + 1 WHERE id = ?').run('Saved appearance','linked','association');
 assert.equal(sqlite.prepare('SELECT version FROM novel_associations WHERE id = ?').get('association').version,2);
});

test('scene parent ownership and duplicate chapter identities cannot diverge even with foreign keys disabled',t=>{
 const sqlite=setup(t);sqlite.exec('PRAGMA foreign_keys = OFF');
 insert(sqlite,'chapters',row('mine'));insert(sqlite,'chapters',row('theirs','{}','another-author'));
 const scene={...row('scene','{"chapterId":"mine"}'),chapter_id:'mine'};
 for(const chapter_id of ['missing','theirs'])assert.throws(()=>insert(sqlite,'scenes',{...scene,chapter_id,document:JSON.stringify({chapterId:chapter_id})}),/same owner/);
 assert.throws(()=>insert(sqlite,'scenes',{...scene,document:'{"chapterId":"theirs"}'}),/conflicting chapter/);
 insert(sqlite,'scenes',scene);
 assert.throws(()=>sqlite.prepare('UPDATE scenes SET chapter_id = ?, document = ?, version = 2').run('theirs','{"chapterId":"theirs"}'),/same owner/);
 assert.throws(()=>sqlite.prepare('DELETE FROM chapters WHERE id = ?').run('mine'),/still reference/);
 assert.equal(sqlite.prepare('SELECT chapter_id FROM scenes').get().chapter_id,'mine');
});

test('profile targets must match the owner and entity type while private sample overlays remain valid',t=>{
 const sqlite=setup(t);
 insert(sqlite,'factions',{id:'faction',owner_id:'author',name:'Guild',name_key:'guild',created_at:now});
 for(const type of ['country','city','planet'])insert(sqlite,'locations',{id:type,owner_id:'author',name:type,type,parent_id:type==='city'?'country':null,created_at:now});
 for(const [table,target] of Object.entries(profileTargets)){
  const id=table==='faction_profiles'?'faction':table==='country_profiles'?'country':table==='city_profiles'?'city':'planet';
  assert.throws(()=>insert(sqlite,table,{...fixture(table),[target[0]]:'missing'}),/invalid owner-scoped target/);
  assert.throws(()=>insert(sqlite,table,{...fixture(table),[target[0]]:id,owner_id:'another-author'}),/invalid owner-scoped target/);
  insert(sqlite,table,{...fixture(table),[target[0]]:id});
  insert(sqlite,table,fixture(table));
  insert(sqlite,table,{...fixture(table),owner_id:'another-author'});
 }
 assert.throws(()=>insert(sqlite,'country_profiles',{...fixture('country_profiles'),location_id:'city'}),/invalid owner-scoped target/);
 assert.throws(()=>sqlite.prepare('DELETE FROM locations WHERE id = ?').run('country'),/still references/);
 assert.throws(()=>sqlite.prepare('UPDATE locations SET type = ? WHERE id = ?').run('city','country'),/immutable type|invalid parent/);
});

test('schema upgrade preserves exact legacy bytes, revisions and timestamps and defaults only the format version',t=>{
 const sqlite=setup(t,'0010');
 const document=' { "name": "Original", "notes": [] } ';
 insert(sqlite,'character_drafts',{...row('existing',document),version:7});
 insert(sqlite,'location_details',{...fixture('location_details'),document:'{"name":"Private archive"}',version:3});
 for(const name of migrations.filter(name=>name>='0010'))sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
 assert.deepEqual({...sqlite.prepare('SELECT * FROM character_drafts').get()},{...row('existing',document),version:7,schema_version:1});
 assert.equal(sqlite.prepare('SELECT version FROM location_details').get().version,3);
 assert.equal(sqlite.prepare('SELECT schema_version FROM location_details').get().schema_version,1);
});

test('location parent checks serialize concurrent reparenting and roll back the losing profile write',async t=>{
 const sqlite=setup(t),db=repository(d1Adapter(sqlite));
 const place=(id,type,parentId,owner='author')=>insert(sqlite,'locations',{id,owner_id:owner,name:id,type,parent_id:parentId,created_at:now});
 place('area-a','area','sample-capital');place('area-b','area','sample-capital');
 place('foreign','area','sample-capital','another-author');
 for(const parentId of ['foreign','missing','sample-kingdom'])assert.throws(()=>place('invalid','area',parentId),/invalid parent/);
 assert.throws(()=>place('invalid','city',null),/invalid parent/);
 // Both requests could validate their parents against the same original catalog.
 // The second committed SQL write must check the new graph inside its batch.
 await db.saveLocationDetails('author','area-a',0,{name:'Area A',parentId:'area-b'});
 assert.throws(()=>sqlite.prepare('DELETE FROM locations WHERE id = ?').run('area-b'),/children still reference/);
 await assert.rejects(()=>db.saveLocationDetails('author','area-b',0,{name:'Area B',parentId:'area-a'}),/hierarchy cycle/);
 assert.equal(sqlite.prepare('SELECT parent_id FROM locations WHERE id = ?').get('area-b').parent_id,'sample-capital');
 assert.equal(sqlite.prepare('SELECT * FROM location_details WHERE location_id = ?').get('area-b'),undefined);
 const recovered=await db.saveLocationDetails('author','area-b',0,{name:'Area B',parentId:'sample-capital'});
 assert.equal(recovered.version,1);
});

test('unknown stored document formats fail closed and cannot be overwritten through repositories',async t=>{
 const sqlite=setup(t),db=repository(d1Adapter(sqlite));
 insert(sqlite,'lore_entries',{...row('future','{"name":"Keep"}'),schema_version:2});
 assert.throws(()=>decodeStoredDocument({document:'{}',schema_version:2}),/Unsupported stored document/);
 await assert.rejects(()=>db.getLore('author','future'),/Unsupported stored document/);
 assert.equal(await db.saveLore('author','future',1,{name:'Overwrite'}),null);
 assert.equal(sqlite.prepare('SELECT document FROM lore_entries').get().document,'{"name":"Keep"}');
});

test('rejected future-format profile writes cannot rename their catalog rows',async t=>{
 const sqlite=setup(t),db=repository(d1Adapter(sqlite));
 const cases=[
  ['city_profiles','saveCity','city','sample-kingdom'],
  ['country_profiles','saveCountry','country',null],
  ['location_details','saveLocationDetails','planet',null],
  ['faction_profiles','saveFaction','faction',null],
 ];
 for(const [table,method,type,parentId] of cases){
  const id=crypto.randomUUID(),document={name:'Future name',parentId};
  if(type==='faction')insert(sqlite,'factions',{id,owner_id:'author',name:'Original name',name_key:'original',created_at:now});
  else insert(sqlite,'locations',{id,owner_id:'author',name:'Original name',type,parent_id:parentId,created_at:now});
  insert(sqlite,table,{...fixture(table),[profileTargets[table][0]]:id,document:JSON.stringify(document),version:2,schema_version:2});
  assert.equal(await db[method]('author',id,1,document),null);
  assert.equal(sqlite.prepare(`SELECT name FROM ${type==='faction'?'factions':'locations'} WHERE id = ?`).get(id).name,'Original name');
 }
});

test('character, lore and arc save acknowledgements describe their own committed revision',async t=>{
 const sqlite=setup(t),base=d1Adapter(sqlite);
 for(const [table,save,get] of [['character_drafts','save','get'],['lore_entries','saveLore','getLore'],['story_arcs','saveStoryArc','getStoryArc']]){
  const id=crypto.randomUUID();insert(sqlite,table,row(id,'{"name":"Initial"}'));
  let interleaved=false;
  // A later writer commits after the first query executes but before its caller
  // resumes. A follow-up SELECT would acknowledge the wrong writer's revision.
  const binding={...base,prepare(sql){const prepared=base.prepare(sql);return {bind(...args){const statement=prepared.bind(...args);return Object.fromEntries(['first','all','run'].map(method=>[method,async()=>{
   const result=await statement[method]();
   if(!interleaved&&sql.startsWith('UPDATE '+table)){
    interleaved=true;
    sqlite.prepare(`UPDATE ${table} SET document = ?, version = version + 1 WHERE id = ?`).run('{"name":"Later writer"}',id);
   }
   return result;
  }]));}};}};
  const db=repository(binding),saved=await db[save]('author',id,1,{name:'My writer'});
  assert.equal(saved.version,2);assert.equal(saved.name,'My writer');assert.equal(saved.schemaVersion,1);
  const latest=await db[get]('author',id);assert.equal(latest.version,3);assert.equal(latest.name,'Later writer');
  assert.equal(await db[save]('author',id,saved.version,{name:'Stale overwrite'}),null);
 }
});
