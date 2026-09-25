import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {blankFaction,factionFields} from '../public/factions/template.js';
const origin='https://novel.example';
function setup(){const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));const worker=createWorker({}),env={DB:d1Adapter(sqlite)};return async(path,method='GET',body,owner='author-a',source=origin)=>worker.fetch(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(body===undefined?{}:{origin:source,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);}
test('existing and blank factions open full editable profiles, save and reopen',async()=>{
 const req=setup();const factions=(await (await req('/api/factions')).json()).factions;assert.equal(factions.length,4);
 const page=await req('/factions/sample-ember/');assert.equal(page.status,200);const html=await page.text();for(const key of factionFields)assert.ok(html.includes('name="'+key+'"'));assert.ok(html.includes('/characters/claude/'));assert.equal(html.split('id="ratings"').length-1,1);assert.equal(html.split('data-profile-ratings=').length-1,3);
 const id=crypto.randomUUID();let response=await req('/api/factions','POST',{id,blank:true});assert.equal(response.status,201);const blank=await response.json();for(const key of factionFields)assert.equal(blank[key],'');
 const doc={...blank,name:'The River Guard',history:'First event\nSecond event',type:'Order',leaderId:'claude',allies:'House of Ember',profileRatings:{influence:77,cohesion:65}};response=await req('/api/factions/'+id,'PUT',doc);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.version,1);assert.deepEqual(saved.profileRatings,doc.profileRatings);
 const reopened=await (await req('/api/factions/'+id)).json();assert.equal(reopened.history,doc.history);assert.equal(reopened.name,doc.name);assert.deepEqual(reopened.profileRatings,doc.profileRatings);
 const legacy={...reopened,summary:'Saved by an older client'};delete legacy.profileRatings;response=await req('/api/factions/'+id,'PUT',legacy);assert.equal(response.status,200);assert.deepEqual((await response.json()).profileRatings,doc.profileRatings);
 assert.equal((await (await req('/api/factions','POST',{id,blank:true})).json()).name,doc.name);
 assert.equal((await req('/api/factions/'+id,'PUT',doc)).status,409);
});
test('faction edits are owner-scoped and invalid character links or requests cannot save',async()=>{
 const req=setup();const original=await (await req('/api/factions/sample-ember')).json();const result=await req('/api/factions/sample-ember','PUT',{...original,name:'House of Ash'});assert.equal(result.status,200);
 assert.equal((await (await req('/api/factions/sample-ember','GET',undefined,'author-b')).json()).name,'The House of Ember');
 assert.equal((await req('/factions/sample-ember/','GET',undefined,null)).status,401);
 assert.equal((await req('/api/factions/sample-ember','PUT',{...original,version:1},'author-a','https://other.example')).status,403);
 assert.equal((await req('/api/factions/sample-ember','PUT',{...original,version:1,leaderId:crypto.randomUUID()})).status,400);
 assert.equal((await req('/api/factions/sample-ember','PUT',{...original,version:1,name:null})).status,400);
 const id=crypto.randomUUID();await req('/api/factions','POST',{id,name:'Private Guild'});assert.equal((await req('/api/factions/'+id,'GET',undefined,'author-b')).status,404);assert.equal((await req('/factions/'+id+'/','GET',undefined,'author-b')).status,404);
});
test('renames preserve membership and update character affiliations and create choices',async()=>{
 const req=setup();const original=await (await req('/api/factions/sample-ember')).json();await req('/api/factions/sample-ember','PUT',{...original,name:'House of Ash'});
 assert.equal((await (await req('/api/characters/claude')).json()).affiliation,'House of Ash');
 assert.ok((await (await req('/characters/claude/')).text()).includes('House of Ash'));
 const id=crypto.randomUUID();const created=await (await req('/api/factions','POST',{id,name:'Old Guild'})).json();const response=await req('/api/factions/'+id,'PUT',{...created,name:'New Guild'});assert.equal(response.status,200);
 const dedup=await (await req('/api/factions','POST',{id:crypto.randomUUID(),name:'New Guild'})).json();assert.equal(dedup.id,id);
 const reuse=await (await req('/api/factions','POST',{id:crypto.randomUUID(),name:'Old Guild'})).json();assert.notEqual(reuse.id,id);
 assert.equal((await (await req('/api/factions/'+id)).json()).name,'New Guild');
});
test('saved faction text is escaped on profile rendering',async()=>{
 const req=setup(),id=crypto.randomUUID();await req('/api/factions','POST',{id,blank:true});const attack='</textarea><script>alert(1)</script>';
 const result=await req('/api/factions/'+id,'PUT',{...blankFaction(),name:attack,history:attack,version:0});assert.equal(result.status,200);
 const page=await req('/factions/'+id+'/');assert.equal(page.headers.get('cache-control'),'no-store');const html=await page.text();assert.ok(!html.includes(attack));assert.ok(html.includes('&lt;/textarea&gt;'));
});
