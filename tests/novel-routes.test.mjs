import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {novelRoute} from '../server/novel-routes.js';

const origin='https://novels.example';
function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const env={DB:d1Adapter(sqlite)};
 const request=(path,method='GET',body,owner='author',headers={})=>novelRoute(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),origin,'content-type':'application/json',...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}),env);
 const get=async(path,owner='author')=>{const response=await request(path,'GET',undefined,owner);assert.equal(response.status,200,await response.clone().text());return response.json();};
 const createNovel=async(title='Novel',extra={},owner='author')=>{const response=await request('/api/novels','POST',{id:crypto.randomUUID(),title,...extra},owner);assert.equal(response.status,201,await response.clone().text());return response.json();};
 const createSeries=async(title='Series',extra={},owner='author')=>{const response=await request('/api/series','POST',{id:crypto.randomUUID(),title,...extra},owner);assert.equal(response.status,201,await response.clone().text());return response.json();};
 return {request,get,createNovel,createSeries,sqlite,env};
}

test('novel and series routes create defaults, save document fields, and keep owners separate',async t=>{
 const {request,get,createNovel,createSeries}=setup(t),group=await createSeries('Cycle'),first=await createNovel('First',{seriesId:group.id}),second=await createNovel('Second',{seriesId:group.id,seriesOrder:1});
 assert.equal(first.status,'drafting');assert.equal(first.synopsis,'');assert.equal(first.seriesId,group.id);
 assert.equal(group.summary,'');assert.equal(group.coverUrl,'');
 assert.deepEqual((await get('/api/novels')).map(row=>row.id).sort(),[first.id,second.id].sort());
 assert.deepEqual((await get('/api/series')).map(row=>row.id),[group.id]);
 assert.deepEqual(await get('/api/novels/'+first.id),first);
 assert.deepEqual(await get('/api/series/'+group.id),{...group,version:3,updatedAt:(await get('/api/series/'+group.id)).updatedAt});
 let response=await request('/api/novels/'+first.id,'PUT',{version:1,title:'First revised',synopsis:'Kept prose',status:'revising',coverUrl:'https://example.com/cover.png',hiddenFields:['synopsis']});
 assert.equal(response.status,200,await response.clone().text());const revised=await response.json();
 assert.equal(revised.version,2);assert.equal(revised.synopsis,'Kept prose');assert.equal(revised.seriesId,group.id);assert.deepEqual(revised.hiddenFields,['synopsis']);
 response=await request('/api/series/'+group.id,'PUT',{version:3,title:'Cycle revised',summary:'Summary'});
 assert.equal(response.status,200);assert.equal((await response.json()).version,4);
 for(const path of ['/api/novels/'+first.id,'/api/series/'+group.id]){
  assert.equal((await request(path,'GET',undefined,'other')).status,404);
  assert.equal((await request(path,'PUT',{version:1,title:'Intrusion'},'other')).status,404);
 }
 assert.deepEqual(await get('/api/novels','other'),[]);assert.deepEqual(await get('/api/series','other'),[]);
 assert.equal((await request('/api/novels','POST',{id:first.id,title:'Collision'},'other')).status,409);
 assert.equal((await request('/api/novels/'+crypto.randomUUID())).status,404);
 assert.equal((await request('/api/series/'+crypto.randomUUID())).status,404);
});

