import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {repository} from '../server/db.js';
import {writingRepository} from '../server/writing-repository.js';
import {chapterPageRoute} from '../server/chapter-pages.js';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';

const origin='https://chapters.example';
const text=value=>({type:'text',text:value});
const paragraph=value=>({type:'paragraph',content:[text(value)]});
const document=value=>({type:'doc',content:[paragraph(value)]});
function setup(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const env={DB:d1Adapter(sqlite)},db=repository(env.DB),writing=writingRepository(env.DB),worker=createWorker({});
 const makeRequest=(path,method='GET',owner='author')=>new Request(origin+path,{method,headers:owner?{'oai-authenticated-user-id':owner}:{}});
 const request=(path,method='GET',owner='author')=>chapterPageRoute(makeRequest(path,method,owner),env);
 const fullRequest=(path,method='GET',owner='author')=>worker.fetch(makeRequest(path,method,owner),env);
 const novel=(title='Parent novel',owner='author',extra={})=>db.createNovel(owner,crypto.randomUUID(),{title,synopsis:'',status:'drafting',seriesId:'',seriesOrder:0,coverUrl:'',hiddenFields:[],...extra});
 const chapter=(novelId,title='Opening chapter',extra={},owner='author')=>writing.createChapter(owner,crypto.randomUUID(),{novelId,title,summary:'A chapter outline.',...extra});
 const scene=(chapterId,title='First scene',extra={},owner='author')=>writing.createScene(owner,crypto.randomUUID(),{chapterId,title,summary:'A scene outline.',status:'draft',contentSchemaVersion:1,content:document('Saved scene prose.'),...extra});
 return {sqlite,env,db,writing,request,fullRequest,novel,chapter,scene};
}

test('chapter profile routes canonicalize URLs, support HEAD, and enforce owner and parent context',async t=>{
 const {request,fullRequest,novel,chapter}=setup(t),parent=await novel(),other=await novel('Another novel'),entry=await chapter(parent.id),foreign=await novel('Private novel','other');
 const path='/chapters/'+entry.id+'/';
 for(const route of [request,fullRequest]){
  const response=await route(path+'?novel='+parent.id);assert.equal(response.status,200,await response.clone().text());
  assert.match(response.headers.get('content-type'),/text\/html/);assert.equal(response.headers.get('cache-control'),'no-store');
  const head=await route(path,'HEAD');assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await route(path,'GET',null)).status,401);
  assert.equal((await route(path,'GET','other')).status,404);
  for(const context of [other.id,foreign.id,crypto.randomUUID(),'bad',''])assert.equal((await route(path+'?novel='+context)).status,404,context);
  assert.equal((await route('/chapters/'+crypto.randomUUID()+'/')).status,404);
  assert.equal((await route(path,'POST')).status,405);
  const redirect=await route('/chapters/'+entry.id+'?novel='+parent.id);assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),origin+path+'?novel='+parent.id);
 }
});

test('chapter profile assets bypass the private article route and remain executable and styled',async t=>{
 const {env}=setup(t);
 const assets={
  '/chapters/profile.js':{content:'export const chapterEditor = true;',type:'text/javascript; charset=utf-8'},
  '/chapters/profile.css':{content:'.chapter-scene-prose { line-height: 1.85; }',type:'text/css; charset=utf-8'},
 };
 const worker=createWorker(assets);
 for(const [path,asset] of Object.entries(assets)){
  // Assets must remain public; authentication is enforced on the article and API.
  const response=await worker.fetch(new Request(origin+path),env);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),asset.type);assert.equal(await response.text(),asset.content);
  const head=await worker.fetch(new Request(origin+path,{method:'HEAD'}),env);
  assert.equal(head.status,200);assert.equal(await head.text(),'');
 }
});

