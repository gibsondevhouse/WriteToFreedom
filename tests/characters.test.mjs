import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createWorker } from '../server/app.js';
import { d1Adapter } from '../scripts/sqlite-adapter.mjs';
import { blankCharacter, fieldNames, normalizeCharacter } from '../public/characters/template.js';
const origin='https://novel.example';
function setup(){const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));const worker=createWorker({});const env={DB:d1Adapter(sqlite)};return async(path,method='GET',body,owner='author-a',source=origin)=>worker.fetch(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(body===undefined?{}:{origin:source,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);}
test('blank creation is idempotent, saves complete template, and reopens by stable ID',async()=>{
 const request=setup(),id=crypto.randomUUID();
 let response=await request('/api/characters','POST',{id});assert.equal(response.status,201);const blank=await response.json();
 for(const field of fieldNames)assert.equal(blank[field],'');assert.deepEqual(blank.relationships,[]);
 await request('/api/characters','POST',{id});assert.equal((await (await request('/api/characters')).json()).characters.length,5);
 const record={...blank,firstName:'Nia',title:'The mapmaker',biography:'First line\nSecond line',roles:'Cartographer',tendencies:'Notices details\nKeeps promises',relationships:[{targetId:'claude',type:'Mentor',description:'Learned the old maps.'}]};
 response=await request('/api/characters/'+id,'PUT',record);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.version,2);
 const reopened=await (await request('/api/characters/'+id)).json();assert.equal(reopened.biography,record.biography);assert.deepEqual(reopened.relationships,record.relationships);
 const html=await (await request('/characters/'+id+'/')).text();assert.ok(html.includes('Nia'));assert.ok(html.includes('claude'));assert.ok(html.includes('Save changes'));assert.ok(!html.includes('/characters/edit/'));
 const list=await (await request('/api/characters')).json();assert.equal(list.characters.find(c=>c.id===id).name,'Nia');
 response=await request('/api/characters/'+id,'PUT',{...record,firstName:'Stale overwrite'});assert.equal(response.status,409);assert.equal((await (await request('/api/characters/'+id)).json()).name,'Nia');
});
test('private ownership, cross-origin requests, and invalid relationship targets are enforced',async()=>{
 const request=setup(),id=crypto.randomUUID();
 assert.equal((await request('/api/characters','GET',undefined,null)).status,401);
 assert.equal((await request('/api/characters','POST',{id},'author-a','https://other.example')).status,403);
 await request('/api/characters','POST',{id});
 assert.equal((await (await request('/api/characters','GET',undefined,'author-b')).json()).characters.length,4);
 assert.equal((await request('/api/characters/'+id,'GET',undefined,'author-b')).status,404);
 assert.equal((await request('/characters/'+id+'/','GET',undefined,'author-b')).status,404);
 assert.equal((await request('/api/characters/'+id,'PUT',{...blankCharacter(),version:1},'author-b')).status,404);
 assert.equal((await request('/api/characters','POST',{id},'author-b')).status,409);
 assert.equal((await request('/api/characters/'+id,'PUT',{...blankCharacter(),version:1,relationships:[{targetId:crypto.randomUUID(),type:'Rival',description:''}]})).status,400);
 assert.equal((await request('/api/characters/'+id,'PUT',{...blankCharacter(),version:1,relationships:[{targetId:id,type:'Self',description:''}]})).status,400);
});
test('profile text is escaped, blank saves remain valid, and malformed data is rejected',async()=>{
 const request=setup(),id=crypto.randomUUID();await request('/api/characters','POST',{id});
 let response=await request('/api/characters/'+id,'PUT',{...blankCharacter(),version:1});assert.equal(response.status,200);
 assert.equal((await request('/api/characters/'+id,'PUT',null)).status,400);
 assert.equal((await request('/api/characters/'+id,'PUT',{...blankCharacter(),firstName:'x'.repeat(161),version:2})).status,400);
 const attack='<img src=x onerror=alert(1)>';
 response=await request('/api/characters/'+id,'PUT',{...blankCharacter(),firstName:attack,biography:attack,version:2});assert.equal(response.status,200);
 const page=await request('/characters/'+id+'/');assert.equal(page.headers.get('cache-control'),'no-store');const html=await page.text();assert.ok(!html.includes(attack));assert.ok(html.includes('&lt;img'));
});
test('two owned custom characters can be linked and appear on the rendered profile',async()=>{
 const request=setup(),first=crypto.randomUUID(),second=crypto.randomUUID();await request('/api/characters','POST',{id:first});await request('/api/characters','POST',{id:second});
 await request('/api/characters/'+second,'PUT',{...blankCharacter(),firstName:'Ayo',version:1});
 const response=await request('/api/characters/'+first,'PUT',{...blankCharacter(),firstName:'Nia',version:1,relationships:[{targetId:second,type:'Sibling',description:'Raised together.'}]});assert.equal(response.status,200);
 const html=await (await request('/characters/'+first+'/')).text();assert.ok(html.includes('Ayo'));assert.ok(html.includes(second));
});

