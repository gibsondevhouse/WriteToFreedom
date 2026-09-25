import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {loreTypes,loreTemplates,primaryCollection,loreHref} from '../public/lore/template.js';
import {searchCatalog} from '../public/dashboard/search.js';
import {ratingGroupsFor} from '../public/profiles/ratings.js';

const origin='https://novel.example';
function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(sqlite)};
 const request=(path,method='GET',body,owner='author',headers={})=>worker.fetch(new Request(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),origin,'content-type':'application/json',...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}),env);
 const get=async path=>{const r=await request(path);assert.equal(r.status,200);return r.json();};
 const create=async(type,extra={})=>{const r=await request('/api/lore','POST',{id:crypto.randomUUID(),type,name:'Test '+type,...extra});assert.equal(r.status,201,await r.clone().text());return r.json();};
 return {request,get,create,sqlite};
}

for(const type of Object.keys(loreTypes))test(`${type}: standalone lore template saves, reopens and stays private`,async t=>{
 const {request,get,create}=setup(t),record=await create(type),url='/api/lore/'+record.id,page=loreHref(record),template=loreTemplates[type];
 assert.deepEqual(record.collections,[primaryCollection[type]]);assert.equal(record.version,1);
 assert.deepEqual(record.profileRatings,{});
 for(const key of template.fields)assert.equal(typeof record[key],'string');
 let html=await (await request(page)).text();for(const key of template.fields)assert.equal(html.split(`name="${key}"`).length-1,1,key);
 assert.equal(html.split('id="ratings"').length-1,1);assert.equal(html.split('data-profile-ratings=').length-1,new Set(ratingGroupsFor('lore',type).map(group=>group.sectionId)).size);
 assert.ok(html.includes('data-app-shell'));assert.ok(html.includes('/lore/'));assert.ok(html.includes('What is true'));assert.ok(html.includes('What people believe'));
 const ratingKey=ratingGroupsFor('lore',type)[0].fields[0][0];
 const changed={...record,truth:'The stone transfers illness.',beliefs:'Everyone calls it a healing stone.',knowledge:'Only Claude knows.',history:'Before </textarea><script>escape</script>',questions:'Who made it?\nWhat was the cost?',hiddenFields:['truth'],profileRatings:{[ratingKey]:61},originDate:'1200 BCE',pinned:true,featured:true,imageUrl:'https://example.com/entry.png'};
 for(const key of template.fields)if(key!=='name'&&!changed[key])changed[key]='Details for '+key;
 let r=await request(url,'PUT',changed);assert.equal(r.status,200);let saved=await r.json();assert.equal(saved.version,2);
 const reopened=await get(url);assert.deepEqual(reopened,saved);assert.notEqual(saved.truth,saved.beliefs);
 assert.deepEqual(reopened.profileRatings,{[ratingKey]:61});
 html=await (await request(page)).text();assert.ok(html.includes('data-profile-field="truth" hidden'));assert.ok(html.includes('&lt;/textarea&gt;&lt;script&gt;escape&lt;/script&gt;'));
 assert.equal((await request(url,'PUT',changed)).status,409);assert.equal((await request(url,'GET',undefined,'other')).status,404);assert.equal((await request(page,'GET',undefined,'other')).status,404);
 const partial=await request(url,'PUT',{version:saved.version,summary:'Updated summary'});assert.equal(partial.status,200);saved=await partial.json();assert.equal(saved.truth,changed.truth);assert.deepEqual(saved.hiddenFields,['truth']);assert.equal(saved.pinned,true);assert.deepEqual(saved.profileRatings,{[ratingKey]:61});
 const dashboard=await get('/api/dashboard');assert.ok(searchCatalog(dashboard,'Updated summary').some(r=>r.id===record.id));assert.ok(dashboard.characters.find(c=>c.id==='claude').mentions.some(m=>m.href===page+'#field-knowledge'));
 const lore=await get('/api/lore');assert.equal(lore.entries.length,1);assert.equal(lore.entries[0].featured,true);assert.equal(lore.questions[0].questionCount,2);
 const timeline=await get('/api/timeline');assert.equal(timeline.events.filter(e=>e.entityId==='lore:'+record.id).length,1);assert.equal(timeline.events.find(e=>e.entityId==='lore:'+record.id).href,page+'#field-originDate');
 assert.equal((await request(page,'HEAD')).status,200);assert.equal(await (await request(page,'HEAD')).text(),'');assert.equal((await request(page.slice(0,-1)+'?a=1')).headers.get('location'),origin+page+'?a=1');
 for(const bad of [{type:type==='note'?'species':'note'},{name:' '},{imageUrl:'javascript:alert(1)'},{history:42},{hiddenFields:['name']},{collections:null},{featured:'true'},{version:0}])assert.equal((await request(url,'PUT',{...saved,...bad})).status,400,JSON.stringify(bad));
 for(const profileRatings of [{[ratingKey]:100},{[ratingKey]:-1},{unknown:40},[]])assert.equal((await request(url,'PUT',{...saved,profileRatings})).status,400);
});

