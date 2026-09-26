import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {repository} from '../server/db.js';
import {createWorker} from '../server/app.js';
import {enhanceNovelAppearances} from '../server/novel-appearances.js';
import {novelRoute} from '../server/novel-routes.js';
import {blankCharacter} from '../public/characters/template.js';
import {blankLore} from '../public/lore/template.js';
import {blankStoryArc} from '../public/story-arcs/template.js';

const origin='https://novel.example';
function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const env={DB:d1Adapter(sqlite)},db=repository(env.DB),worker=createWorker({});
 const request=(path,owner='author')=>new Request(origin+path,{headers:{'oai-authenticated-user-id':owner}});
 const html=async(path,owner='author')=>{const req=request(path,owner),response=await worker.fetch(req,env);assert.equal(response.status,200,path+': '+await response.clone().text());return (await enhanceNovelAppearances(req,env,response)).text();};
 const novel=async(title,owner='author')=>db.createNovel(owner,crypto.randomUUID(),{title,synopsis:'',status:'drafting',coverUrl:'',seriesId:'',seriesOrder:0,hiddenFields:[]});
 const link=(book,targetKind,targetId,relationKind='appears_in',prose='',owner='author')=>db.createNovelAssociation(owner,crypto.randomUUID(),book.id,targetKind,targetId,relationKind,prose);
 return {db,env,worker,request,html,novel,link,sqlite};
}
const initial=(html,id)=>JSON.parse(html.match(new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`))[1]);

test('shared sample articles show independent novel prose without changing the main form document',async t=>{
 const {db,html,novel,link,sqlite,env}=setup(t),first=await novel('Book <one>'),second=await novel('Book two'),foreign=await novel('Private title','other');
 const document={...blankCharacter(),firstName:'Owner name',name:'Owner name',biography:'Shared biography',hiddenFields:['biography'],notes:[{id:crypto.randomUUID(),field:'biography',text:'A note',position:null}]};
 await db.save('author','claude',0,document);
 await db.save('other','claude',0,{...blankCharacter(),firstName:'Other name',name:'Other name'});
 const one=await link(first,'character','claude','appears_in','First <script> details\nSecond line'),two=await link(second,'character','claude','linked','Second book planning');
 await link(foreign,'character','claude','appears_in','Private prose','other');
 const rendered=await html('/characters/claude/');
 assert.match(rendered,new RegExp(`id="appearance-${first.id}"`));assert.match(rendered,new RegExp(`id="appearance-${second.id}"`));
 assert.match(rendered,/First &lt;script&gt; details/);assert.match(rendered,/Second book planning/);
 assert.match(rendered,/Book &lt;one&gt;/);assert.doesNotMatch(rendered,/Private title|Private prose|Other name/);
 assert.match(rendered,/data-collapse-target="novel-appearances-body"/);assert.match(rendered,/data-collapse-target="linked-novel-information"/);
 assert.deepEqual(initial(rendered,'profile-data').character.notes,document.notes);
 assert.equal(initial(rendered,'profile-data').character.biography,'Shared biography');
 assert.equal(initial(rendered,'novel-appearances-data').target.label,'Owner name');
 const mainForm=rendered.slice(rendered.indexOf('<form id="profile-form"'),rendered.indexOf('</form>')+7);
 assert.match(mainForm,/data-novel-appearances/);assert.doesNotMatch(mainForm,/id="appearance-prose"|id="novel-appearance-form"/);
 assert.ok(rendered.indexOf('id="novel-appearance-dialog"')>rendered.indexOf('</form>'));
 const before=sqlite.prepare('SELECT document,version FROM character_drafts WHERE owner_id = ?').get('author');
 const response=await novelRoute(new Request(origin+'/api/novels/'+first.id+'/associations/'+one.id,{method:'PUT',headers:{'oai-authenticated-user-id':'author',origin,'content-type':'application/json'},body:JSON.stringify({version:one.version,prose:'Revised first book'})}),env);
 assert.equal(response.status,200);assert.equal((await db.getNovelAssociation('author',two.id)).prose,'Second book planning');
 assert.deepEqual(sqlite.prepare('SELECT document,version FROM character_drafts WHERE owner_id = ?').get('author'),before);
 assert.equal((await db.getNovel('author',first.id)).version,first.version);
});

test('appearance enhancement covers all canonical shared profile adapters and the React note pilot',async t=>{
 const {db,html,novel,link}=setup(t),book=await novel('Linked manuscript');
 const loreId=crypto.randomUUID(),arcId=crypto.randomUUID(),noteId=crypto.randomUUID();
 await db.createLore('author',loreId,{...blankLore('book'),name:'In-world book'});
 await db.createLore('author',noteId,{...blankLore('note'),name:'Research note',body:'Original research'});
 await db.createStoryArc('author',arcId,{...blankStoryArc(),name:'Storyline'});
 for(const [path,kind,id] of [['/factions/sample-ember/','faction','sample-ember'],['/locations/countries/sample-kingdom/','location','sample-kingdom'],['/locations/cities/sample-capital/','location','sample-capital'],['/locations/landmarks/sample-royal-archive/','location','sample-royal-archive'],['/lore/'+loreId+'/','lore',loreId],['/story-arcs/'+arcId+'/','story_arc',arcId],['/lore/'+noteId+'/','lore',noteId]]){
  await link(book,kind,id,kind==='lore'?'referenced_by':'appears_in','Scoped detail');
  const rendered=await html(path);assert.match(rendered,/id="novel-appearances-data"/);assert.match(rendered,new RegExp(`id="appearance-${book.id}"`));
  assert.match(rendered,/novels\/appearances\.js/);assert.match(rendered,/data-appearance-infobox/);
  if(kind==='lore')assert.match(rendered,/Referenced by/);
  if(id===noteId){assert.match(rendered,/id="lore-profile-root"/);assert.match(rendered,/id="novel-appearances-template"/);assert.match(rendered,/<details class="appearance-native-disclosure" open>/);assert.equal(initial(rendered,'profile-data').record.body,'Original research');}
 }
});

test('appearance enhancer is idempotent and does not touch unrelated, failed, or unauthenticated responses',async t=>{
 const {env,request,worker}=setup(t),req=request('/characters/claude/');
 const first=await enhanceNovelAppearances(req,env,await worker.fetch(req,env));
 const second=await enhanceNovelAppearances(req,env,first);assert.equal(second,first);
 for(const [url,method,status,type] of [['/novels/','GET',200,'text/html'],['/characters/claude/','HEAD',200,'text/html'],['/characters/claude/','GET',404,'text/html'],['/api/characters/claude','GET',200,'application/json']]){
  const response=new Response('Unchanged',{status,headers:{'content-type':type}});
  const result=await enhanceNovelAppearances(new Request(origin+url,{method,headers:{'oai-authenticated-user-id':'author'}}),{},response);assert.equal(result,response);
 }
 const response=new Response('<html></html>',{headers:{'content-type':'text/html'}});
 assert.equal(await enhanceNovelAppearances(new Request(origin+'/characters/claude/'),{},response),response);
});
