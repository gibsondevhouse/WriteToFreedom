import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {documentSchema,documentSchemas,renderFieldInventory} from '../db/document-contracts.js';
import {assertDocumentSchema,documentValidator} from './helpers/document-schema.mjs';
import {templateSections,blankCharacter} from '../public/characters/template.js';
import {choicesFor,validateChoiceSelections} from '../public/profiles/choice-selections.js';
import {createWorker} from '../server/app.js';
import {repository} from '../server/db.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';

test('generated schema and field inventory stay synchronized with UI and nested contracts',()=>{
 assert.equal(readFileSync('db/documents.schema.json','utf8'),JSON.stringify(documentSchema,null,2)+'\n','Run npm run schema:documents after changing a template or document contract');
 assert.equal(readFileSync('docs/ui-field-inventory.md','utf8'),renderFieldInventory());
 assert.equal(Object.keys(documentSchemas).length,25);
 for(const key of Object.keys(documentSchemas))assert.equal(typeof documentValidator(key),'function',key);
 for(const section of templateSections)for(const [key,label] of section.fields){assert.ok(documentSchemas.character.properties[key],key);assert.equal(documentSchemas.character.properties[key].title,label);}
});

test('novel and series contracts preserve profile fields and exclude association data',()=>{
 const novel={title:'A new novel',synopsis:'A synopsis',status:'drafting',coverUrl:'',seriesId:'',seriesOrder:0,hiddenFields:['synopsis']};
 const series={title:'A series',summary:'A shared setting',coverUrl:'',hiddenFields:['summary']};
 assertDocumentSchema('novel',novel);assertDocumentSchema('series',series);
 for(const extra of [{status:'published'},{seriesOrder:-1},{seriesOrder:1.5},{title:'x'.repeat(481)},{hiddenFields:['prose']},{associations:[]}])assert.equal(documentValidator('novel')({...novel,...extra}),false);
 assert.equal(documentValidator('series')({...series,summary:'x'.repeat(10001)}),false);
 assert.equal(documentValidator('series')({...series,novelIds:[]}),false);
 assert.equal(documentSchemas.novel['x-storage'].table,'novels');
 assert.equal(documentSchemas.series['x-storage'].table,'series');
});

test('manual and smart collections have separate bounded document contracts',()=>{
 const metadata={name:'A collection',summary:'Entries',coverUrl:''};
 assertDocumentSchema('collection_manual',{...metadata,order:['character::claude']});
 assertDocumentSchema('collection_smart',{...metadata,rules:{version:1,mode:'all',predicates:[{field:'linkedNovel',value:crypto.randomUUID()},{field:'minNovelCount',value:2}]}});
 assert.equal(documentValidator('collection_manual')({...metadata,order:[],rules:{}}),false);
 assert.equal(documentValidator('collection_smart')({...metadata,rules:{version:1,mode:'any',predicates:[{field:'customSql',value:'SELECT *'}]}}),false);
 assert.equal(documentValidator('collection_smart')({...metadata,rules:{version:1,mode:'all',predicates:Array.from({length:9},()=>({field:'unassigned'}))}}),false);
 assert.equal(documentValidator('collection_manual')({...metadata,order:['duplicate','duplicate']}),false);
});

