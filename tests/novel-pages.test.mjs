import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {repository} from '../server/db.js';
import {writingRepository} from '../server/writing-repository.js';
import {novelPageRoute} from '../server/novel-pages.js';
import {workspaceShell} from '../server/workspace-shell.js';
import {blankCharacter} from '../public/characters/template.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';

const origin='https://novel.example';
const novelDocument=(title,extra={})=>({title,synopsis:'A manuscript synopsis.',status:'drafting',coverUrl:'',seriesId:'',seriesOrder:0,hiddenFields:[],...extra});
const seriesDocument=title=>({title,summary:'A connected story.',coverUrl:'',hiddenFields:[]});
function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const env={DB:d1Adapter(sqlite)},db=repository(env.DB),writing=writingRepository(env.DB);
 const request=(path,method='GET',owner='author')=>novelPageRoute(new Request(origin+path,{method,headers:owner?{'oai-authenticated-user-id':owner}:{}}),env);
 return {db,writing,request,sqlite};
}

test('novel and series directories reuse the searchable shell and remain reachable with an empty library',async t=>{
 const {request}=setup(t);
 for(const [path,id,label] of [['/novels/','novels-directory','My novels'],['/series/','series-directory','Series']]){
  const response=await request(path);assert.equal(response.status,200);
  const html=workspaceShell(await response.text(),path);
  assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/data-directory-search/);assert.match(html,/\/novels\/directory\.js/);
  assert.match(html,/href="\/novels\/" aria-label="My novels"/);
  assert.match(html,/href="\/series\/" aria-label="Series"/);
  assert.ok(html.includes(label));
 }
 const redirect=await request('/novels?novel=selected');assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),origin+'/novels/?novel=selected');
 assert.equal((await request('/novels/','POST')).status,405);
});

test('novel articles preserve the shared form and link only their chapters to the correct writing context',async t=>{
 const {db,writing,request}=setup(t),oneId=crypto.randomUUID(),twoId=crypto.randomUUID();
 await db.createNovel('author',oneId,novelDocument('First <novel>',{synopsis:'Saved hidden synopsis',hiddenFields:['synopsis']}));
 await db.createNovel('author',twoId,novelDocument('Other novel'));
 const one=await writing.createChapter('author',crypto.randomUUID(),{title:'Selected chapter',summary:'Its outline',novelId:oneId});
 await writing.createChapter('author',crypto.randomUUID(),{title:'Unrelated chapter',summary:'Elsewhere',novelId:twoId});
 const response=await request('/novels/'+oneId+'/');assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/First &lt;novel&gt;/);assert.match(html,/id="profile-form"/);assert.match(html,/id="identity"/);
 assert.equal((html.match(/name="title"/g)||[]).length,1);
 assert.match(html,/data-profile-field="synopsis" hidden/);assert.match(html,/Saved hidden synopsis/);
 assert.ok(html.includes('/scenes/?novel='+oneId+'&chapter='+one.id));
 assert.ok(html.includes('/chapters/?novel='+oneId+'&chapter='+one.id));
 assert.doesNotMatch(html,/Unrelated chapter/);
 assert.equal((await request('/novels/'+oneId+'/','GET','other')).status,404);
 assert.equal((await request('/novels/'+oneId+'/','GET',null)).status,401);
 const head=await request('/novels/'+oneId+'/','HEAD');assert.equal(head.status,200);assert.equal(await head.text(),'');
 const redirect=await request('/novels/'+oneId+'?novel='+oneId);assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),origin+'/novels/'+oneId+'/?novel='+oneId);
});

test('series articles order novels explicitly and derive shared articles once with current display labels',async t=>{
 const {db,request}=setup(t),seriesId=crypto.randomUUID(),firstId=crypto.randomUUID(),secondId=crypto.randomUUID(),characterId=crypto.randomUUID();
 await db.createSeries('author',seriesId,seriesDocument('Winter sequence'));
 await db.createNovel('author',firstId,novelDocument('Later volume',{seriesId,seriesOrder:2}));
 await db.createNovel('author',secondId,novelDocument('Opening volume',{seriesId,seriesOrder:1}));
 const character={...blankCharacter(),firstName:'Shared person',name:'Shared person'};
 await db.create('author',characterId,character);
 await db.createNovelAssociation('author',crypto.randomUUID(),firstId,'character',characterId,'appears_in','');
 await db.createNovelAssociation('author',crypto.randomUUID(),secondId,'character',characterId,'appears_in','');
 let response=await request('/series/'+seriesId+'/');assert.equal(response.status,200);let html=await response.text();
 assert.ok(html.indexOf('Opening volume')<html.indexOf('Later volume'));
 assert.equal((html.match(/>Shared person<\/a>/g)||[]).length,1);
 await db.save('author',characterId,1,{...character,firstName:'Renamed person',name:'Renamed person'});
 response=await request('/novels/'+firstId+'/');html=await response.text();assert.match(html,/>Renamed person<\/a>/);assert.doesNotMatch(html,/>Shared person<\/a>/);
 response=await request('/series/'+seriesId+'/');html=await response.text();assert.equal((html.match(/>Renamed person<\/a>/g)||[]).length,1);
});

test('series books with equal positions retain creation and identity order after renaming',async t=>{
 const {db,request,sqlite}=setup(t),seriesId=crypto.randomUUID();
 const firstId='11111111-1111-4111-8111-111111111111',secondId='22222222-2222-4222-8222-222222222222',lastId='33333333-3333-4333-8333-333333333333';
 await db.createSeries('author',seriesId,seriesDocument('Stable sequence'));
 const first=await db.createNovel('author',firstId,novelDocument('Zeta volume',{seriesId}));
 await db.createNovel('author',secondId,novelDocument('Alpha volume',{seriesId}));
 await db.createNovel('author',lastId,novelDocument('Earliest alphabetically',{seriesId}));
 sqlite.prepare('UPDATE novels SET created_at = ? WHERE id IN (?, ?)').run('2026-01-01T00:00:00.000Z',firstId,secondId);
 sqlite.prepare('UPDATE novels SET created_at = ? WHERE id = ?').run('2026-01-02T00:00:00.000Z',lastId);
 const order=html=>[...html.matchAll(/data-series-novel="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(order(await (await request('/series/'+seriesId+'/')).text()),[firstId,secondId,lastId]);
 await db.saveNovel('author',firstId,first.version,novelDocument('Renamed volume',{seriesId}));
 assert.deepEqual(order(await (await request('/series/'+seriesId+'/')).text()),[firstId,secondId,lastId]);
});
