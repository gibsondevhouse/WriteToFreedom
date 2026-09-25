import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {locationTemplates} from '../public/locations/template.js';
import {locationHref,locationPaths,ancestors} from '../public/locations/data.js';
import {searchCatalog} from '../public/dashboard/search.js';
import {ratingGroupsFor} from '../public/profiles/ratings.js';

const origin='https://novel.example';
function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(sqlite)};
 const request=(path,method='GET',body,owner='author',extra={})=>worker.fetch(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),origin,'content-type':'application/json',...extra},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}),env);
 async function create(type,parentId=['area','landmark'].includes(type)?'sample-capital':null,name='Test '+type){
  const response=await request('/api/locations','POST',{id:crypto.randomUUID(),name,type,parentId,...(type==='area'?{areaType:'Neighborhood'}:{})});
  assert.equal(response.status,201);return response.json();
 }
 const get=async path=>{const response=await request(path);assert.equal(response.status,200);return response.json();};
 return {request,create,get};
}

for(const [type,template] of Object.entries(locationTemplates)){
 test(`${type}: full profile fields persist, share controls, and retain private versions`,async t=>{
  const {request,create,get}=setup(t),place=await create(type),url='/api/locations/'+place.id,page=locationHref(place);
  let record=await get(url);
  assert.deepEqual(record.profileRatings,{});
  for(const key of template.fields)assert.equal(typeof record[key],'string',key);
  let response=await request(page),html=await response.text();assert.equal(response.status,200);
  assert.equal(html.split('id="ratings"').length-1,1);assert.equal(html.split('data-profile-ratings=').length-1,new Set(ratingGroupsFor('location',type).map(group=>group.sectionId)).size);
  assert.equal((html.match(/<h1 /g)||[]).length,1);
  for(const key of template.fields)assert.equal(html.split(`name="${key}"`).length-1,1,key);
  assert.ok(html.includes('data-collapse-target="identity-information"'));
  assert.ok(html.includes('Choose visible fields for Overview'));
  for(const [key] of template.dates)assert.match(html,new RegExp(`name="${key}"[^>]*data-date-input`));
  if(type==='universe')assert.ok(!html.includes('name="parentId"'));
  const ratingKey=ratingGroupsFor('location',type)[0].fields[0][0];
  const changes={...record,name:'Renamed '+type,history:'Claude found </textarea><script>danger</script> & clues.',summary:'A silver sanctuary',questions:'Who built it?\nWhere is the key?',hiddenFields:['history'],profileRatings:{[ratingKey]:73},imageUrl:'https://example.com/image.png',mapUrl:'https://example.com/map.png'};
  for(const [key] of template.dates)changes[key]='c. 1200 BCE';
  if(template.fields.includes('population'))changes.population='42,000';
  for(const section of template.sections.filter(s=>!['identity','symbols'].includes(s.id)))for(const [key] of section.fields)if(!Object.hasOwn(changes,key)||!changes[key])changes[key]='Notes for '+key;
  response=await request(url,'PUT',changes);assert.equal(response.status,200);record=await response.json();assert.equal(record.version,place.version+1);
  html=await (await request(page)).text();
  assert.ok(html.includes('data-profile-field="history" hidden'));assert.ok(html.includes('&lt;/textarea&gt;&lt;script&gt;danger&lt;/script&gt;'));
  assert.ok(html.includes('src="https://example.com/image.png"'));
  assert.equal((await get(url)).history,changes.history);
  assert.deepEqual((await get(url)).profileRatings,{[ratingKey]:73});
  assert.equal((await request(url,'PUT',changes)).status,409);
  assert.equal((await request(url,'GET',undefined,'other')).status,404);
  assert.equal((await request(page,'GET',undefined,'other')).status,404);
  const oldClient={...record,summary:'Updated summary'};delete oldClient.hiddenFields;delete oldClient.profileRatings;
  response=await request(url,'PUT',oldClient);assert.equal(response.status,200);record=await response.json();assert.deepEqual(record.hiddenFields,['history']);
  assert.deepEqual(record.profileRatings,{[ratingKey]:73});
  response=await request(url,'PUT',{...record,hiddenFields:[]});assert.equal(response.status,200);record=await response.json();assert.equal(record.history,changes.history);
  for(const bad of [{imageUrl:'javascript:alert(1)'},{mapUrl:'http://example.com/a.png'},{name:''},{summary:'x'.repeat(10001)},{hiddenFields:['name']},{type:'city'},{version:-1}])assert.equal((await request(url,'PUT',{...record,...bad})).status,400,JSON.stringify(bad).slice(0,100));
  for(const profileRatings of [{[ratingKey]:100},{[ratingKey]:1.5},{unknown:20},[],null])assert.equal((await request(url,'PUT',{...record,profileRatings})).status,400);
  const catalog=(await get('/api/locations')).locations;assert.equal(catalog.find(l=>l.id===place.id).name,record.name);
  const dashboard=await get('/api/dashboard');assert.equal(dashboard.locations.find(l=>l.id===place.id).href,page);assert.equal(dashboard.locations.find(l=>l.id===place.id).image,record.imageUrl);
  assert.ok(searchCatalog(dashboard,'Updated summary').some(l=>l.id===place.id));
  assert.equal(dashboard.questions.find(l=>l.id===place.id).href,page+'#field-questions');
  assert.ok(dashboard.characters.find(c=>c.id==='claude').mentions.some(m=>m.href===page+'#field-history'));
  assert.ok((await (await request('/characters/claude/')).text()).includes(page+'#field-history'));
  const connections=await get('/api/characters/claude?view=connections');assert.equal(connections.options.find(o=>o.ref.id===place.id).href,page);assert.equal(connections.options.find(o=>o.ref.id===place.id).image,record.imageUrl);
  const timeline=await get('/api/timeline'),events=timeline.events.filter(e=>e.entityId===type+':'+place.id);
  assert.equal(events.length,template.dates.length);assert.deepEqual(events.map(e=>e.id).sort(),dashboard.timeline.events.filter(e=>e.entityId===type+':'+place.id).map(e=>e.id).sort());
  for(const [field,kind] of template.dates){const event=events.find(e=>e.field===field);assert.equal(event.kind,kind);assert.equal(event.href,page+'#field-'+field);assert.equal(event.rawDate,'c. 1200 BCE');}
  const head=await request(page,'HEAD');assert.equal(head.status,200);assert.equal(await head.text(),'');
  const redirect=await request(page.slice(0,-1)+'?source=test');assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),origin+page+'?source=test');
  assert.equal((await request(locationPaths[type==='universe'?'galaxy':'universe']+place.id+'/')).status,404);
 });
}

