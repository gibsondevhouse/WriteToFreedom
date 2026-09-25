import {assertDocumentSchema} from './helpers/document-schema.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {loreTypes,loreTemplates,allowedCollections} from '../public/lore/template.js';
import {ratingGroupsFor} from '../public/profiles/ratings.js';
import {arcBeats,pacingMetrics,storyArcFields,storyArcHideableFields} from '../public/story-arcs/template.js';

function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const name of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(sqlite)},origin='https://writer.example';
 const request=(path,method='GET',body)=>worker.fetch(new Request(origin+path,{method,headers:{'oai-authenticated-user-id':'narrative-audit',origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 const save=async(path,method,body)=>{const response=await request(path,method,body);assert.equal(response.status,method==='POST'?201:200,await response.clone().text());return response.json();};
 const stored=(table,id)=>{const document=JSON.parse(sqlite.prepare(`SELECT document FROM ${table} WHERE id = ?`).get(id).document);assertDocumentSchema(table==='story_arcs'?'storyArc':'lore_'+document.type,document);return document;};
 return {sqlite,request,save,stored};
}

for(const type of Object.keys(loreTypes))test(`${type}: every UI field and collection, rating, visibility, and reference survives physical JSON storage`,async t=>{
 const {request,save,stored}=setup(t),template=loreTemplates[type];
 const fields=Object.fromEntries(template.sections.flatMap(section=>section.fields).map(([key,,control])=>[key,key==='name'?`Complete ${type}`:key==='imageUrl'?'https://example.com/lore.png':control==='date'?'circa 1400 BCE':control==='textarea'?`  ${type}.${key}: α & <literal>\nSecond paragraph.\n  `:`${type}.${key} — α`]));
 const profileRatings=Object.fromEntries(ratingGroupsFor('lore',type).flatMap(group=>group.fields).map(([key],index)=>[key,index%2?99:0]));
 const document={...fields,type,collections:allowedCollections(type),hiddenFields:template.hideableFields,profileRatings,pinned:true,featured:true,connections:[{target:{kind:'character',id:'claude'},relationship:'interprets'},{target:{kind:'location',id:'sample-capital'},relationship:'found in'},{target:{kind:'faction',id:'sample-ember'},relationship:'commissioned by'}]};
 const created=await save('/api/lore','POST',{id:crypto.randomUUID(),schemaVersion:1,...document}),path='/api/lore/'+created.id;
 assert.deepEqual(stored('lore_entries',created.id),document);
 const reloaded=await (await request(path)).json();for(const [key,value] of Object.entries(document))assert.deepEqual(reloaded[key],value,key);
 // A minimal unrelated update must never erase hidden text, unset/zero ratings,
 // overlapping collections, or the user's ordered relationship descriptions.
 const updated=await save(path,'PUT',{schemaVersion:1,version:created.version,name:`Renamed ${type}`});
 assert.deepEqual(stored('lore_entries',created.id),{...document,name:`Renamed ${type}`});
 assert.equal(updated.schemaVersion,1);
 const cleared=await save(path,'PUT',{schemaVersion:1,version:updated.version,summary:'',profileRatings:{},hiddenFields:[],connections:[],pinned:false,featured:false});
 assert.deepEqual(stored('lore_entries',created.id),{...document,name:`Renamed ${type}`,summary:'',profileRatings:{},hiddenFields:[],connections:[],pinned:false,featured:false});
 assert.equal(cleared.version,3);
});

test('story arc records every prompted answer and nested pacing value, retaining scene identity, order and prose',async t=>{
 const {request,save,stored}=setup(t),other=await save('/api/story-arcs','POST',{id:crypto.randomUUID()});
 const fields=Object.fromEntries(storyArcFields.map(key=>[key,key==='name'?'Complete narrative':key==='arcType'?'Political Subplot':key==='status'?'Revising':key==='startDate'?'1200 BCE':key==='endDate'?'The second winter':`  ${key}\nA deliberate paragraph.\n  `]));
 const document={...fields,pacing:Object.fromEntries(arcBeats.map((beat,index)=>[beat.id,Object.fromEntries(pacingMetrics.map(([metric],offset)=>[metric,(index*19+offset*7)%100]))])),hiddenFields:storyArcHideableFields,keyEntities:[{kind:'character',id:'claude'},{kind:'faction',id:'sample-ember'},{kind:'location',id:'sample-capital'}],connectedArcIds:[other.id],keyScenes:arcBeats.map((beat,index)=>({id:crypto.randomUUID(),title:`Scene ${index+1}`,chapter:index?`Chapter ${index+1}`:'Legacy chapter context '.repeat(30).trim(),beat:beat.id,summary:`  Purpose for ${beat.id}.\nPreserve this final line.\n  `}))};
 let arc=await save('/api/story-arcs','POST',{id:crypto.randomUUID(),schemaVersion:1,...document});
 assert.deepEqual(stored('story_arcs',arc.id),document);
 const path='/api/story-arcs/'+arc.id,reordered=[...arc.keyScenes].reverse();reordered[0]={...reordered[0],summary:'  Revised resolution\n  '};
 arc=await save(path,'PUT',{schemaVersion:1,version:arc.version,keyScenes:reordered});
 assert.deepEqual(stored('story_arcs',arc.id),{...document,keyScenes:reordered});
 assert.deepEqual((await (await request(path)).json()).keyScenes,reordered);
 const invalid=await request(path,'PUT',{version:arc.version,keyScenes:[{...reordered[0],chapter:'x'.repeat(10001)}]});assert.equal(invalid.status,400);
 assert.deepEqual(stored('story_arcs',arc.id),{...document,keyScenes:reordered});
 arc=await save(path,'PUT',{version:arc.version,keyScenes:[],keyEntities:[],connectedArcIds:[],hiddenFields:[]});
 assert.deepEqual(stored('story_arcs',arc.id),{...document,keyScenes:[],keyEntities:[],connectedArcIds:[],hiddenFields:[]});
});

test('an unavailable historical story-arc entity remains writable until explicitly removed',async t=>{
 const {sqlite,request,save}=setup(t),arc=await save('/api/story-arcs','POST',{id:crypto.randomUUID(),name:'Historical outline'}),reference={kind:'character',id:'retired-character'};
 // Simulates a migrated archive whose original linked entity is unavailable.
 sqlite.prepare("UPDATE story_arcs SET document = json_set(document, '$.keyEntities', json(?)), version = version + 1 WHERE id = ?").run(JSON.stringify([reference]),arc.id);
 const existing=await (await request('/api/story-arcs/'+arc.id)).json();assert.deepEqual(existing.keyEntities,[reference]);
 const updated=await save('/api/story-arcs/'+arc.id,'PUT',{...existing,summary:'Revised without losing its historical context.'});assert.deepEqual(updated.keyEntities,[reference]);
 const removed=await save('/api/story-arcs/'+arc.id,'PUT',{version:updated.version,keyEntities:[]});assert.deepEqual(removed.keyEntities,[]);
});