test('novel and series writes reject invalid identity, references, status, URLs, and envelopes',async t=>{
 const {request,createNovel,createSeries,get}=setup(t),record=await createNovel('Safe'),foreignSeries=await createSeries('Private',{},'other');
 for(const body of [{id:'bad',title:'Name'},{id:crypto.randomUUID()},{id:crypto.randomUUID(),title:' '},{id:crypto.randomUUID(),title:'x'.repeat(481)},{id:crypto.randomUUID(),title:'Name',status:'unknown'},{id:crypto.randomUUID(),title:'Name',coverUrl:'http://example.com/a.png'},{id:crypto.randomUUID(),title:'Name',coverUrl:'https://user:pass@example.com/a.png'},{id:crypto.randomUUID(),title:'Name',seriesId:foreignSeries.id},{id:crypto.randomUUID(),title:'Name',seriesOrder:-1},{id:crypto.randomUUID(),title:'Name',hiddenFields:['bad']}])assert.equal((await request('/api/novels','POST',body)).status,400,JSON.stringify(body).slice(0,100));
 for(const body of [{id:crypto.randomUUID()},{id:crypto.randomUUID(),title:''},{id:crypto.randomUUID(),title:'Valid',coverUrl:'javascript:alert(1)'}])assert.equal((await request('/api/series','POST',body)).status,400);
 for(const body of ['{','null','[]','true'])assert.equal((await request('/api/novels/'+record.id,'PUT',body)).status,400);
 for(const body of [{version:0,title:'Bad'},{version:1.5,title:'Bad'},{version:Number.MAX_SAFE_INTEGER+1,title:'Bad'},{version:1,title:'Bad',id:crypto.randomUUID()},{version:1,title:'Bad',schemaVersion:2}])assert.equal((await request('/api/novels/'+record.id,'PUT',body)).status,400);
 assert.equal((await request('/api/novels/'+record.id,'PUT',{version:1,title:'Cross origin'},'author',{origin:'https://other.example'})).status,403);
 assert.equal((await request('/api/novels/'+record.id,'PUT',{version:1,title:'Text'},'author',{'content-type':'text/plain'})).status,403);
 assert.equal((await request('/api/novels','POST',{id:crypto.randomUUID(),title:'Too large',synopsis:'a'.repeat(150000)})).status,413);
 assert.equal((await request('/api/novels/'+record.id,'PATCH',{})).status,405);
 assert.equal((await request('/api/novels/'+record.id,'GET',undefined,null)).status,401);
 assert.deepEqual(await get('/api/novels/'+record.id),record);
});

test('novel and series version conflicts preserve the submitted draft',async t=>{
 const {request,get,createNovel,createSeries}=setup(t),record=await createNovel('Original'),group=await createSeries('Original cycle');
 const drafts=[{version:1,title:'First writer',synopsis:'First draft'},{version:1,title:'Second writer',synopsis:'Second draft'}];
 const results=await Promise.all(drafts.map(draft=>request('/api/novels/'+record.id,'PUT',draft)));
 assert.deepEqual(results.map(response=>response.status).sort(),[200,409]);
 const loser=results.find(response=>response.status===409),losingDraft=drafts[results.indexOf(loser)],body=await loser.json();
 assert.match(body.error,/changed in another tab/i);assert.deepEqual(body.draft,losingDraft);
 assert.equal((await get('/api/novels/'+record.id)).version,2);
 let response=await request('/api/series/'+group.id,'PUT',{version:1,title:'Saved'});assert.equal(response.status,200);
 response=await request('/api/series/'+group.id,'PUT',{version:1,title:'Unsaved'});assert.equal(response.status,409);assert.equal((await response.json()).draft.title,'Unsaved');
});

