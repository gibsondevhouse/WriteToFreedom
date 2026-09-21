import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {cityFields} from '../public/locations/cities/template.js';
import {ancestors} from '../public/locations/data.js';
const origin='https://novel.example';
function setup(){const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));const worker=createWorker({'/locations/cities/profile.js':{content:'/* script */',type:'text/javascript'},'/locations/cities/template.js':{content:'/* template */',type:'text/javascript'}}),env={DB:d1Adapter(sqlite)};return async(path,method='GET',body,owner='author-a',source=origin)=>worker.fetch(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(body===undefined?{}:{origin:source,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);}
test('city profiles expose all editable fields, required country, and linked landmarks',async()=>{
 const req=setup(),response=await req('/locations/cities/sample-capital/');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const html=await response.text();
 for(const key of cityFields)assert.equal(html.split('name="'+key+'"').length-1,1,key);
 assert.match(html,/<select[^>]+name="parentId"[^>]+required>/);assert.match(html,/value="sample-kingdom" selected/);
 for(const text of ['City profile','Boroughs &amp; neighborhoods','Infrastructure','Royal Archive','/locations/countries/sample-kingdom/'])assert.ok(html.includes(text),text);
 assert.equal((await req('/locations/cities/sample-kingdom/')).status,404);
 for(const asset of ['profile.js','template.js'])assert.equal((await req('/locations/cities/'+asset)).status,200);
 assert.equal((await req('/locations/cities/sample-capital')).status,308);
 assert.equal((await req('/locations/cities/sample-capital/','HEAD')).status,200);
});
test('city edits save and reopen privately, rename directory and country listings, reject stale saves',async()=>{
 const req=setup(),original=await (await req('/api/cities/sample-capital')).json();const payload={...original,name:'Ember City',history:'First era\nSecond era',region:'Riverlands',leaderId:'claude',skylineUrl:'https://example.com/city.png'};
 let response=await req('/api/cities/sample-capital','PUT',payload);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.version,1);
 const reopened=await (await req('/api/cities/sample-capital')).json();assert.equal(reopened.history,payload.history);assert.equal(reopened.skylineUrl,payload.skylineUrl);
 const list=(await (await req('/api/locations')).json()).locations;assert.equal(list.find(l=>l.id==='sample-capital').name,payload.name);
 const country=await (await req('/locations/countries/sample-kingdom/')).text();assert.ok(country.includes('Ember City'));assert.ok(country.includes('/locations/cities/sample-capital/'));
 assert.equal((await (await req('/api/cities/sample-capital','GET',undefined,'author-b')).json()).name,original.name);
 assert.equal((await req('/api/cities/sample-capital','PUT',payload)).status,409);
 assert.equal((await req('/api/cities/sample-capital','PUT',{...saved,population:'250,000'})).status,200);
});
test('every city requires an owned country and landmarks follow a city when it moves',async()=>{
 const req=setup(),countryId=crypto.randomUUID(),cityId=crypto.randomUUID(),landmarkId=crypto.randomUUID();
 await req('/api/locations','POST',{id:countryId,name:'The Coast',type:'country',parentId:null});
 await req('/api/locations','POST',{id:cityId,name:'Port City',type:'city',parentId:'sample-kingdom'});
 await req('/api/locations','POST',{id:landmarkId,name:'Old Harbor',type:'landmark',parentId:cityId});
 const profile=await (await req('/api/cities/'+cityId)).json();assert.equal(profile.history,'');assert.equal(profile.parentId,'sample-kingdom');
 for(const parentId of ['',cityId,'sample-royal-archive',crypto.randomUUID()])assert.equal((await req('/api/cities/'+cityId,'PUT',{...profile,parentId})).status,400);
 const foreign=crypto.randomUUID();await req('/api/locations','POST',{id:foreign,name:'Private nation',type:'country',parentId:null},'author-b');
 assert.equal((await req('/api/cities/'+cityId,'PUT',{...profile,parentId:foreign})).status,400);
 assert.equal((await req('/api/cities/'+cityId,'PUT',{...profile,name:'New Port',parentId:countryId})).status,200);
 const list=(await (await req('/api/locations')).json()).locations;assert.deepEqual(ancestors(list.find(l=>l.id===landmarkId),list).map(l=>l.id),[countryId,cityId]);
 const old=await (await req('/locations/countries/sample-kingdom/')).text();assert.ok(!old.includes('Old Harbor'));
 const next=await (await req('/locations/countries/'+countryId+'/')).text();assert.ok(next.includes('Old Harbor'));assert.ok(next.includes('New Port'));
 assert.equal((await req('/api/cities/'+cityId,'GET',undefined,'author-b')).status,404);
 assert.equal((await req('/locations/cities/'+cityId+'/','GET',undefined,'author-b')).status,404);
});
test('moving a capital requires clearing its national designation and preserves all landmarks',async()=>{
 const req=setup(),countryId=crypto.randomUUID();await req('/api/locations','POST',{id:countryId,name:'The Coast',type:'country',parentId:null});
 const city=await (await req('/api/cities/sample-capital')).json();let response=await req('/api/cities/sample-capital','PUT',{...city,parentId:countryId});assert.equal(response.status,400);assert.match((await response.json()).error,/capital or largest city/);
 const country=await (await req('/api/countries/sample-kingdom')).json();await req('/api/countries/sample-kingdom','PUT',{...country,capitalId:'',largestCityId:''});
 assert.equal((await req('/api/cities/sample-capital','PUT',{...city,parentId:countryId})).status,200);
 const list=(await (await req('/api/locations')).json()).locations;assert.equal(ancestors(list.find(l=>l.id==='sample-royal-archive'),list)[0].id,countryId);
});
test('city writes enforce identity, safe images, valid leaders and escaped article text',async()=>{
 const req=setup(),original=await (await req('/api/cities/sample-capital')).json();
 assert.equal((await req('/api/cities/sample-capital','GET',undefined,null)).status,401);
 assert.equal((await req('/api/cities/sample-capital','PUT',original,'author-a','https://other.example')).status,403);
 for(const skylineUrl of ['javascript:alert(1)','http://example.com/city.png','https://user:secret@example.com/city.png'])assert.equal((await req('/api/cities/sample-capital','PUT',{...original,skylineUrl})).status,400);
 assert.equal((await req('/api/cities/sample-capital','PUT',{...original,name:' '})).status,400);
 assert.equal((await req('/api/cities/sample-capital','PUT',{...original,leaderId:crypto.randomUUID()})).status,400);
 const attack='</textarea><script>alert(1)</script>';assert.equal((await req('/api/cities/sample-capital','PUT',{...original,name:attack,history:attack})).status,200);
 const html=await (await req('/locations/cities/sample-capital/')).text();assert.ok(!html.includes(attack));assert.ok(html.includes('&lt;/textarea&gt;'));
});