test('chapter profiles use a wrapping title and owned inline scene records without unrelated writing',async t=>{
 const {request,fullRequest,novel,chapter,scene,sqlite}=setup(t),parent=await novel('A <novel>'),other=await novel('Unrelated novel');
 await chapter(other.id,'Elsewhere chapter');const preceding=await chapter(parent.id,'Preceding chapter');
 const entry=await chapter(parent.id,'The <opening>',{summary:'Outline <script> & safe text'}),selected=await scene(entry.id,'Scene <one>',{summary:'Summary <b> & safe text'});
 sqlite.prepare('UPDATE chapters SET created_at = ? WHERE id = ?').run('2026-01-01T00:00:00.000Z',preceding.id);
 sqlite.prepare('UPDATE chapters SET created_at = ? WHERE id = ?').run('2026-01-02T00:00:00.000Z',entry.id);
 const unrelatedChapter=await chapter(other.id,'Hidden chapter');await scene(unrelatedChapter.id,'Hidden scene',{content:document('Unrelated private prose')});
 const html=await (await fullRequest('/chapters/'+entry.id+'/?novel='+parent.id)).text();
 assert.match(html,/id="profile-form"/);assert.match(html,/id="identity"/);
 for(const section of ['overview','scenes'])assert.ok(html.includes('id="'+section+'"'),section);
 assert.doesNotMatch(html,/id="manuscript"/);
 assert.equal((html.match(/name="title"/g)||[]).length,1);assert.match(html,/<textarea[^>]*name="title"[^>]*maxlength="160"|<textarea[^>]*maxlength="160"[^>]*name="title"/);
 assert.match(html,/Chapter title/);assert.match(html,/Chapter summary/);assert.match(html,/<textarea[^>]*name="summary"/);
 assert.ok(html.includes('/novels/'+parent.id+'/'));assert.match(html,/<dt>Chapter number<\/dt><dd>2<\/dd>/);assert.match(html,/<dt>Scenes<\/dt><dd[^>]*id="chapter-scene-count"[^>]*>1<\/dd>/);
 assert.match(html,/id="chapter-scenes-editor"/);assert.match(html,/class="[^"]*chapter-inline-scene[^"]*"[^>]*data-scene-id="/);
 assert.ok(html.includes('data-scene-id="'+selected.id+'"'));
 assert.doesNotMatch(html,/Write scenes →|Write scene →/);
 assert.equal((html.match(/class="[^"]*chapter-scene-image[^"]*"/g)||[]).length,1);
 assert.match(html,/The &lt;opening&gt;/);assert.match(html,/Outline &lt;script&gt; &amp; safe text/);assert.doesNotMatch(html,/<b> & safe text/);
 assert.doesNotMatch(html,/Hidden chapter|Hidden scene|Unrelated private prose/);
 const plain=await (await request('/chapters/'+entry.id+'/')).text();
 const initial=plain.match(/<script[^>]*id="profile-data"[^>]*>([\s\S]*?)<\/script>/);assert.ok(initial);
 const payload=JSON.parse(initial[1]);assert.equal(payload.id,entry.id);assert.equal(payload.title,entry.title);assert.equal(payload.summary,entry.summary);assert.equal(payload.version,entry.version);
 const sceneInitial=plain.match(/<script[^>]*id="chapter-scenes-data"[^>]*>([\s\S]*?)<\/script>/);assert.ok(sceneInitial);
 const scenePayload=JSON.parse(sceneInitial[1]);assert.equal(scenePayload.chapter.id,entry.id);assert.equal(scenePayload.chapter.novelId,parent.id);
 assert.deepEqual(scenePayload.novel,{id:parent.id,title:parent.title,coverUrl:''});
 assert.deepEqual(scenePayload.scenes.map(scene=>scene.id),[selected.id]);assert.equal(scenePayload.scenes[0].summary,selected.summary);assert.deepEqual(scenePayload.scenes[0].content,selected.content);
});

test('scene cards derive sanitized book artwork only from their owned parent novel',async t=>{
 const {request,novel,chapter,scene}=setup(t);
 const coverUrl='https://covers.example/owned.svg?edition=1&size=large',parent=await novel('The <winter> archive','author',{coverUrl});
 const entry=await chapter(parent.id),selected=await scene(entry.id,'The sealed letter',{summary:'A <script> & carefully preserved outline.'});
 const foreign=await novel('A private book','other',{coverUrl:'https://covers.example/private-secret.svg'});
 const html=await (await request('/chapters/'+entry.id+'/')).text();
 assert.match(html,/class="[^"]*chapter-scene-card[^"]*"/);assert.match(html,/class="[^"]*chapter-scene-cover-well[^"]*"/);
 assert.match(html,/src="https:\/\/covers\.example\/owned\.svg\?edition=1&amp;size=large"/);
 assert.match(html,/Book cover for The &lt;winter&gt; archive/);assert.match(html,/A &lt;script&gt; &amp; carefully preserved outline\./);
 assert.doesNotMatch(html,/private-secret\.svg|A private book/);
 const data=JSON.parse(html.match(/<script[^>]*id="chapter-scenes-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
 assert.deepEqual(data.novel,{id:parent.id,title:parent.title,coverUrl});assert.equal(data.scenes[0].id,selected.id);
 assert.equal((await request('/chapters/'+entry.id+'/?novel='+foreign.id)).status,404);
 // Imported documents can bypass API validation. Rendering still rejects unsafe sources.
 for(const unsafe of ['javascript:alert(1)','http://covers.example/insecure.svg','https://author:secret@covers.example/private.svg']){
  const imported=await novel('Imported book','author',{coverUrl:unsafe}),record=await chapter(imported.id);await scene(record.id);
  const page=await (await request('/chapters/'+record.id+'/')).text();
  const payload=JSON.parse(page.match(/<script[^>]*id="chapter-scenes-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  assert.equal(payload.novel.coverUrl,'');assert.doesNotMatch(page,/<img[^>]*src="(?:javascript:|http:)/);assert.doesNotMatch(page,/onerror="alert\(1\)"/);
 }
 const quoted=await novel('Quoted book','author',{coverUrl:'https://covers.example/a.svg" onerror="alert(1)'}),quotedChapter=await chapter(quoted.id);await scene(quotedChapter.id);
 const quotedHtml=await (await request('/chapters/'+quotedChapter.id+'/')).text();
 const quotedData=JSON.parse(quotedHtml.match(/<script[^>]*id="chapter-scenes-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
 assert.equal(quotedData.novel.coverUrl,'');assert.doesNotMatch(quotedHtml,/<img[^>]*src=/);assert.match(quotedHtml,/Book cover placeholder for Quoted book/);
 assert.doesNotMatch(quotedHtml,/<img[^>]*\sonerror="/);
});

test('inline scene fallbacks preserve supported rich prose while escaping executable text',async t=>{
 const {request,novel,chapter,scene,sqlite}=setup(t),parent=await novel(),entry=await chapter(parent.id);
 const rich={type:'doc',content:[
  {type:'heading',attrs:{level:3},content:[text('A <heading>')]},
  {type:'paragraph',content:[{type:'text',text:'Formatted <script>alert(1)</script> & prose',marks:[{type:'bold'},{type:'italic'},{type:'underline'},{type:'strike'}]},{type:'hardBreak'},{type:'text',text:'const dawn = true',marks:[{type:'code'}]}]},
  {type:'orderedList',attrs:{start:3,type:'A'},content:[{type:'listItem',content:[paragraph('First item'),{type:'bulletList',content:[{type:'listItem',content:[paragraph('Nested item')]}]}]}]},
  {type:'blockquote',content:[paragraph('Remember this.')]},{type:'horizontalRule'},
 ]};
 const first=await scene(entry.id,'Earlier scene',{content:rich}),second=await scene(entry.id,'Later scene',{content:document('Later scene prose.')});
 sqlite.prepare('UPDATE scenes SET created_at = ? WHERE id = ?').run('2026-01-01T00:00:00.000Z',first.id);
 sqlite.prepare('UPDATE scenes SET created_at = ? WHERE id = ?').run('2026-01-02T00:00:00.000Z',second.id);
 const html=await (await request('/chapters/'+entry.id+'/')).text();
 assert.match(html,/<h6>A &lt;heading&gt;<\/h6>/);assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; prose/);assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 for(const tag of ['strong','em','u','code','blockquote','ul','li'])assert.match(html,new RegExp('<'+tag+'(?:>| )'));
 assert.match(html,/<(?:s|del)(?:>| )/);assert.match(html,/<br\s*\/?\s*>/);assert.match(html,/<hr\s*\/?\s*>/);
 assert.match(html,/<ol[^>]*start="3"/);assert.match(html,/<ol[^>]*type="A"/);
 assert.ok(html.indexOf(first.title)<html.indexOf(second.title));assert.ok(html.indexOf('Remember this.')<html.indexOf('Later scene prose.'));
});

test('empty chapter profiles include a landscape placeholder and mount their own first-scene composer',async t=>{
 const {request,novel,chapter}=setup(t),parent=await novel(),entry=await chapter(parent.id);
 const html=await (await request('/chapters/'+entry.id+'/')).text();
 assert.match(html,/<dt>Scenes<\/dt><dd[^>]*id="chapter-scene-count"[^>]*>0<\/dd>/);assert.match(html,/first scene/);
 assert.match(html,/id="chapter-scenes-editor"/);assert.match(html,/class="[^"]*chapter-scene-image[^"]*"/);
 const initial=html.match(/<script[^>]*id="chapter-scenes-data"[^>]*>([\s\S]*?)<\/script>/);assert.ok(initial);
 const payload=JSON.parse(initial[1]);assert.equal(payload.chapter.id,entry.id);assert.equal(payload.chapter.novelId,parent.id);assert.deepEqual(payload.scenes,[]);
 assert.doesNotMatch(html,/compose=scene|Write scenes →|id="manuscript"/);
 assert.doesNotMatch(html,/Saved scene prose/);
});