test('overlapping object collections share one identity, chronology and search result',async t=>{
 const {request,create,get}=setup(t),record=await create('book',{name:'The Jeweled Testament',collections:['books','relics','artifacts','jewels'],summary:'A jeweled book',originDate:'1500',questions:'Who altered the last page?'});
 const data=await get('/api/lore');assert.equal(data.entries.length,1);assert.deepEqual(data.entries[0].collections,['books','relics','artifacts','jewels']);assert.equal(data.questions.length,1);
 assert.equal((await get('/api/timeline')).events.filter(e=>e.entityId==='lore:'+record.id).length,1);
 assert.equal(searchCatalog(await get('/api/dashboard'),'jeweled').length,1);
 assert.equal((await request('/api/lore/'+record.id,'PUT',{...record,collections:['relics']})).status,400);
 assert.equal((await request('/api/lore/'+record.id,'PUT',{...record,collections:['books','species']})).status,400);
 const note=await create('note');assert.equal((await request('/api/lore/'+note.id,'PUT',{...note,collections:['notes','books']})).status,400);
});

test('connections produce private backlinks across lore, characters, factions and every place family',async t=>{
 const {request,create,get}=setup(t),species=await create('species',{name:'Moon moths'}),book=await create('book',{name:'Moth Atlas',connections:[
  {target:{kind:'lore',id:species.id},relationship:'describes'},
  {target:{kind:'character',id:'claude'},relationship:'owned by'},
  {target:{kind:'faction',id:'sample-ember'},relationship:'commissioned by'},
  ...['sample-kingdom','sample-capital','sample-royal-archive'].map(id=>({target:{kind:'location',id},relationship:'found in'}))
 ]});
 for(const path of [loreHref(species),'/characters/claude/','/factions/sample-ember/','/locations/countries/sample-kingdom/','/locations/cities/sample-capital/','/locations/landmarks/sample-royal-archive/']){
  const r=await request(path);assert.equal(r.status,200);assert.ok((await r.text()).includes('Moth Atlas'),path);
 }
 assert.ok(!(await (await request('/characters/claude/','GET',undefined,'other')).text()).includes('Moth Atlas'));
 const options=(await get('/api/characters/claude?view=connections')).options;assert.equal(options.filter(o=>o.ref.kind==='lore'&&o.ref.id===book.id).length,1);
 const character=await get('/api/characters/claude');let r=await request('/api/characters/claude','PUT',{...character,cardConnection:{kind:'lore',id:book.id}});assert.equal(r.status,200);
 assert.equal((await get('/api/characters?view=cards')).characters.find(c=>c.id==='claude').affiliationCard.name,'Moth Atlas');
 r=await request('/api/lore/'+book.id,'PUT',{...book,connections:[]});assert.equal(r.status,200);assert.ok(!(await (await request(loreHref(species))).text()).includes('<a href="'+loreHref(book)+'"'));
});

