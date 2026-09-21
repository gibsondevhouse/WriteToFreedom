import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createWorker } from '../server/app.js';
import { d1Adapter } from '../scripts/sqlite-adapter.mjs';
import { blankCharacter, fieldNames } from '../public/characters/template.js';
const origin='https://novel.example';
function setup(){const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('drizzle/0000_familiar_fixer.sql','utf8'));const worker=createWorker({});const env={DB:d1Adapter(sqlite)};return async(path,method='GET',body,owner='author-a',source=origin)=>worker.fetch(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(body===undefined?{}:{origin:source,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);}
test('blank creation is idempotent, saves complete template, and reopens by stable ID',async()=>{
 const request=setup(),id=crypto.randomUUID();
 let response=await request('/api/characters','POST',{id});assert.equal(response.status,201);const blank=await response.json();
 for(const field of fieldNames)assert.equal(blank[field],'');assert.deepEqual(blank.relationships,[]);
 await request('/api/characters','POST',{id});assert.equal((await (await request('/api/characters')).json()).characters.length,1);
 const record={...blank,name:'Nia',title:'The mapmaker',biography:'First line\nSecond line',roles:'Cartographer',tendencies:'Notices details\nKeeps promises',relationships:[{targetId:'claude',type:'Mentor',description:'Learned the old maps.'}]};
 response=await request('/api/characters/'+id,'PUT',record);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.version,2);
 const reopened=await (await request('/api/characters/'+id)).json();assert.equal(reopened.biography,record.biography);assert.deepEqual(reopened.relationships,record.relationships);
 const html=await (await request('/characters/'+id+'/')).text();assert.ok(html.includes('Nia'));assert.ok(html.includes('/characters/claude/'));assert.ok(html.includes('Edit character'));
 const list=await (await request('/api/characters')).json();assert.equal(list.characters[0].name,'Nia');
 response=await request('/api/characters/'+id,'PUT',{...record,name:'Stale overwrite'});assert.equal(response.status,409);assert.equal((await (await request('/api/characters/'+id)).json()).name,'Nia');
});
test('private ownership, cross-origin requests, and invalid relationship targets are enforced',async()=>{
 const request=setup(),id=crypto.randomUUID();
 assert.equal((await request('/api/characters','GET',undefined,null)).status,401);
 assert.equal((await request('/api/characters','POST',{id},'author-a','https://other.example')).status,403);
 await request('/api/characters','POST',{id});
 assert.deepEqual((await (await request('/api/characters','GET',undefined,'author-b')).json()).characters,[]);
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
 assert.equal((await request('/api/characters/'+id,'PUT',{...blankCharacter(),name:'x'.repeat(161),version:2})).status,400);
 const attack='<img src=x onerror=alert(1)>';
 response=await request('/api/characters/'+id,'PUT',{...blankCharacter(),name:attack,biography:attack,version:2});assert.equal(response.status,200);
 const page=await request('/characters/'+id+'/');assert.equal(page.headers.get('cache-control'),'no-store');const html=await page.text();assert.ok(!html.includes(attack));assert.ok(html.includes('&lt;img'));
});
test('two owned custom characters can be linked and appear on the rendered profile',async()=>{
 const request=setup(),first=crypto.randomUUID(),second=crypto.randomUUID();await request('/api/characters','POST',{id:first});await request('/api/characters','POST',{id:second});
 await request('/api/characters/'+second,'PUT',{...blankCharacter(),name:'Ayo',version:1});
 const response=await request('/api/characters/'+first,'PUT',{...blankCharacter(),name:'Nia',version:1,relationships:[{targetId:second,type:'Sibling',description:'Raised together.'}]});assert.equal(response.status,200);
 const html=await (await request('/characters/'+first+'/')).text();assert.ok(html.includes('Ayo'));assert.ok(html.includes('/characters/'+second+'/'));
});