test('document schemas reject silently lost fields, invalid ratings, reference shapes and unsupported rich text',()=>{
 const character=blankCharacter();assertDocumentSchema('character',character);
 for(const extra of [{undocumentedField:'will be dropped'},{attributeRatings:{strength:100}},{cardConnection:{kind:'note',id:crypto.randomUUID()}},{notes:[{id:crypto.randomUUID(),field:'unknown',text:'note',position:null}]},{choiceSelections:{roles:[42]}}])assert.equal(documentValidator('character')({...character,...extra}),false);
 assertDocumentSchema('entityReference',{kind:'note',id:crypto.randomUUID(),characterId:'claude'});
 const content={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Keep exact prose',marks:[{type:'bold'}]}]}]};
 assertDocumentSchema('writingContent',content);
 assert.equal(documentValidator('writingContent')({type:'doc',content:[{type:'image',attrs:{src:'https://example.com'}}]}),false);
 assert.equal(documentValidator('writingContent')({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Code',marks:[{type:'code'},{type:'bold'}]}]}]}),false);
});

test('exact choice arrays preserve punctuation and distinguish legacy edits from unrelated updates',()=>{
 const current={roles:'Map · song interpreter · Archivist, keeper',choiceSelections:{roles:['Map · song interpreter','Archivist, keeper']}};
 const output={roles:current.roles};assert.deepEqual(validateChoiceSelections({},current,output,['roles']),current.choiceSelections);
 assert.deepEqual(choicesFor(current,'roles'),current.choiceSelections.roles);
 const replacement={roles:'Writer · Editor'};
 assert.deepEqual(validateChoiceSelections({roles:replacement.roles,choiceSelections:current.choiceSelections},current,replacement,['roles']),{roles:['Writer','Editor']});
 assert.throws(()=>validateChoiceSelections({roles:'Different',choiceSelections:{roles:['Mismatch']}},current,{roles:'Different'},['roles']),/do not match/);
 for(const raw of ['Archivist · Archivist','   ',' Archivist ·  · Archivist ']){
  const doc={...blankCharacter(),roles:raw};
  doc.choiceSelections=validateChoiceSelections({roles:raw},blankCharacter(),doc,['roles']);
  assertDocumentSchema('character',doc);
  assert.deepEqual(doc.choiceSelections.roles,raw.trim()?['Archivist']:[]);
  // The normalized arrays can be echoed back by a modern editor unchanged.
  assert.deepEqual(validateChoiceSelections(doc,doc,{...doc},['roles']),doc.choiceSelections);
 }
});

test('character prose, choices and nested notes validate against the explicit schema after physical storage',async t=>{
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const name of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
 const worker=createWorker({}),origin='https://writer.example',env={DB:d1Adapter(sqlite)},id=crypto.randomUUID();
 const request=(path,method,body)=>worker.fetch(new Request(origin+path,{method,headers:{origin,'content-type':'application/json','oai-authenticated-user-id':'schema-audit'},...(body?{body:JSON.stringify(body)}:{})}),env);
 const created=await (await request('/api/characters','POST',{id})).json(),noteId=crypto.randomUUID();
 const payload={...created,firstName:'Mira',roles:'Singer · historian',choiceSelections:{roles:['Singer · historian']},biography:'Origin [1]',attributeRatings:{strength:0,charisma:99},hiddenFields:['biography'],notes:[{id:noteId,field:'biography',position:7,text:'Recorded by Claude',title:'Provenance',type:'lore',tags:['source'],content:[{text:'Recorded by '},{text:'Claude',ref:{kind:'character',id:'claude'}}]}],cardConnection:{kind:'location',id:'sample-capital'}};
 const response=await request('/api/characters/'+id,'PUT',payload);assert.equal(response.status,200,await response.clone().text());
 const stored=JSON.parse(sqlite.prepare('SELECT document FROM character_drafts WHERE id = ?').get(id).document);
 assertDocumentSchema('character',stored);
 assert.deepEqual(stored.choiceSelections.roles,['Singer · historian']);assert.equal(stored.notes[0].position,7);
 const reopened=await (await request('/api/characters/'+id,'GET')).json();
 for(const key of ['choiceSelections','notes','cardConnection','attributeRatings','hiddenFields'])assert.deepEqual(reopened[key],stored[key],key);
});

test('location edit timestamp migration preserves unknown history and records subsequent writes',async t=>{
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 const files=readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort();
 for(const name of files.filter(name=>name<'0012'))sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
 const document='{"name":"Historical archive","parentId":"sample-capital"}';
 sqlite.prepare('INSERT INTO location_details(owner_id,location_id,document,version) VALUES (?,?,?,?)').run('author','sample-royal-archive',document,4);
 for(const name of files.filter(name=>name>='0012'))sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
 assert.deepEqual({...sqlite.prepare('SELECT document,version,updated_at FROM location_details').get()},{document,version:4,updated_at:null});
 const db=repository(d1Adapter(sqlite));
 assert.equal((await db.listLocationDetails('author'))[0].updatedAt,null);
 const saved=await db.saveLocationDetails('author','sample-royal-archive',4,{name:'Updated archive',parentId:'sample-capital'});
 assert.equal(saved.version,5);assert.equal(new Date(saved.updatedAt).toISOString(),saved.updatedAt);
 assert.equal((await db.listLocationDetails('author'))[0].updatedAt,saved.updatedAt);
 const created=await db.createLocation('author',{id:crypto.randomUUID(),name:'Ward',type:'area',areaType:'Ward',parentId:'sample-capital'});
 assert.ok((await db.listLocationDetails('author')).find(row=>row.id===created.id).updatedAt);
});
