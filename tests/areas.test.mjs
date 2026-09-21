import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {ancestors,selectLocations,parentChoices} from '../public/locations/data.js';
const origin='https://novel.example';
function setup(){const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));const worker=createWorker({}),env={DB:d1Adapter(sqlite)};return async(path='/api/locations',method='GET',body,owner='author-a')=>worker.fetch(new Request(origin+path,{method,headers:{'oai-authenticated-user-id':owner,...(body===undefined?{}:{origin,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);}
async function create(req,name,type,parentId,areaType){const response=await req('/api/locations','POST',{id:crypto.randomUUID(),name,type,parentId,areaType});assert.equal(response.status,201);return response.json();}
async function tree(req){const borough=await create(req,'Manhattan','area','sample-capital','Borough'),neighborhood=await create(req,'Harlem','area',borough.id,'Neighborhood'),park=await create(req,'Rucker Park','landmark',neighborhood.id);return {borough,neighborhood,park};}
async function list(req,owner){return (await (await req('/api/locations','GET',undefined,owner)).json()).locations;}
test('nested areas persist their kind and full ancestry; search and city/country pages include every level',async()=>{
 const req=setup(),{borough,neighborhood,park}=await tree(req),records=await list(req);
 assert.equal(records.find(r=>r.id===borough.id).areaType,'Borough');
 assert.deepEqual(ancestors(park,records).map(r=>r.id),['sample-kingdom','sample-capital',borough.id,neighborhood.id]);
 assert.deepEqual(selectLocations(records,'Manhattan','landmark').map(r=>r.id),[park.id]);
 assert.deepEqual(selectLocations(records,'Neighborhood','area').map(r=>r.id),[neighborhood.id]);
 const city=await (await req('/locations/cities/sample-capital/')).text(),country=await (await req('/locations/countries/sample-kingdom/')).text();
 for(const text of ['Manhattan','Harlem','Rucker Park'])assert.ok(city.includes(text),text);
 assert.ok(country.includes('Rucker Park'));
 const duplicate=await req('/api/locations','POST',borough);assert.equal(duplicate.status,201);assert.equal((await list(req)).filter(r=>r.id===borough.id).length,1);
});
test('moving an area moves its nested landmarks without changing their direct parents',async()=>{
 const req=setup(),{borough,neighborhood,park}=await tree(req),country=await create(req,'Coastal Union','country',null),city=await create(req,'New Port','city',country.id);
 const response=await req('/api/locations','PUT',{...borough,parentId:city.id,name:'New Borough'});assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.version,borough.version+1);
 const records=await list(req);assert.deepEqual(ancestors(records.find(r=>r.id===park.id),records).map(r=>r.id),[country.id,city.id,borough.id,neighborhood.id]);
 assert.equal(records.find(r=>r.id===park.id).parentId,neighborhood.id);
 assert.ok(!(await (await req('/locations/cities/sample-capital/')).text()).includes('Rucker Park'));
 assert.ok((await (await req('/locations/cities/'+city.id+'/')).text()).includes('Rucker Park'));
 assert.ok((await (await req('/locations/countries/'+country.id+'/')).text()).includes('Rucker Park'));
 assert.equal((await req('/api/locations','PUT',{...borough,name:'Stale overwrite'})).status,409);
});
test('existing sample landmarks can be reassigned privately and returned to a city',async()=>{
 const req=setup(),{neighborhood}=await tree(req),original=(await list(req)).find(r=>r.id==='sample-royal-archive');
 let response=await req('/api/locations','PUT',{...original,parentId:neighborhood.id,name:'Neighborhood Archive'});assert.equal(response.status,200);const saved=await response.json();
 assert.equal((await list(req)).find(r=>r.id===original.id).parentId,neighborhood.id);
 assert.equal((await list(req,'author-b')).find(r=>r.id===original.id).parentId,'sample-capital');
 assert.equal((await req('/api/locations','PUT',original)).status,409);
 response=await req('/api/locations','PUT',{...saved,parentId:'sample-capital'});assert.equal(response.status,200);
 assert.deepEqual(ancestors((await list(req)).find(r=>r.id===original.id),await list(req)).map(r=>r.type),['country','city']);
});
test('area parent rules prevent cycles, invalid parents and cross-owner assignments',async()=>{
 const req=setup(),{borough,neighborhood,park}=await tree(req),records=await list(req);
 for(const parentId of [borough.id,neighborhood.id,park.id,'sample-kingdom',null,crypto.randomUUID()])assert.equal((await req('/api/locations','PUT',{...borough,parentId})).status,400);
 assert.ok(!parentChoices('area',records,borough.id).some(r=>[borough.id,neighborhood.id].includes(r.id)));
 assert.equal((await req('/api/locations','POST',{id:crypto.randomUUID(),name:'Invalid area',type:'area',areaType:'Planet',parentId:'sample-capital'})).status,400);
 assert.equal((await req('/api/locations','POST',{id:crypto.randomUUID(),name:'Private child',type:'area',areaType:'Ward',parentId:borough.id},'author-b')).status,400);
 assert.equal((await req('/api/locations','PUT',borough,'author-b')).status,404);
 assert.equal((await req('/api/locations','PUT',{...borough,type:'city'})).status,400);
 assert.equal((await req('/api/locations','PUT',{...park,parentId:'sample-kingdom'})).status,400);
 assert.ok(!(await list(req,'author-b')).some(r=>r.id===borough.id));
 // Defensive traversal terminates even if malformed imported records contain a cycle.
 assert.equal(ancestors({id:'a',parentId:'b'},[{id:'a',parentId:'b'},{id:'b',parentId:'a'}]).length,1);
});
