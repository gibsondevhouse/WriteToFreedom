import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {seedLocations,ancestors,selectLocations} from '../public/locations/data.js';
const origin='https://novel.example';
function setup(){const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));const worker=createWorker({}),env={DB:d1Adapter(sqlite)};return async(method='GET',body,owner='author-a',source=origin)=>worker.fetch(new Request(origin+'/api/locations',{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(body===undefined?{}:{origin:source,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);}
test('countries, cities, and landmarks retain a complete hierarchy after creation and reload',async()=>{
 const request=setup(),country={id:crypto.randomUUID(),name:'Eastern Reach',type:'country',parentId:null},city={id:crypto.randomUUID(),name:'Rivergate',type:'city',parentId:country.id},landmark={id:crypto.randomUUID(),name:'Old Bridge',type:'landmark',parentId:city.id};
 for(const record of [country,city,landmark]){const response=await request('POST',record);assert.equal(response.status,201);assert.deepEqual(await response.json(),record.type==='landmark'?{...record,version:0}:record);}
 await request('POST',landmark);const records=(await (await request()).json()).locations;
 assert.equal(records.length,seedLocations.length+3);assert.deepEqual(ancestors(records.find(r=>r.id===landmark.id),records).map(r=>r.id),[country.id,city.id]);
 assert.deepEqual(selectLocations(records,'Eastern Reach').map(r=>r.id),[country.id,city.id,landmark.id]);
 assert.deepEqual(selectLocations(records,'Rivergate','landmark').map(r=>r.id),[landmark.id]);
});
test('parent rules reject orphaned, cross-type and cross-owner locations',async()=>{
 const request=setup();
 for(const [type,parentId] of [['city',null],['landmark',null],['city','sample-capital'],['landmark','sample-kingdom'],['country','sample-capital'],['landmark',crypto.randomUUID()]])assert.equal((await request('POST',{id:crypto.randomUUID(),name:'Invalid',type,parentId})).status,400);
 const privateCountry={id:crypto.randomUUID(),name:'Private country',type:'country',parentId:null};await request('POST',privateCountry);
 assert.equal((await request('POST',{id:crypto.randomUUID(),name:'Foreign city',type:'city',parentId:privateCountry.id},'author-b')).status,400);
 assert.equal((await request('POST',privateCountry,'author-b')).status,409);
 const other=(await (await request('GET',undefined,'author-b')).json()).locations;assert.ok(!other.some(r=>r.id===privateCountry.id));
});
test('location mutations require identity, same origin, a valid type, and a nonblank name',async()=>{
 const request=setup(),record={id:crypto.randomUUID(),name:'Country',type:'country',parentId:null};
 assert.equal((await request('GET',undefined,null)).status,401);
 assert.equal((await request('POST',record,'author-a','https://other.example')).status,403);
 assert.equal((await request('POST',{...record,name:' '})).status,400);
 assert.equal((await request('POST',{...record,type:'continent'})).status,400);
 assert.equal((await request('POST',{...record,name:'x'.repeat(161)})).status,400);
 assert.equal((await request('PUT',record)).status,404);
});
test('all sample landmarks resolve through a city to a country and filters preserve all kinds',()=>{
 for(const row of seedLocations){const parents=ancestors(row,seedLocations);assert.deepEqual(parents.map(p=>p.type),row.type==='landmark'?['country','city']:row.type==='city'?['country']:[]);}
 assert.equal(selectLocations(seedLocations).length,seedLocations.length);
 for(const type of ['country','city','landmark'])assert.ok(selectLocations(seedLocations,'',type).every(r=>r.type===type));
 const alphabetic=selectLocations(seedLocations,'','','name');assert.deepEqual(selectLocations(seedLocations,'','','name',true),[...alphabetic].reverse());
});
