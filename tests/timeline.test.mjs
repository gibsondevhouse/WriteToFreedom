import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {parseStoryDate,collectTimeline,filterEvents,timelineRows,zoomAt,fitView,rulerTicks,yearLabel,minScale,maxScale} from '../public/timeline/model.js';
const origin='https://novel.example';
function setup(){
 const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({'/timeline/index.html':{content:readFileSync('public/timeline/index.html','utf8'),type:'text/html'}}),env={DB:d1Adapter(sqlite)};
 return async(path,method='GET',body,owner='author-a')=>worker.fetch(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(body===undefined?{}:{origin,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
}
test('timeline parses explicit date precision, leap years, approximations and BCE without guessing',()=>{
 const year=parseStoryDate('1984');assert.equal(year.precision,'year');assert.equal(year.month,null);assert.equal(year.position,1984.5);
 const month=parseStoryDate('1984-02');assert.equal(month.precision,'month');assert.equal(month.day,null);
 for(const text of ['1984-02-29','29 February 1984','Feb 29, 1984']){const date=parseStoryDate(text);assert.equal(date.year,1984);assert.equal(date.month,2);assert.equal(date.day,29);}
 assert.equal(parseStoryDate('c. 44 BCE').year,-43);assert.equal(parseStoryDate('circa 44 BC').approximate,true);assert.equal(yearLabel(-43),'44 BCE');assert.equal(yearLabel(0),'1 BCE');
 assert.equal(parseStoryDate('12 May 84').year,84);assert.equal(parseStoryDate('May 12 BCE').year,-11);assert.equal(parseStoryDate('Year 120').position,120.5);assert.equal(parseStoryDate('2000-02-29').day,29);
 for(const text of ['1900-02-29','1984-02-30','1984-00-12','1984-13-01','1984-01-00','0 BCE','-44 BCE','03/04/05','14 Harvest, 112','late 1700s','May 12','Jan 1','1880–1890','April 31, 1984','',null,'999999999'])assert.equal(parseStoryDate(text),null,String(text));
});
test('seed timeline stays empty, owner identity is required and endpoint is read-only',async()=>{
 const req=setup(),response=await req('/api/timeline');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const data=await response.json();assert.deepEqual(data.events,[]);assert.deepEqual(data.unplaced,[]);assert.equal(data.undated,13);
 assert.equal((await req('/api/timeline','GET',undefined,null)).status,401);assert.equal((await req('/api/timeline','POST',{})).status,405);
 assert.equal((await req('/timeline/')).status,200);assert.equal((await req('/timeline')).status,308);
});
test('timeline derives saved dates from every profile, keeps owner isolation and follows edits without duplicate events',async()=>{
 const req=setup();
 for(const [path,changes] of [
  ['/api/characters/claude',{firstName:'Claudette',birthDate:'1910-04-12',deathDate:'1990',hiddenFields:['biography']}],
  ['/api/factions/sample-ember',{founded:'1880'}],
  ['/api/countries/sample-kingdom',{founded:'1780',population:'10 million',populationDate:'2000'}],
  ['/api/cities/sample-capital',{settled:'1750',incorporated:'1800',population:'1 million',populationDate:'2000'}]
 ]){const current=await (await req(path)).json();assert.equal((await req(path,'PUT',{...current,...changes})).status,200);}
 let data=await (await req('/api/timeline')).json();assert.equal(data.events.length,8);assert.equal(data.events[0].rawDate,'1750');
 const born=data.events.find(e=>e.field==='birthDate');assert.equal(born.id,'character:claude:birthDate');assert.equal(born.name,'Claudette');assert.equal(born.href,'/characters/claude/#field-birthDate');assert.equal(born.date.precision,'day');
 assert.equal(data.events.filter(e=>e.kind==='population').length,2);assert.equal(new Set(data.events.map(e=>e.id)).size,8);
 assert.equal((await (await req('/api/timeline','GET',undefined,'author-b')).json()).events.length,0);
 let current=await (await req('/api/characters/claude')).json();await req('/api/characters/claude','PUT',{...current,birthDate:'1920',deathDate:''});
 data=await (await req('/api/timeline')).json();assert.equal(data.events.length,7);assert.equal(data.events.find(e=>e.id===born.id).rawDate,'1920');assert.ok(!data.events.some(e=>e.field==='deathDate'));
});
test('unplaceable dates are retained with source links and administrative timestamps never become events',()=>{
 const data=collectTimeline({character:[{id:'a',name:'A',birthDate:'14 Harvest, 112',createdAt:'2026-01-01',age:'25'}],faction:[{id:'f',name:'F',founded:'1800',updatedAt:'2026-01-01'}],country:[{id:'c',name:'C',populationDate:'2000',population:''}],city:[]});
 assert.equal(data.events.length,1);assert.equal(data.unplaced.length,1);assert.equal(data.unplaced[0].rawDate,'14 Harvest, 112');assert.equal(data.unplaced[0].href,'/characters/a/#field-birthDate');assert.equal(data.undated,1);
});
test('filters and row grouping retain every same-date event and honor combined search terms',()=>{
 const data=collectTimeline({character:[{id:'a',name:'Anne-Marie',birthDate:'1900',deathDate:'1900'},{id:'b',name:'Beatrice',birthDate:'1900'}],faction:[{id:'f',name:'River Guild',founded:'1900'}],country:[],city:[]});
 assert.equal(data.events.length,4);const rows=timelineRows(data.events);assert.equal(rows.length,3);assert.equal(rows[0].events.length,2);
 assert.equal(filterEvents(data.events,{types:['character'],kinds:['birth']}).length,2);assert.equal(filterEvents(data.events,{query:'river 1900'}).length,1);assert.equal(filterEvents(data.events,{types:[]}).length,0);
});
test('zoom keeps the pointer date fixed at every scale and rulers stay bounded across extreme spans',()=>{
 const view={start:-100,scale:120,y:10},pixel=720,date=view.start+pixel/view.scale;
 for(const factor of [1.5,.25,1e20,1e-20]){const next=zoomAt(view,factor,pixel);assert.ok(Math.abs(next.start+pixel/next.scale-date)<1e-6);assert.ok(next.scale>=minScale&&next.scale<=maxScale);assert.equal(next.y,10);}
 for(const scale of [minScale,.1,1,24,120,1200,3000,maxScale]){const ticks=rulerTicks(-40.5,1222,scale);assert.ok(ticks.length>0);assert.ok(ticks.length<100);for(let i=1;i<ticks.length;i++)assert.ok(ticks[i].value>ticks[i-1].value);}
 const events=[{date:{position:1800}},{date:{position:2000}}],fit=fitView(events,1222);assert.ok((1800-fit.start)*fit.scale>=50-1e-6);assert.ok((2000-fit.start)*fit.scale<=1172+1e-6);
 const single=fitView([{date:{position:1876.5}}],320);assert.ok(Math.abs((1876.5-single.start)*single.scale-160)<1e-6,'a single event stays centered');
});