test('hyphenated name components, story roles, alignment, and factions survive save and reopen',async()=>{
 const request=setup(),id=crypto.randomUUID(),factionId=crypto.randomUUID();
 const created=await request('/api/factions','POST',{id:factionId,name:'The River-Keepers'});assert.equal(created.status,201);
 await request('/api/characters','POST',{id});
 const doc={...blankCharacter(),firstName:'Anne-Marie',middleName:'Jean-Luc',lastName:'Okafor-Smith',storyRole:'Protagonist',alignment:'Morally gray',factionId,version:1};
 const response=await request('/api/characters/'+id,'PUT',doc);assert.equal(response.status,200);
 const reopened=await (await request('/api/characters/'+id)).json();assert.equal(reopened.name,'Anne-Marie Jean-Luc Okafor-Smith');
 for(const field of ['firstName','middleName','lastName','storyRole','alignment','factionId'])assert.equal(reopened[field],doc[field]);
 assert.equal(reopened.affiliation,'The River-Keepers');
 const html=await (await request('/characters/'+id+'/')).text();assert.ok(html.includes(reopened.name));assert.ok(html.includes('Morally gray'));assert.ok(html.includes('The River-Keepers'));
 const cleared=await request('/api/characters/'+id,'PUT',{...reopened,factionId:'',affiliation:'',alignment:'',version:2});assert.equal(cleared.status,200);assert.equal((await cleared.json()).affiliation,'');
});

test('faction creation is private, deduplicates names, and rejects other owners’ factions',async()=>{
 const request=setup(),id=crypto.randomUUID(),characterId=crypto.randomUUID();
 assert.equal((await request('/api/factions','GET',undefined,null)).status,401);
 assert.equal((await request('/api/factions','POST',{id,name:'Guild'},'author-a','https://other.example')).status,403);
 assert.equal((await request('/api/factions','POST',{id,name:'   '})).status,400);
 const first=await (await request('/api/factions','POST',{id,name:'  River   Guild  '})).json();assert.equal(first.name,'River Guild');
 const repeated=await (await request('/api/factions','POST',{id:crypto.randomUUID(),name:'river guild'})).json();assert.equal(repeated.id,first.id);
 const listed=await (await request('/api/factions')).json();assert.equal(listed.factions.filter(f=>f.id===id).length,1);
 const other=await (await request('/api/factions','GET',undefined,'author-b')).json();assert.ok(!other.factions.some(f=>f.id===id));
 await request('/api/characters','POST',{id:characterId},'author-b');
 const result=await request('/api/characters/'+characterId,'PUT',{...blankCharacter(),factionId:id,version:1},'author-b');assert.equal(result.status,400);
});