test('associations require owned targets, resist duplicates, and unlink without deleting referenced data',async t=>{
 const {request,get,createNovel,sqlite}=setup(t),record=await createNovel('Linked'),characterId=crypto.randomUUID(),foreignId=crypto.randomUUID(),associationId=crypto.randomUUID();
 const now=new Date().toISOString();
 sqlite.prepare('INSERT INTO character_drafts (id,owner_id,document,version,created_at,updated_at) VALUES (?,?,?,1,?,?)').run(characterId,'author',JSON.stringify({name:'Kept'}),now,now);
 sqlite.prepare('INSERT INTO character_drafts (id,owner_id,document,version,created_at,updated_at) VALUES (?,?,?,1,?,?)').run(foreignId,'other',JSON.stringify({name:'Private'}),now,now);
 let response=await request('/api/novels/'+record.id+'/associations','POST',{id:associationId,targetKind:'character',targetId:foreignId});assert.equal(response.status,404);
 assert.deepEqual(await get('/api/novels/'+record.id+'/associations'),[]);
 response=await request('/api/novels/'+record.id+'/associations','POST',{id:associationId,targetKind:'character',targetId:characterId,prose:'In the opening chapter'});assert.equal(response.status,201,await response.clone().text());
 const first=await response.json();assert.equal(first.version,1);assert.equal(first.relationKind,'appears_in');
 response=await request('/api/novels/'+record.id+'/associations','POST',{id:crypto.randomUUID(),targetKind:'character',targetId:characterId,prose:'Do not replace'});assert.equal(response.status,201);assert.deepEqual(await response.json(),first);
 assert.deepEqual((await get('/api/novel-associations?targetKind=character&targetId='+characterId)).map(item=>item.id),[associationId]);
 response=await request('/api/novels/'+record.id+'/associations/'+associationId,'PUT',{version:1,relationKind:'linked',prose:'Revised prose'});assert.equal(response.status,200);assert.equal((await response.json()).version,2);
 response=await request('/api/novels/'+record.id+'/associations/'+associationId,'PUT',{version:1,prose:'Unsaved'});assert.equal(response.status,409);assert.equal((await response.json()).draft.prose,'Unsaved');
 assert.equal((await request('/api/novels/'+record.id+'/associations','GET',undefined,'other')).status,404);
 assert.equal((await request('/api/novels/'+record.id+'/associations/'+associationId,'PUT',{version:2,prose:'Intrusion'},'other')).status,404);
 const otherNovel=await createNovel('Other parent');
 assert.equal((await request('/api/novels/'+otherNovel.id+'/associations/'+associationId,'DELETE',{version:2})).status,404);
 for(const body of [{id:'bad',targetKind:'character',targetId:characterId},{id:crypto.randomUUID(),targetKind:'novel',targetId:characterId},{id:crypto.randomUUID(),targetKind:'character',targetId:'bad'},{id:crypto.randomUUID(),targetKind:'character',targetId:characterId,relationKind:'unknown'}])assert.equal((await request('/api/novels/'+record.id+'/associations','POST',body)).status,400);
 assert.equal((await request('/api/novels/'+record.id,'PUT',{version:1,title:'Novel advanced'})).status,200);
 assert.equal((await request('/api/novels/'+record.id+'/associations/'+associationId,'DELETE',{version:2},'other')).status,404);
 for(const input of [{},{version:0},{version:1.5},{version:Number.MAX_SAFE_INTEGER+1}])assert.equal((await request('/api/novels/'+record.id+'/associations/'+associationId,'DELETE',input)).status,400);
 const staleUnlink={version:1};response=await request('/api/novels/'+record.id+'/associations/'+associationId,'DELETE',staleUnlink);assert.equal(response.status,409);assert.deepEqual((await response.json()).draft,staleUnlink);assert.equal((await get('/api/novels/'+record.id+'/associations'))[0].prose,'Revised prose');
 assert.equal((await request('/api/novels/'+record.id+'/associations/'+associationId,'DELETE',{version:2})).status,204);
 assert.deepEqual(await get('/api/novels/'+record.id+'/associations'),[]);
 assert.ok(sqlite.prepare('SELECT id FROM character_drafts WHERE id = ?').get(characterId));
 assert.equal((await request('/api/novel-associations?targetKind=character&targetId='+foreignId)).status,404);
 assert.equal((await request('/api/novels/'+record.id+'/associations','POST',{id:crypto.randomUUID(),targetKind:'character',targetId:'sample-unknown'})).status,400);
 const sample=await request('/api/novels/'+record.id+'/associations','POST',{id:crypto.randomUUID(),targetKind:'character',targetId:'claude'});assert.equal(sample.status,201);
 for(const [targetKind,targetId] of [['faction','sample-ember'],['location','sample-kingdom']]){
  const sample=await request('/api/novels/'+record.id+'/associations','POST',{id:crypto.randomUUID(),targetKind,targetId});assert.equal(sample.status,201,targetKind);
  assert.equal((await request('/api/novels/'+record.id+'/associations','POST',{id:crypto.randomUUID(),targetKind,targetId:'sample-unknown'})).status,400,targetKind);
 }
});

