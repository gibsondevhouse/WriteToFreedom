import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {dashboardData} from '../server/dashboard-routes.js';
const origin='https://novel.example';
function setup(){
 const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({'/dashboard/index.html':{content:readFileSync('public/dashboard/index.html','utf8'),type:'text/html'}}),env={DB:d1Adapter(sqlite)};
 return async(path,method='GET',body,owner='author-a')=>worker.fetch(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(body===undefined?{}:{origin,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
}
test('dashboard requires identity, is read-only, and never invents story dates',async()=>{
 const request=setup();assert.equal((await request('/api/dashboard','GET',undefined,null)).status,401);assert.equal((await request('/api/dashboard','POST',{})).status,405);
 const response=await request('/api/dashboard');assert.equal(response.headers.get('cache-control'),'no-store');const data=await response.json();
 assert.equal(data.characters.length,4);assert.equal(data.factions.length,4);assert.equal(data.locations.length,5);assert.equal(data.questions.length,10);assert.deepEqual(data.timeline.events,[]);
 assert.equal((await request('/dashboard/')).status,200);assert.equal((await request('/dashboard')).status,308);
});
test('dashboard follows saved names, questions, factions and dates while keeping owners isolated',async()=>{
 const request=setup();
 for(const [path,changes] of [
  ['/api/characters/claude',{firstName:'Shona',questions:'Who kept the letter?\nWhat happened next?',birthDate:'1990',factionId:'sample-lantern'}],
  ['/api/factions/sample-lantern',{name:'River House',motto:'A shared promise'}],
  ['/api/countries/sample-kingdom',{name:'Lakeside',questions:'Where is the border?'}],
  ['/api/cities/sample-capital',{name:'Port City',skylineUrl:'https://example.com/port.jpg',settled:'14 Harvest, 112'}]
 ]){const current=await(await request(path)).json();assert.equal((await request(path,'PUT',{...current,...changes})).status,200);}
 const data=await(await request('/api/dashboard')).json();
 assert.equal(data.characters[0].name,'Shona');assert.equal(data.characters[0].affiliation,'River House');
 const question=data.questions.find(r=>r.id==='claude');assert.equal(question.question,'Who kept the letter?');assert.equal(question.questionCount,2);assert.equal(question.href,'/characters/claude/#field-questions');
 assert.equal(data.factions.find(r=>r.id==='sample-lantern').members,2);assert.equal(data.factions.find(r=>r.id==='sample-ember').members,0);
 const city=data.locations.find(r=>r.id==='sample-capital');assert.equal(city.name,'Port City');assert.equal(city.parent,'Lakeside');assert.equal(city.image,'https://example.com/port.jpg');
 assert.equal(data.locations.find(r=>r.id==='sample-royal-archive').parent,'Lakeside / Port City');
 assert.equal(data.timeline.events[0].rawDate,'1990');assert.equal(data.timeline.unplaced[0].rawDate,'14 Harvest, 112');
 const other=await(await request('/api/dashboard','GET',undefined,'author-b')).json();assert.equal(other.characters[0].name,'Claude');assert.equal(other.timeline.events.length,0);assert.equal(other.locations[0].name,'The Fractured Kingdom');
 const current=await(await request('/api/characters/claude')).json();await request('/api/characters/claude','PUT',{...current,hiddenFields:['questions']});
 const hidden=await(await request('/api/dashboard')).json();assert.equal(hidden.questions.find(r=>r.id==='claude').question,'Who kept the letter?');assert.equal(hidden.questions.find(r=>r.id==='claude').href,'/characters/claude/');
});
test('nested location cards use full ancestry and link to existing editors without fabricated profile content',()=>{
 const locations=[{id:'us',name:'United States',type:'country',parentId:null},{id:'nyc',name:'New York City',type:'city',parentId:'us'},{id:'manhattan',name:'Manhattan',type:'area',parentId:'nyc',areaType:'Borough'},{id:'harlem',name:'Harlem',type:'area',parentId:'manhattan',areaType:'Neighborhood'},{id:'rucker',name:'Rucker Park',type:'landmark',parentId:'harlem'}];
 const data=dashboardData({characters:[],factions:[],locations,countries:[],cities:[]}),park=data.locations.at(-1);
 assert.equal(park.parent,'United States / New York City / Manhattan / Harlem');assert.equal(park.href,'/locations/#location-rucker');assert.equal(park.summary,undefined);
 assert.ok(data.questions.every(r=>r.kind==='character'));assert.ok(!data.locations.some(r=>r.image));
});
