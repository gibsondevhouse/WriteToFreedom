import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {ancestors,selectLocations} from '../public/locations/data.js';
import {nationalityGroups,profileChoices} from '../public/profiles/choices.js';
function setup(){
 const db=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+f,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(db)};
 async function request(path,method='GET',body,owner='author'){
  return worker.fetch(new Request('https://novel.example'+path,{method,headers:{origin:'https://novel.example','content-type':'application/json','oai-authenticated-user-id':owner},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 }
 async function create(type,name,parentId=null){const r=await request('/api/locations','POST',{id:crypto.randomUUID(),type,name,parentId});assert.equal(r.status,201);return r.json();}
 return {db,request,create};
}
test('world hierarchy persists, can be edited, and carries ancestry into search and country profiles',async()=>{
 const {db,request,create}=setup();try{
  const universe=await create('universe','The Expanse'),galaxy=await create('galaxy','Silver Spiral',universe.id),system=await create('solar-system','Aster',galaxy.id),planet=await create('planet','Meridian',system.id),moon=await create('moon','Pale Moon',planet.id),continent=await create('continent','Elaria',planet.id),country=await create('country','Coastland',continent.id),city=await create('city','Seagate',country.id),landmark=await create('landmark','The Gate',city.id);
  let catalog=(await (await request('/api/locations')).json()).locations;
  assert.deepEqual(ancestors(landmark,catalog).map(p=>p.type),['universe','galaxy','solar-system','planet','continent','country','city']);
  assert.ok(selectLocations(catalog,'Silver Spiral').some(p=>p.id===landmark.id));
  const moved=await request('/api/locations','PUT',{...continent,name:'New Elaria',parentId:moon.id});assert.equal(moved.status,200);
  assert.equal((await request('/api/locations','PUT',continent)).status,409);
  catalog=(await (await request('/api/locations')).json()).locations;assert.ok(ancestors(landmark,catalog).some(p=>p.id===moon.id));
  const profile=await (await request('/api/countries/'+country.id)).json();assert.equal(profile.parentId,continent.id);
  const countrySave=await request('/api/countries/'+country.id,'PUT',{...profile,parentId:planet.id});assert.equal(countrySave.status,200);
  catalog=(await (await request('/api/locations')).json()).locations;assert.equal(catalog.find(p=>p.id===country.id).parentId,planet.id);
  const page=await (await request('/locations/countries/'+country.id+'/')).text();assert.ok(page.includes('name="parentId"'));assert.ok(page.includes('Meridian'));
  const dashboard=await (await request('/api/dashboard')).json();assert.equal(dashboard.locations.find(p=>p.id===system.id).label,'Solar system');assert.ok(dashboard.locations.find(p=>p.id===landmark.id).parent.includes('Meridian'));
  const sample=await (await request('/api/countries/sample-kingdom')).json();assert.equal((await request('/api/countries/sample-kingdom','PUT',{...sample,parentId:continent.id})).status,200);
  catalog=(await (await request('/api/locations')).json()).locations;assert.ok(ancestors(catalog.find(p=>p.id==='sample-capital'),catalog).some(p=>p.id===continent.id));
 }finally{db.close();}
});
test('world parents reject wrong types and other owners, while unfinished worlds may stand alone',async()=>{
 const {db,request,create}=setup();try{
  for(const type of ['universe','galaxy','solar-system','planet','moon','continent'])await create(type,type);
  const planet=await create('planet','Private world'),continent=await create('continent','Land',planet.id);
  for(const [type,parentId]of [['universe',planet.id],['galaxy',planet.id],['planet',continent.id],['continent','sample-capital'],['country','sample-capital']])assert.equal((await request('/api/locations','POST',{id:crypto.randomUUID(),name:'Invalid',type,parentId})).status,400);
  assert.equal((await request('/api/locations','PUT',{...planet,parentId:planet.id})).status,400);
  assert.equal((await request('/api/locations','PUT',planet,'someone-else')).status,404);
  assert.equal((await request('/api/locations','POST',{id:crypto.randomUUID(),type:'continent',name:'Other land',parentId:planet.id},'someone-else')).status,400);
  const sample=await (await request('/api/countries/sample-kingdom','GET',undefined,'someone-else')).json();assert.equal((await request('/api/countries/sample-kingdom','PUT',{...sample,parentId:continent.id},'someone-else')).status,400);
 }finally{db.close();}
});
test('nationality groups preserve presets, custom continent links and legacy entries across profile saves',async()=>{
 const {db,request,create}=setup();try{
  assert.equal(new Set(profileChoices.nationality).size,profileChoices.nationality.length);assert.deepEqual(Object.values(nationalityGroups).flat(),profileChoices.nationality);
  const continent=await create('continent','Elaria & the Isles');let character=await (await request('/api/characters/claude')).json();
  const save=await request('/api/characters/claude','PUT',{...character,nationality:'French · Elarian · Wanderer',nationalityContinents:{Elarian:continent.id}});assert.equal(save.status,200);character=await save.json();
  const html=await (await request('/characters/claude/')).text();assert.match(html,/<optgroup label="Europe">[\s\S]*?value="French"/);assert.ok(html.includes('label="Elaria &amp; the Isles"><option value="Elarian"'));assert.ok(html.includes('label="Custom continent"><option value="Wanderer"'));assert.ok(html.includes('value="French · Elarian · Wanderer"'));
  const legacy={...character,summary:'Updated'};delete legacy.nationalityContinents;const older=await request('/api/characters/claude','PUT',legacy);assert.equal(older.status,200);character=await older.json();assert.deepEqual(character.nationalityContinents,{Elarian:continent.id});
  const planet=await create('planet','Not a continent');assert.equal((await request('/api/characters/claude','PUT',{...character,nationalityContinents:{Elarian:planet.id}})).status,400);
  const other=await (await request('/api/characters/claude','GET',undefined,'other')).json();assert.equal((await request('/api/characters/claude','PUT',{...other,nationality:'Elarian',nationalityContinents:{Elarian:continent.id}},'other')).status,400);
  const removed=await request('/api/characters/claude','PUT',{...character,nationality:'French · Wanderer'});assert.equal(removed.status,200);assert.deepEqual((await removed.json()).nationalityContinents,{});
 }finally{db.close();}
});