test('every association target kind resolves within its owner',async t=>{
 const {request,createNovel,sqlite}=setup(t),record=await createNovel('All targets'),now=new Date().toISOString();
 for(const kind of ['character','faction','location','lore','story_arc']){
  const owned=crypto.randomUUID(),foreign=crypto.randomUUID();
  for(const [id,owner] of [[owned,'author'],[foreign,'other']]){
   if(kind==='faction')sqlite.prepare('INSERT INTO factions (id,owner_id,name,name_key,created_at) VALUES (?,?,?,?,?)').run(id,owner,'Faction',id,now);
   else if(kind==='location')sqlite.prepare('INSERT INTO locations (id,owner_id,name,type,parent_id,created_at) VALUES (?,?,?,?,?,?)').run(id,owner,'World','universe',null,now);
   else{
    const table=kind==='character'?'character_drafts':kind==='lore'?'lore_entries':'story_arcs';
    sqlite.prepare(`INSERT INTO ${table} (id,owner_id,document,version,created_at,updated_at) VALUES (?,?,?,1,?,?)`).run(id,owner,JSON.stringify({name:'Target',...(kind==='lore'?{type:'book'}:{})}),now,now);
   }
  }
  let response=await request('/api/novels/'+record.id+'/associations','POST',{id:crypto.randomUUID(),targetKind:kind,targetId:owned});assert.equal(response.status,201,kind+': '+await response.clone().text());
  response=await request('/api/novels/'+record.id+'/associations','POST',{id:crypto.randomUUID(),targetKind:kind,targetId:foreign});assert.equal(response.status,404,kind);
 }
});

test('series reorder is atomic, version checked, and preserves other novel fields',async t=>{
 const {request,get,createNovel,createSeries}=setup(t),group=await createSeries('Ordered'),first=await createNovel('First',{seriesId:group.id,synopsis:'Keep one'}),second=await createNovel('Second',{seriesId:group.id,synopsis:'Keep two'}),foreign=await createNovel('Foreign',{seriesId:''},'other');
 let response=await request('/api/series/'+group.id+'/order','PUT',{version:3,novelIds:[second.id,first.id]});assert.equal(response.status,200,await response.clone().text());
 const result=await response.json();assert.equal(result.series.version,4);assert.deepEqual(result.novelIds,[second.id,first.id]);
 assert.deepEqual((await get('/api/novels')).filter(row=>row.seriesId===group.id).sort((a,b)=>a.seriesOrder-b.seriesOrder).map(row=>row.seriesOrder),[0,1]);
 assert.equal((await get('/api/novels/'+first.id)).synopsis,'Keep one');assert.equal((await get('/api/novels/'+second.id)).synopsis,'Keep two');
 for(const draft of [{version:3,novelIds:[first.id,second.id]},{version:4,novelIds:[first.id]},{version:4,novelIds:[first.id,foreign.id]}]){
  response=await request('/api/series/'+group.id+'/order','PUT',draft);assert.equal(response.status,409,JSON.stringify(draft));assert.deepEqual((await response.json()).draft,draft);
  assert.equal((await get('/api/series/'+group.id)).version,4);
  assert.deepEqual((await get('/api/novels')).filter(row=>row.seriesId===group.id).sort((a,b)=>a.seriesOrder-b.seriesOrder).map(row=>row.id),[second.id,first.id]);
 }
 assert.equal((await request('/api/series/'+group.id+'/order','PUT',{version:4,novelIds:[first.id,first.id]})).status,400);
 assert.equal((await request('/api/series/'+group.id+'/order','PUT',{version:4,novelIds:[first.id,second.id]},'other')).status,404);
 const drafts=[{version:4,novelIds:[first.id,second.id]},{version:4,novelIds:[second.id,first.id]}];
 const concurrent=await Promise.all(drafts.map(draft=>request('/api/series/'+group.id+'/order','PUT',draft)));
 assert.deepEqual(concurrent.map(result=>result.status).sort(),[200,409]);
});

