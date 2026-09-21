import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {countryFields,blankCountry} from '../public/locations/countries/template.js';
const origin='https://novel.example';
function setup(){const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));const worker=createWorker({'/locations/countries/profile.js':{content:'/* script */',type:'text/javascript'}}),env={DB:d1Adapter(sqlite)};return async(path,method='GET',body,owner='author-a',source=origin)=>worker.fetch(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(body===undefined?{}:{origin:source,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);}
test('country pages expose the editable template and derived city/landmark hierarchy',async()=>{
 const req=setup(),page=await req('/locations/countries/sample-kingdom/');assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'no-store');const html=await page.text();
 for(const key of countryFields)assert.equal(html.split('name="'+key+'"').length-1,1,key);
 for(const value of ['The Capital','Royal Archive','Geography','Government &amp; politics','Economy','Culture'])assert.ok(html.includes(value),value);
 assert.ok(html.includes('/locations/#location-sample-capital'));assert.ok(html.includes('value="sample-capital" selected'));
 assert.equal((await req('/locations/countries/sample-capital/')).status,404);
 assert.equal((await req('/locations/countries/profile.js')).status,200);
 assert.equal((await req('/locations/countries/sample-kingdom')).status,308);
});
test('country changes persist privately, rename the directory, and prevent stale saves',async()=>{
 const req=setup(),original=await (await req('/api/countries/sample-kingdom')).json();const payload={...original,name:'The United Houses',officialName:'Union of the Houses',history:'First era\nSecond era',population:'12 million',flagUrl:'https://example.com/flag.png'};
 let response=await req('/api/countries/sample-kingdom','PUT',payload);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.version,1);
 const reopened=await (await req('/api/countries/sample-kingdom')).json();assert.equal(reopened.history,payload.history);assert.equal(reopened.flagUrl,payload.flagUrl);
 const list=(await (await req('/api/locations')).json()).locations;assert.equal(list.find(l=>l.id==='sample-kingdom').name,payload.name);assert.equal(list.find(l=>l.id==='sample-capital').parentId,'sample-kingdom');
 assert.equal((await (await req('/api/countries/sample-kingdom','GET',undefined,'author-b')).json()).name,original.name);
 assert.equal((await req('/api/countries/sample-kingdom','PUT',payload)).status,409);
 assert.equal((await req('/api/countries/sample-kingdom','PUT',{...saved,currency:'Crowns'})).status,200);
});
test('custom countries retain location IDs and capitals must be cities in the same country',async()=>{
 const req=setup(),id=crypto.randomUUID(),cityId=crypto.randomUUID();await req('/api/locations','POST',{id,name:'The Coast',type:'country',parentId:null});
 let profile=await (await req('/api/countries/'+id)).json();assert.equal(profile.name,'The Coast');assert.equal(profile.history,'');
 assert.equal((await req('/api/countries/'+id,'PUT',{...profile,capitalId:'sample-capital'})).status,400);
 await req('/api/locations','POST',{id:cityId,name:'Port City',type:'city',parentId:id});
 let response=await req('/api/countries/'+id,'PUT',{...profile,name:'Coastal Union',capitalId:cityId,largestCityId:cityId,leaderId:'claude'});assert.equal(response.status,200);
 assert.equal((await (await req('/api/locations')).json()).locations.find(l=>l.id===id).name,'Coastal Union');
 assert.equal((await req('/api/countries/'+id,'GET',undefined,'author-b')).status,404);
 assert.equal((await req('/locations/countries/'+id+'/','GET',undefined,'author-b')).status,404);
});
test('country APIs require authorized writes and escape stored text and reject unsafe image URLs',async()=>{
 const req=setup(),original=await (await req('/api/countries/sample-kingdom')).json();
 assert.equal((await req('/api/countries/sample-kingdom','GET',undefined,null)).status,401);
 assert.equal((await req('/api/countries/sample-kingdom','PUT',original,'author-a','https://other.example')).status,403);
 assert.equal((await req('/api/countries/sample-kingdom','PUT',{...original,flagUrl:'javascript:alert(1)'})).status,400);
 assert.equal((await req('/api/countries/sample-kingdom','PUT',{...original,name:' '})).status,400);
 assert.equal((await req('/api/countries/sample-kingdom','PUT',{...original,leaderId:crypto.randomUUID()})).status,400);
 const attack='</textarea><script>alert(1)</script>';assert.equal((await req('/api/countries/sample-kingdom','PUT',{...original,name:attack,history:attack})).status,200);
 const html=await (await req('/locations/countries/sample-kingdom/')).text();assert.ok(!html.includes(attack));assert.ok(html.includes('&lt;/textarea&gt;'));
});
