import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {fieldNames} from '../public/characters/template.js';
import {factionFields} from '../public/factions/template.js';
import {countryFields} from '../public/locations/countries/template.js';
import {cityFields} from '../public/locations/cities/template.js';
const origin='https://novel.example';
function setup(){
 const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(sqlite)};
 return async(path,method='GET',body,owner='author-a')=>worker.fetch(new Request(origin+path,{method,headers:{'oai-authenticated-user-id':owner,...(body===undefined?{}:{origin,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
}
const profiles=[
 {type:'character',id:'claude',api:'/api/characters/',page:'/characters/',field:'biography',names:fieldNames},
 {type:'faction',id:'sample-ember',api:'/api/factions/',page:'/factions/',field:'history',names:factionFields},
 {type:'country',id:'sample-kingdom',api:'/api/countries/',page:'/locations/countries/',field:'history',names:countryFields},
 {type:'city',id:'sample-capital',api:'/api/cities/',page:'/locations/cities/',field:'history',names:cityFields}
];
for(const {type,id,api,page,field,names} of profiles){
 test(`${type}: hidden text survives save/reopen, older clients, stale saves and restore`,async()=>{
  const req=setup(),url=api+id,original=await (await req(url)).json();
  const text='Private text retained while hidden.\nSecond paragraph with <symbols> & punctuation.';
  let response=await req(url,'PUT',{...original,[field]:text,hiddenFields:[field,field]});assert.equal(response.status,200);
  let saved=await response.json();assert.deepEqual(saved.hiddenFields,[field]);assert.equal(saved[field],text);
  let html=await (await req(page+id+'/')).text();assert.ok(html.includes(`data-profile-field="${field}" hidden`));assert.ok(html.includes('Second paragraph with &lt;symbols&gt; &amp; punctuation.'));
  const older={...saved,summary:'An older client edit'};delete older.hiddenFields;
  response=await req(url,'PUT',older);assert.equal(response.status,200);saved=await response.json();assert.deepEqual(saved.hiddenFields,[field]);assert.equal(saved[field],text);
  assert.equal((await req(url,'PUT',older)).status,409);
  const other=await (await req(url,'GET',undefined,'author-b')).json();assert.notEqual(other[field],text);assert.deepEqual(other.hiddenFields||[],[]);
  for(const hiddenFields of [['name'],[null],'history',null])assert.equal((await req(url,'PUT',{...saved,hiddenFields})).status,400);
  response=await req(url,'PUT',{...saved,hiddenFields:[]});assert.equal(response.status,200);
  const reopened=await (await req(url)).json();assert.equal(reopened[field],text);assert.deepEqual(reopened.hiddenFields,[]);
  html=await (await req(page+id+'/')).text();assert.ok(!html.includes(`data-profile-field="${field}" hidden`));
 });
 test(`${type}: standard profile keeps one editable copy of each field and accessible sections`,async()=>{
  const req=setup(),html=await (await req(page+id+'/')).text();
  for(const name of names)assert.equal(html.split(`name="${name}"`).length-1,1,name);
  assert.equal(html.split('<h1 ').length-1,1);assert.equal(html.split('id="edit-name"').length-1,1);
  assert.ok(html.includes('class="entity-profile '+type+'-profile"'));assert.match(html, /href="\/profiles\/editor\.css\?v=[^"]+"/);
  assert.ok(!html.includes('class="title-row"'));assert.ok(!html.includes('class="site-header"'));assert.ok(!html.includes('class="mobile-contents"'));assert.ok(!html.includes('class="desktop-contents"'));
  assert.match(html,/aria-controls="overview-body" data-collapse-target="overview-body"/);
  assert.match(html,/summary aria-label="Choose visible fields for Overview"/);
  assert.match(html,/data-collapse-target="identity-(group-0|information)"/);
  if(type==='country'||type==='city'){
   assert.match(html,/<button[^>]+id="edit-name"[^>]*><span id="official-heading">/);
   assert.match(html,/id="places-body" class="collapsible-region"/);
   assert.ok(!html.includes('Choose visible fields for Cities &amp; landmarks'));assert.ok(!html.includes('Choose visible fields for Areas &amp; landmarks'));
  }
 });
}
test('place dropdowns retain existing custom values and accept reusable presets',async()=>{
 const req=setup();for(const {id,api,page} of profiles.filter(p=>['country','city'].includes(p.type))){
  const current=await (await req(api+id)).json();const response=await req(api+id,'PUT',{...current,officialLanguages:'River speech · French',governmentType:'Council of Houses'});assert.equal(response.status,200);
  const html=await (await req(page+id+'/')).text();assert.ok(html.includes('value="Council of Houses" selected'));assert.ok(html.includes('value="River speech · French"'));assert.ok(html.includes('value="Republic"'));assert.ok(html.includes('data-choice-field="officialLanguages" data-multiple="true"'));
 }
});
