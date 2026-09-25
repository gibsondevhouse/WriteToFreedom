import {assertDocumentSchema} from './helpers/document-schema.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {worldProfileCases,createWorldProfile,populatedWorldProfile,profileEndpoint,profilePage} from './world-profile-fixtures.mjs';

function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(sqlite)},origin='https://novel.example';
 const request=(path,method='GET',body,owner='field-audit')=>worker.fetch(new Request(origin+path,{method,headers:{'oai-authenticated-user-id':owner,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 const json=async(path,method='GET',body)=>{const response=await request(path,method,body);assert.ok(response.ok,`${method} ${path}: ${response.status} ${response.ok?'':await response.text()}`);return response.json();};
 return {sqlite,request,json};
}

for(const profile of worldProfileCases)test(`${profile.type}: every rendered authoring field reaches SQLite, survives partial saves and clears explicitly`,async t=>{
 const {sqlite,request,json}=setup(t),{record,references}=await createWorldProfile(profile.type,json);
 const endpoint=profileEndpoint(profile.type,record.id),page=profilePage(profile.type,record.id);
 const written=populatedWorldProfile(profile,record,references);
 const initialHtml=await (await request(page)).text();
 for(const [key] of profile.fields)assert.equal(initialHtml.split(`name="${key}"`).length-1,1,`${key}: exactly one rendered control`);
 const saved=await json(endpoint,'PUT',{version:record.version,...written});
 assert.equal(saved.version,record.version+1);
 const row=sqlite.prepare(`SELECT document,version,schema_version FROM ${profile.table} WHERE owner_id = ? AND ${profile.identityColumn} = ?`).get('field-audit',record.id);
 assert.equal(row.version,saved.version);assert.equal(row.schema_version,1);
 const stored=JSON.parse(row.document),reopened=await json(endpoint);
 assertDocumentSchema(['faction','country','city'].includes(profile.type)?profile.type:'location_'+profile.type,stored);
 assert.equal(saved.updatedAt,sqlite.prepare(`SELECT updated_at FROM ${profile.table} WHERE ${profile.identityColumn} = ?`).get(record.id).updated_at);
 assert.equal(reopened.updatedAt,saved.updatedAt);
 const rendered=JSON.parse((await (await request(page)).text()).match(/<script id="profile-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 for(const [key,value] of Object.entries(written)){
  assert.deepEqual(stored[key],value,`${key}: raw SQLite document`);
  assert.deepEqual(saved[key],value,`${key}: save response`);
  assert.deepEqual(reopened[key],value,`${key}: fresh API request`);
  assert.deepEqual(rendered[key],value,`${key}: reload bootstrap data`);
 }
 const partial=await json(endpoint,'PUT',{version:saved.version,summary:'A partial edit touches one field.'});
 for(const [key,value] of Object.entries(written))if(key!=='summary')assert.deepEqual(partial[key],value,`${key}: omitted fields must survive a partial client`);
 const cleared=Object.fromEntries(profile.fields.map(([key])=>[key,key==='name'?written.name:key==='parentId'?written.parentId:key==='areaType'?written.areaType:'']));
 const clearedSaved=await json(endpoint,'PUT',{version:partial.version,...cleared,hiddenFields:[],profileRatings:{}});
 for(const [key,value] of Object.entries(cleared))assert.deepEqual(clearedSaved[key],value,`${key}: explicit empty value`);
 assert.deepEqual(clearedSaved.hiddenFields,[]);assert.deepEqual(clearedSaved.profileRatings,{});
});

for(const type of ['country','city'])test(`${type}: custom language labels preserve exact array membership and legacy edits stay synchronized`,async t=>{
 const {sqlite,request,json}=setup(t),{record}=await createWorldProfile(type,json),endpoint=profileEndpoint(type,record.id);
 const officialLanguages=['French','River · speech','Harbor dialect'];
 const saved=await json(endpoint,'PUT',{version:record.version,choiceSelections:{officialLanguages}});
 assert.deepEqual(saved.choiceSelections,{officialLanguages});
 assert.equal(saved.officialLanguages,officialLanguages.join(' · '));
 const row=sqlite.prepare(`SELECT document FROM ${type}_profiles WHERE owner_id = ? AND location_id = ?`).get('field-audit',record.id);
 assert.deepEqual(JSON.parse(row.document).choiceSelections,{officialLanguages});
 const reopened=await json(endpoint);assert.deepEqual(reopened.choiceSelections,{officialLanguages});
 // A client that does not know about exact arrays can still make unrelated edits.
 const retained=await json(endpoint,'PUT',{version:saved.version,officialLanguages:saved.officialLanguages,summary:'An unrelated edit'});
 assert.deepEqual(retained.choiceSelections,{officialLanguages});
 for(const choiceSelections of [null,[],{roles:['Teacher']},{officialLanguages:'French'},{officialLanguages:[null]},{officialLanguages:['']},{officialLanguages:['French','French']},{officialLanguages:['x'.repeat(10001)]}]){
  const response=await request(endpoint,'PUT',{version:retained.version,choiceSelections});assert.equal(response.status,400,JSON.stringify(choiceSelections).slice(0,90));
 }
 assert.equal((await json(endpoint)).version,retained.version);
 // An older client may echo last-read arrays while changing only the old string.
 const changed=await json(endpoint,'PUT',{...retained,officialLanguages:'English · River speech'});
 assert.deepEqual(changed.choiceSelections,{officialLanguages:['English','River speech']});
 const cleared=await json(endpoint,'PUT',{version:changed.version,officialLanguages:''});
 assert.deepEqual(cleared.choiceSelections,{officialLanguages:[]});
});

for(const type of ['country','city'])test(`${type}: directory previews expose saved media and summary without copying full profiles or another author's changes`,async t=>{
 const {sqlite,request,json}=setup(t),{record:custom}=await createWorldProfile(type,json);
 const sampleId=type==='country'?'sample-kingdom':'sample-capital';
 for(const record of [custom,await json(profileEndpoint(type,sampleId))]){
  const before=(await json('/api/locations')).locations.find(location=>location.id===record.id);
  for(const key of ['summary','flagUrl','skylineUrl','version','updatedAt'])assert.equal(Object.hasOwn(before,key),false,`${key}: unsaved profiles retain the base catalog shape`);
  const saved=await json(profileEndpoint(type,record.id),'PUT',{
   version:record.version,name:'Renamed '+type+' '+record.id,summary:'The saved card description.',history:'Detailed history stays in the profile.',
   flagUrl:'https://example.com/'+type+'-flag.png',...(type==='city'?{skylineUrl:'https://example.com/city-skyline.png'}:{}),
   mapUrl:'https://example.com/full-profile-map.png',hiddenFields:['history'],profileRatings:{safety:0},officialLanguages:'French · River speech',
  });
  const rawDocument=()=>sqlite.prepare(`SELECT document FROM ${type}_profiles WHERE owner_id = ? AND location_id = ?`).get('field-audit',record.id).document;
  const storedBefore=rawDocument();
  const catalog=(await json('/api/locations')).locations.find(location=>location.id===record.id);
  for(const key of ['name','parentId','summary','flagUrl','version','schemaVersion','updatedAt',...(type==='city'?['skylineUrl']:[])])assert.deepEqual(catalog[key],saved[key],`${key}: saved catalog projection`);
  assert.equal(catalog.type,type);assert.equal(catalog.id,record.id);
  assert.equal(new Date(catalog.updatedAt).toISOString(),catalog.updatedAt);
  assert.equal(catalog.skylineUrl||catalog.flagUrl,type==='city'?saved.skylineUrl:saved.flagUrl,'directory image source');
  for(const key of ['history','mapUrl','hiddenFields','profileRatings','choiceSelections','officialLanguages'])assert.equal(Object.hasOwn(catalog,key),false,`${key}: keep full profile content out of the directory projection`);
  const reopened=await json(profileEndpoint(type,record.id));
  for(const key of ['history','mapUrl','hiddenFields','profileRatings','choiceSelections','officialLanguages'])assert.deepEqual(reopened[key],saved[key],`${key}: full profile remains intact`);
  assert.equal(rawDocument(),storedBefore,'catalog reads do not rewrite profile storage');
  const otherCatalog=(await (await request('/api/locations','GET',undefined,'another-author')).json()).locations;
  const other=otherCatalog.find(location=>location.id===record.id);
  if(record.id===sampleId){
   assert.notEqual(other.name,saved.name);
   for(const key of ['summary','flagUrl','skylineUrl','version','updatedAt'])assert.equal(Object.hasOwn(other,key),false,`${key}: another author's sample stays unmodified`);
  }else assert.equal(other,undefined,'custom location identities stay private');
 }
});
