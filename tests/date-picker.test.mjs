import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseStoryDate,formatStoryDate,calendarCells,weekday,shiftMonth} from '../public/profiles/dates.js';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
const origin='https://novel.example';
function setup(){const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));const worker=createWorker({}),env={DB:d1Adapter(sqlite)};return async(path,method='GET',body)=>worker.fetch(new Request(origin+path,{method,headers:{'oai-authenticated-user-id':'author-a',...(body===undefined?{}:{origin,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);}
test('calendar weekday and month grids handle Gregorian boundaries, BCE and years below 100',()=>{
 for(const [year,month,day] of [[2024,2,29],[2000,1,1],[1900,3,1],[1,1,1],[99,12,31],[0,12,31],[-43,3,15]]){const reference=new Date(0);reference.setUTCFullYear(year,month-1,day);reference.setUTCHours(0,0,0,0);assert.equal(weekday(year,month,day),reference.getUTCDay());}
 assert.equal(weekday(2026,6,16),2);assert.deepEqual(shiftMonth(0,12,1),{year:1,month:1});assert.deepEqual(shiftMonth(1,1,-1),{year:0,month:12});
 for(const year of [-999999,-43,0,1,99,1900,2024,999999])for(const month of [1,2,12]){const cells=calendarCells(year,month);assert.equal(cells.length,42);assert.equal(weekday(cells[0].year,cells[0].month,cells[0].day),0);for(let i=0;i<42;i++)assert.equal(weekday(cells[i].year,cells[i].month,cells[i].day),i%7);}
 assert.equal(calendarCells(2024,2).filter(c=>!c.outside).length,29);assert.equal(calendarCells(1900,2).filter(c=>!c.outside).length,28);
});
test('picker precision round-trips without fabricating month/day for broader periods',()=>{
 for(const year of [-999999,-43,0,1,99,2024,999999])for(const precision of ['day','month','quarter','half-year','year']){
  const text=formatStoryDate({year,month:5,day:12,quarter:2,half:1,precision,approximate:true}),date=parseStoryDate(text);assert.equal(date.year,year);assert.equal(date.precision,precision);assert.equal(date.approximate,true);
  if(['quarter','half-year','year'].includes(precision)){assert.equal(date.month,null);assert.equal(date.day,null);}else if(precision==='month')assert.equal(date.day,null);
 }
 const leap=parseStoryDate('2024-Q1'),normal=parseStoryDate('2023-Q1');assert.ok(Math.abs(leap.end-leap.start-91/366)<1e-10);assert.ok(Math.abs(normal.end-normal.start-90/365)<1e-10);
 assert.equal(leap.position,(leap.start+leap.end)/2);assert.equal(parseStoryDate('2024-Q4').end,2025);assert.equal(parseStoryDate('2024-H2').end,2025);assert.equal(parseStoryDate('2024-12').end,2025);
 assert.equal(parseStoryDate('0001-Q4 BCE').end,1);assert.equal(parseStoryDate('Q2 44 BCE').year,-43);assert.equal(parseStoryDate('H1 2024').precision,'half-year');
 for(const text of ['2024-Q0','2024-Q5','2024-H0','2024-H3','2024-Q1-02','0 BCE','-44 BCE','May 12','1000000 CE','1000001 BCE'])assert.equal(parseStoryDate(text),null,text);
 assert.throws(()=>formatStoryDate({year:2023,month:2,day:29}));
});
test('all profile date fields use the same selectable control and period strings persist to timeline',async()=>{
 const req=setup();for(const [api,page,keys] of [
  ['/api/characters/claude','/characters/claude/',['birthDate','deathDate']],
  ['/api/factions/sample-ember','/factions/sample-ember/',['founded']],
  ['/api/countries/sample-kingdom','/locations/countries/sample-kingdom/',['founded','populationDate']],
  ['/api/cities/sample-capital','/locations/cities/sample-capital/',['settled','incorporated','populationDate']]
 ]){
  const html=await (await req(page)).text();for(const key of keys){assert.match(html,new RegExp(`id="field-${key}" name="${key}"[^>]+data-date-input readonly aria-haspopup="dialog"`));assert.equal(html.split(`name="${key}"`).length-1,1);}
  let current=await (await req(api)).json();for(const value of ['2024-02-29','2024-02','2024-Q1','2024-H2','0044-Q2 BCE','c. 44 BCE','14 Harvest, 112']){const response=await req(api,'PUT',{...current,[keys[0]]:value});assert.equal(response.status,200);current=await response.json();assert.equal(current[keys[0]],value);const events=await (await req('/api/timeline')).json();const entry=[...events.events,...events.unplaced].find(e=>e.field===keys[0]&&e.href.startsWith(page));assert.equal(entry.rawDate,value);if(value.includes('Harvest'))assert.ok(!entry.date);else assert.equal(entry.date.precision,parseStoryDate(value).precision);}
 }
});