test('legacy directory updates preserve full content, visibility and subtype with shared concurrency',async t=>{
 const {request,create,get}=setup(t),area=await create('area'),url='/api/locations/'+area.id;
 const legacy=await get(url);assert.equal(legacy.areaType,'Neighborhood');assert.equal(legacy.version,1);
 let response=await request(url,'PUT',{...legacy,history:'Keep this history',hiddenFields:['history'],leaderId:'claude'});assert.equal(response.status,200);let saved=await response.json();
 response=await request('/api/locations','PUT',{id:area.id,type:'area',name:'New borough',parentId:'sample-capital',areaType:'Borough',version:saved.version});assert.equal(response.status,200);
 const reopened=await get(url);assert.equal(reopened.history,'Keep this history');assert.deepEqual(reopened.hiddenFields,['history']);assert.equal(reopened.areaType,'Borough');assert.equal(reopened.leaderId,'claude');
 assert.equal((await request(url,'PUT',saved)).status,409);
 assert.equal((await request(url,'PUT',{...reopened,leaderId:'missing'})).status,400);
 assert.equal((await request(url,'PUT',{...reopened,areaType:'Not a subtype'})).status,400);
 const attempts=await Promise.all([request(url,'PUT',{...reopened,summary:'First'}),request(url,'PUT',{...reopened,summary:'Second'})]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
});

test('profile parent moves refresh ancestry and retain descendant identities while enforcing hierarchy',async t=>{
 const {request,create,get}=setup(t),planet=await create('planet'),moon=await create('moon',planet.id),continent=await create('continent',planet.id),area=await create('area'),nested=await create('area',area.id),landmark=await create('landmark',nested.id);
 const url='/api/locations/'+continent.id,record=await get(url);
 let response=await request(url,'PUT',{...record,parentId:moon.id});assert.equal(response.status,200);let saved=await response.json();assert.deepEqual(saved.ancestry.map(a=>a.id),[planet.id,moon.id]);assert.equal(saved.ancestry[1].href,locationHref(moon));
 assert.equal((await request(url,'PUT',{...saved,parentId:'sample-capital'})).status,400);
 assert.equal((await request(url,'PUT',{...saved,parentId:'missing'})).status,400);
 assert.equal((await request('/api/locations/'+planet.id,'PUT',{...(await get('/api/locations/'+planet.id)),parentId:planet.id})).status,400);
 const areaUrl='/api/locations/'+area.id,areaRecord=await get(areaUrl);
 for(const parentId of ['',area.id,nested.id,planet.id])assert.equal((await request(areaUrl,'PUT',{...areaRecord,parentId})).status,400);
 const otherArea=await create('area','sample-capital');response=await request(areaUrl,'PUT',{...areaRecord,parentId:otherArea.id});assert.equal(response.status,200);
 const catalog=(await get('/api/locations')).locations;assert.equal(catalog.find(l=>l.id===landmark.id).parentId,nested.id);assert.ok(ancestors(catalog.find(l=>l.id===landmark.id),catalog).some(l=>l.id===otherArea.id));
 const html=await (await request(locationHref(area))).text();assert.ok(html.includes(locationHref(nested)));assert.ok(!html.includes('href="'+locationHref(landmark)+'"'));
 const universe=await create('universe'),universeRecord=await get('/api/locations/'+universe.id);assert.equal((await request('/api/locations/'+universe.id,'PUT',{...universeRecord,parentId:planet.id})).status,400);
 assert.equal((await request('/api/locations/sample-royal-archive','PUT',{...(await get('/api/locations/sample-royal-archive')),parentId:area.id},'other')).status,400);
});

test('sample landmark edits and linked notes remain private; method and request envelopes are enforced',async t=>{
 const {request,get}=setup(t),url='/api/locations/sample-royal-archive',page='/locations/landmarks/sample-royal-archive/';
 let record=await get(url);assert.equal(record.version,0);
 const response=await request(url,'PUT',{...record,history:'Private archive',questions:'A hidden question',hiddenFields:['questions'],founded:'14 Harvest, 112'});assert.equal(response.status,200);record=await response.json();
 const other=await (await request(url,'GET',undefined,'other')).json();assert.equal(other.history,'');assert.equal(other.version,0);
 const dashboard=await get('/api/dashboard');assert.equal(dashboard.questions.find(q=>q.id===record.id).href,page);
 const timeline=await get('/api/timeline');assert.equal(timeline.unplaced.find(e=>e.entityId==='landmark:'+record.id).rawDate,'14 Harvest, 112');
 const character=await get('/api/characters/claude');
 const note={id:crypto.randomUUID(),field:'biography',position:null,text:'The archive conceals the key.',links:[{kind:'location',id:record.id}]};
 assert.equal((await request('/api/characters/claude','PUT',{...character,notes:[...(character.notes||[]),note]})).status,200);
 assert.ok((await (await request(page)).text()).includes('The archive conceals the key.'));
 assert.ok(!(await (await request(page,'GET',undefined,'other')).text()).includes('The archive conceals the key.'));
 for(const path of [url,page])assert.equal((await request(path,'GET',undefined,null)).status,401);
 assert.equal((await request(url,'POST',{})).status,405);assert.equal((await request(page,'PUT',{})).status,405);
 assert.equal((await request(url,'PUT',record,'author',{origin:'https://evil.example'})).status,403);
 assert.equal((await request(url,'PUT',record,'author',{'content-type':'text/plain'})).status,403);
 assert.equal((await request(url,'PUT','{')).status,400);
 assert.equal((await request(url,'PUT','x'.repeat(550001))).status,413);
 assert.equal((await request('/api/locations/sample-capital')).status,404);
});