test('legacy names and free-text values are retained without guessing how names split',async()=>{
 const prior=normalizeCharacter({name:'Mary-Jane van der Berg',affiliation:'Old family',storyRole:'Guardian',relationships:[]});
 assert.equal(prior.firstName,'Mary-Jane van der Berg');assert.equal(prior.lastName,'');assert.equal(prior.name,'Mary-Jane van der Berg');assert.equal(prior.affiliation,'Old family');assert.equal(prior.storyRole,'Guardian');
 const request=setup(),id=crypto.randomUUID();await request('/api/characters','POST',{id});
 const oldClient={...blankCharacter(),name:'Mary-Jane van der Berg',affiliation:'Old family',version:1};delete oldClient.firstName;delete oldClient.middleName;delete oldClient.lastName;delete oldClient.factionId;delete oldClient.alignment;
 const saved=await request('/api/characters/'+id,'PUT',oldClient);assert.equal(saved.status,200);const doc=await saved.json();assert.equal(doc.name,oldClient.name);assert.equal(doc.affiliation,'Old family');
 const again=await request('/api/characters/'+id,'PUT',{...doc,version:2});assert.equal(again.status,200);assert.equal((await again.json()).name,oldClient.name);
 assert.equal((await request('/api/characters/'+id,'PUT',{...doc,storyRole:'Invalid role',version:3})).status,400);
 assert.equal((await request('/api/characters/'+id,'PUT',{...doc,alignment:'Invalid alignment',version:3})).status,400);
});


test('sample profiles save private overrides without duplicating the cast or losing template fields',async()=>{
 const request=setup();
 const sample=await (await request('/api/characters/claude')).json();assert.equal(sample.version,0);
 for(const key of fieldNames)assert.equal(typeof sample[key],'string',key);
 const changed={...sample,firstName:'Claude-Marie',middleName:'Ayo-Jane',lastName:'Ember-West',biography:'A new beginning.',alignment:'Good'};
 const result=await request('/api/characters/claude','PUT',changed);assert.equal(result.status,200);const saved=await result.json();assert.equal(saved.version,1);assert.equal(saved.id,'claude');
 const list=(await (await request('/api/characters')).json()).characters;assert.equal(list.length,4);assert.equal(list.find(c=>c.id==='claude').name,'Claude-Marie Ayo-Jane Ember-West');
 const other=await (await request('/api/characters/claude','GET',undefined,'author-b')).json();assert.equal(other.name,'Claude');assert.equal(other.version,0);
 assert.equal((await request('/api/characters/claude','PUT',changed)).status,409);
 const updated=await request('/api/characters/claude','PUT',{...saved,flaw:'Impatient'});assert.equal(updated.status,200);assert.equal((await updated.json()).version,2);
 const otherSaved=await request('/api/characters/claude','PUT',{...other,firstName:'Another Claude'},'author-b');assert.equal(otherSaved.status,200);
 assert.equal((await (await request('/api/characters/claude')).json()).firstName,'Claude-Marie');
});

test('blank and sample profiles expose the full editable template and redirect old editor URLs',async()=>{
 const request=setup(),id=crypto.randomUUID();await request('/api/characters','POST',{id});
 for(const target of [id,'claude','gpt','deepseek','gemini']){
  const page=await request('/characters/'+target+'/');assert.equal(page.status,200);const html=await page.text();
  for(const key of fieldNames)assert.equal(html.split('name="'+key+'"').length-1,1,'editable '+key);
  assert.ok(html.includes('id="profile-form"'));assert.ok(html.includes('id="add-relationship"'));assert.ok(!html.includes('/characters/edit/'));
  const data=JSON.parse(html.match(/<script id="profile-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);assert.equal(data.character.id,target);
  assert.equal(data.cast.length,5);assert.ok(Array.isArray(data.character.relationships));
  const old=await request('/characters/edit/?id='+target);assert.equal(old.status,302);assert.equal(old.headers.get('location'),origin+'/characters/'+target+'/');
 }
 const unauth=await request('/characters/claude/','GET',undefined,null);assert.equal(unauth.status,401);
 assert.equal((await request('/characters/claude/index.html')).headers.get('location'),origin+'/characters/claude/');
});