test('embedded notes keep their identity and content while linking to and from standalone lore',async t=>{
 const {request,create,get}=setup(t),record=await create('relic',{name:'The Oathstone'}),character=await get('/api/characters/claude');
 const note={id:crypto.randomUUID(),field:'arc',position:0,title:'An old oath',type:'lore',text:'The Oathstone holds an oath.',links:[{kind:'lore',id:record.id}]};
 const saved=await request('/api/characters/claude','PUT',{...character,arc:'[1]'+character.arc,notes:[note]});assert.equal(saved.status,200);const before=await get('/api/characters/claude');
 let data=await get('/api/lore');assert.equal(data.notes.length,1);assert.equal(data.notes[0].href,'/characters/claude/#note-'+note.id);assert.equal(data.notes[0].contextual,true);assert.ok(data.notes[0].collections.includes('notes'));
 assert.deepEqual(await get('/api/characters/claude'),before);
 assert.ok((await (await request(loreHref(record))).text()).includes('An old oath'));
 const r=await request('/api/lore/'+record.id,'PUT',{...record,connections:[{target:{kind:'note',id:note.id,characterId:'claude'},relationship:'explained in'}]});assert.equal(r.status,200);
 const html=await (await request('/characters/claude/')).text();assert.ok(html.includes('explained in'));assert.ok(html.includes('"kind":"lore"'));assert.ok(html.includes('"characterId":"claude"'));
 data=await (await request('/api/lore','GET',undefined,'other')).json();assert.deepEqual(data.entries,[]);assert.deepEqual(data.notes,[]);
});

test('lore writes validate links, owner scope, save conflicts and request boundaries',async t=>{
 const {request,create,get}=setup(t),record=await create('artifact'),url='/api/lore/'+record.id;
 const self={target:{kind:'lore',id:record.id},relationship:'self'},missing={target:{kind:'lore',id:crypto.randomUUID()},relationship:'unknown'};
 for(const connections of [[self],[missing],[{target:{kind:'character',id:'missing'},relationship:'unknown'}],[{target:{kind:'character',id:'claude'},relationship:''}]])assert.equal((await request(url,'PUT',{...record,connections})).status,400);
 const second=await create('jewel'),connection={target:{kind:'lore',id:second.id},relationship:'contains'};
 assert.equal((await request(url,'PUT',{...record,connections:[connection,connection]})).status,400);
 assert.equal((await request('/api/lore','POST',{id:crypto.randomUUID(),type:'book',name:'Other book',connections:[connection]},'other')).status,400);
 const concurrent=await Promise.all([request(url,'PUT',{...record,name:'First edit'}),request(url,'PUT',{...record,name:'Second edit'})]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 const saved=await get(url);assert.equal(saved.version,2);
 const retry=await request('/api/lore','POST',{id:record.id,type:'artifact',name:'Duplicate'});assert.equal(retry.status,201);assert.equal((await get('/api/lore')).entries.length,2);
 assert.equal((await request('/api/lore','POST',{id:record.id,type:'artifact',name:'Collision'},'other')).status,409);
 assert.equal((await request(url,'PUT',saved,'author',{origin:'https://evil.example'})).status,403);
 assert.equal((await request(url,'PUT',saved,'author',{'content-type':'text/plain'})).status,403);
 assert.equal((await request(url,'PUT','{')).status,400);assert.equal((await request(url,'PUT','x'.repeat(550001))).status,413);
 assert.equal((await request(url,'DELETE')).status,405);assert.equal((await request('/api/lore','GET',undefined,null)).status,401);
 assert.equal((await request(loreHref(record),'POST',{})).status,405);
 const shell=await (await request('/lore/')).text();assert.ok(shell.includes('aria-label="Lore"'));assert.ok(shell.includes('/dashboard/shell.css'));assert.ok(!shell.includes('<li>Lore</li>'));
});


test('quick-note text remains searchable beyond the card summary',async t=>{
 const {create,get}=setup(t),body='A long research note. '.repeat(30)+'The obsidian doorway leads to winter.';
 const record=await create('note',{name:'Research notes',summary:body.slice(0,180),body});
 const lore=await get('/api/lore');assert.ok(lore.entries[0].searchText.includes('obsidian doorway'));
 assert.equal(searchCatalog(await get('/api/dashboard'),'obsidian doorway')[0].id,record.id);
});
