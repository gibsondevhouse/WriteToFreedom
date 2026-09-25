import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {arcBeats,pacingMetrics,storyArcFields,storyArcHref} from '../public/story-arcs/template.js';
import {searchCatalog} from '../public/dashboard/search.js';

const origin='https://novel.example';
function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(sqlite)};
 const request=(path,method='GET',body,owner='author-a',source=origin)=>worker.fetch(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(body===undefined?{}:{origin:source,'content-type':'application/json'})},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}),env);
 return {request};
}
async function create(request){const response=await request('/api/story-arcs','POST',{id:crypto.randomUUID()});assert.equal(response.status,201,await response.clone().text());return response.json();}

test('story arcs use the shared directory and profile shell and persist narrative structure',async t=>{
 const {request}=setup(t);let response=await request('/story-arcs/');assert.equal(response.status,200);let html=await response.text();assert.ok(html.includes('data-directory-shell'));assert.ok(html.includes('id="new-story-arc"'));assert.ok(html.includes('aria-label="Workspace sidebar"'));
 let arc=await create(request);assert.equal(arc.version,1);for(const key of storyArcFields)assert.equal(typeof arc[key],'string');
 const page=storyArcHref(arc);response=await request(page);assert.equal(response.status,200);html=await response.text();assert.equal(html.split('id="edit-name"').length-1,1);for(const key of storyArcFields)assert.equal(html.split(`name="${key}"`).length-1,1,key);assert.ok(html.includes('Pacing timeline'));assert.ok(html.includes('data-pacing-beat="climax"'));assert.ok(html.includes('id="arc-entity-picker"'));assert.ok(html.includes('id="key-scene-list"'));
 for(const beat of arcBeats){const section=html.match(new RegExp(`<section id="${beat.id}"[\\s\\S]*?<\\/section>`))?.[0]||'';assert.ok(section.includes(`data-pacing-beat="${beat.id}"`),`${beat.id} owns its pacing controls`);assert.equal((section.match(/class="pacing-beat"/g)||[]).length,1,`${beat.id} has one pacing row`);assert.equal((section.match(/<textarea /g)||[]).length,3,`${beat.id} asks three planning questions`);assert.equal(section.includes(`<label for="field-${beat.id}">${beat.title}</label>`),false,`${beat.id} does not repeat its heading as a field label`);}
 const graphSection=html.match(/<section id="pacing"[\s\S]*?<\/section>/)?.[0]||'';assert.equal(graphSection.includes('class="pacing-beat"'),false,'overview graph does not duplicate beat controls');
 assert.ok(html.includes('id="sticky-pacing"'));assert.equal((html.match(/data-graph-line="tension"/g)||[]).length,2,'main and sticky graphs are both rendered');assert.ok(html.includes('class="metric-tension" style="--pacing-value:18%"'));
 const second=await create(request),pacing=structuredClone(arc.pacing);pacing.climax={tension:99,pace:91,action:87};
 const saved={...arc,name:'The Broken Accord',arcType:'Main Plot',status:'Drafting',startDate:'1607 BCE',endDate:'1601 BCE',logline:'A treaty vanishes before the coronation.',summary:'Claude follows the fracture through the archive.',climax:'The false accord is read aloud.',climaxCost:'Claude sacrifices their neutrality.',resolution:'The kingdom accepts the cost.',resolutionCarryForward:'A second treaty remains missing.',externalStakes:'The kingdom may divide.',internalStakes:'Claude must abandon neutrality.',philosophicalStakes:'Truth competes with peace.',pacing,keyEntities:[{kind:'character',id:'claude'},{kind:'faction',id:'sample-ember'},{kind:'location',id:'sample-kingdom'}],connectedArcIds:[second.id],keyScenes:[{title:'The empty case',chapter:'Chapter 3',beat:'incitingIncident',summary:'The treaty disappears.'}]};
 response=await request('/api/story-arcs/'+arc.id,'PUT',saved);assert.equal(response.status,200,await response.clone().text());arc=await response.json();assert.equal(arc.version,2);assert.equal(arc.pacing.climax.tension,99);assert.equal(arc.keyEntities.length,3);assert.equal(arc.keyScenes[0].chapter,'Chapter 3');
 assert.deepEqual(await (await request('/api/story-arcs/'+arc.id)).json(),arc);assert.equal(arc.climaxCost,'Claude sacrifices their neutrality.');assert.equal(arc.resolutionCarryForward,'A second treaty remains missing.');html=await (await request(page)).text();assert.ok(html.includes('The Broken Accord'));assert.ok(html.includes('Claude'));assert.ok(html.includes('The Fractured Kingdom'));assert.ok(html.includes(second.id));
 const timeline=await (await request('/api/timeline')).json();assert.deepEqual(timeline.events.filter(event=>event.entityId==='storyArc:'+arc.id).map(event=>event.kind),['arcStart','arcEnd']);
 const dashboard=await (await request('/api/dashboard')).json();assert.ok(searchCatalog(dashboard,'Broken Accord').some(record=>record.id===arc.id));assert.ok(dashboard.questions.some(question=>question.id===arc.id)===false);
});

test('story arc saves enforce owner scope, references, pacing, conflicts, and request boundaries',async t=>{
 const {request}=setup(t),arc=await create(request),url='/api/story-arcs/'+arc.id;
 assert.equal((await request(url,'GET',undefined,'author-b')).status,404);assert.equal((await request(storyArcHref(arc),'GET',undefined,null)).status,401);
 const base={...arc,name:'Private arc'};
 for(const bad of [{arcType:'Unknown'},{status:'Paused'},{keyEntities:[{kind:'character',id:'missing'}]},{connectedArcIds:[arc.id]},{keyScenes:[{title:'',chapter:'',beat:'',summary:''}]},{pacing:{}}])assert.equal((await request(url,'PUT',{...base,...bad})).status,400,JSON.stringify(bad));
 const broken=structuredClone(base);broken.pacing[arcBeats[0].id][pacingMetrics[0][0]]=100;assert.equal((await request(url,'PUT',broken)).status,400);
 let response=await request(url,'PUT',base);assert.equal(response.status,200);const saved=await response.json();assert.equal((await request(url,'PUT',base)).status,409);assert.equal((await request(url,'PUT',saved,'author-a','https://evil.example')).status,403);assert.equal((await request(url,'DELETE')).status,405);assert.equal((await request('/api/story-arcs','GET',undefined,null)).status,401);
 assert.equal((await request(storyArcHref(saved),'HEAD')).status,200);assert.equal((await request(storyArcHref(saved).slice(0,-1)+'?view=1')).headers.get('location'),origin+storyArcHref(saved)+'?view=1');
});