test('series reorder rolls back fully when a member has exhausted its revisions',async t=>{
 const {request,get,createNovel,createSeries,sqlite}=setup(t),group=await createSeries('Protected'),first=await createNovel('First',{seriesId:group.id}),lastId=crypto.randomUUID(),now=new Date().toISOString();
 sqlite.prepare('INSERT INTO novels (id,owner_id,document,version,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(lastId,'author',JSON.stringify({title:'Last revision',synopsis:'',status:'drafting',coverUrl:'',seriesId:group.id,seriesOrder:1,hiddenFields:[]}),Number.MAX_SAFE_INTEGER,now,now);
 const before=await get('/api/novels');
 const response=await request('/api/series/'+group.id+'/order','PUT',{version:2,novelIds:[lastId,first.id]});
 assert.equal(response.status,409,await response.clone().text());
 assert.deepEqual(await get('/api/novels'),before);assert.equal((await get('/api/series/'+group.id)).version,2);
});

test('membership and order edits invalidate stale series reorder drafts without losing novel prose',async t=>{
 const {request,get,createNovel,createSeries}=setup(t),group=await createSeries('Serialized'),one=await createNovel('One',{seriesId:group.id,synopsis:'One prose'});
 const beforeCreate=await get('/api/series/'+group.id),two=await createNovel('Two',{seriesId:group.id,synopsis:'Two prose'}),draft={version:beforeCreate.version,novelIds:[one.id]};
 let response=await request('/api/series/'+group.id+'/order','PUT',draft);assert.equal(response.status,409);assert.deepEqual((await response.json()).draft,draft);
 const beforeEdit=await get('/api/series/'+group.id);response=await request('/api/novels/'+one.id,'PUT',{version:1,seriesOrder:8});assert.equal(response.status,200);
 const reorderDraft={version:beforeEdit.version,novelIds:[two.id,one.id]};response=await request('/api/series/'+group.id+'/order','PUT',reorderDraft);assert.equal(response.status,409);assert.deepEqual((await response.json()).draft,reorderDraft);
 assert.equal((await get('/api/novels/'+one.id)).seriesOrder,8);assert.equal((await get('/api/novels/'+one.id)).synopsis,'One prose');assert.equal((await get('/api/novels/'+two.id)).synopsis,'Two prose');
 const seriesNow=await get('/api/series/'+group.id);response=await request('/api/series/'+group.id+'/order','PUT',{version:seriesNow.version,novelIds:[two.id,one.id]});assert.equal(response.status,200);
 const staleNovel={version:2,seriesOrder:5,synopsis:'Local draft'};response=await request('/api/novels/'+one.id,'PUT',staleNovel);assert.equal(response.status,409);assert.deepEqual((await response.json()).draft,staleNovel);assert.equal((await get('/api/novels/'+one.id)).synopsis,'One prose');
});

test('association unlink checks the revision inside SQL and accepts the final safe revision',async t=>{
 const {request,get,createNovel,sqlite}=setup(t),novel=await createNovel('Unlink'),id=crypto.randomUUID(),now=new Date().toISOString(),path='/api/novels/'+novel.id+'/associations/'+id;
 sqlite.prepare('INSERT INTO novel_associations (id,owner_id,novel_id,target_kind,target_id,relation_kind,prose,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,'author',novel.id,'character','claude','appears_in','Preserved at final revision',Number.MAX_SAFE_INTEGER,now,now);
 const stale={version:1};let result=await request(path,'DELETE',stale);assert.equal(result.status,409);assert.deepEqual((await result.json()).draft,stale);assert.equal((await get('/api/novels/'+novel.id+'/associations'))[0].prose,'Preserved at final revision');
 result=await request(path,'DELETE',{version:Number.MAX_SAFE_INTEGER});assert.equal(result.status,204);assert.deepEqual(await get('/api/novels/'+novel.id+'/associations'),[]);
});

test('association update between unlink read and DELETE preserves newer prose and returns the stale draft',async t=>{
 const {request,get,createNovel,sqlite,env}=setup(t),novel=await createNovel('Racing unlink'),response=await request('/api/novels/'+novel.id+'/associations','POST',{id:crypto.randomUUID(),targetKind:'character',targetId:'claude',prose:'Original'}),association=await response.json(),binding=env.DB;let once=true;
 env.DB={...binding,prepare(sql){const statement=binding.prepare(sql);return {bind(...args){const bound=statement.bind(...args);return {...bound,run(){if(once&&sql.startsWith('DELETE FROM novel_associations')){once=false;sqlite.prepare('UPDATE novel_associations SET prose = ?, version = version + 1 WHERE id = ?').run('Newer prose',association.id);}return bound.run();}};}};}};
 const draft={version:1},result=await request('/api/novels/'+novel.id+'/associations/'+association.id,'DELETE',draft);
 assert.equal(result.status,409);assert.deepEqual((await result.json()).draft,draft);
 const saved=(await get('/api/novels/'+novel.id+'/associations'))[0];assert.equal(saved.version,2);assert.equal(saved.prose,'Newer prose');
});
