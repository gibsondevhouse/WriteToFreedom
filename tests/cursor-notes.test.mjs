import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {validateNotes,moveNoteAnchors} from '../public/characters/notes.js';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';

test('note anchors follow insertions and removals, and detach if their marker is removed',()=>{
 const notes=[{field:'arc',position:5},{field:'arc',position:14}];
 const original='First[1] then [2] end';
 moveNoteAnchors(notes,'arc',original,'A '+original);assert.deepEqual(notes.map(n=>n.position),[7,16]);
 moveNoteAnchors(notes,'arc','A '+original,original);assert.deepEqual(notes.map(n=>n.position),[5,14]);
 const deleted=original.replace('[1]','');moveNoteAnchors(notes,'arc',original,deleted);assert.deepEqual(notes.map(n=>n.position),[null,11]);
});
test('notes validate IDs, source fields, text, anchors and duplicates',()=>{
 const note={id:crypto.randomUUID(),field:'arc',position:4,text:'Remember the promise.'};
 assert.equal(validateNotes([note],{arc:'Text[1].'})[0].position,4);
 assert.equal(validateNotes([note],{arc:'Text changed.'})[0].position,null);
 for(const notes of [[note,note],[{...note,field:'firstName'}],[{...note,text:' '}],[{...note,id:'bad'}],null])assert.throws(()=>validateNotes(notes,{arc:'Text[1].'}));
});
test('authored notes save with text, render as references, appear on the card, and stay private',async()=>{
 const db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(db)};
 const request=(path,method='GET',body,owner='author')=>worker.fetch(new Request('https://novel.example'+path,{method,headers:{origin:'https://novel.example','content-type':'application/json','oai-authenticated-user-id':owner},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 try{
  const original=await (await request('/api/characters/gemini')).json(),note={id:crypto.randomUUID(),field:'arc',position:5,text:'A promise <never> forgotten.'};
  const save=await request('/api/characters/gemini','PUT',{...original,arc:'Trust[1] grows.',notes:[note]});assert.equal(save.status,200);let saved=await save.json();assert.deepEqual(saved.notes,[note]);
  const page=await (await request('/characters/gemini/')).text();assert.ok(page.includes('data-create-note>Create a note'));assert.ok(page.includes('id="note-'+note.id+'"'));assert.ok(page.includes('A promise &lt;never&gt; forgotten.'));assert.ok(page.includes('Trust[1] grows.'));
  const dashboard=await (await request('/api/dashboard')).json();assert.ok(dashboard.characters.find(c=>c.id==='gemini').mentions.some(n=>n.href.endsWith('#note-'+note.id)));
  const other=await (await request('/characters/gemini/','GET',undefined,'other')).text();assert.ok(!other.includes(note.id));
  assert.equal((await request('/api/characters/gemini','PUT',{...original,notes:[note]})).status,409);
  const legacy={...saved,summary:'Older client'};delete legacy.notes;const legacySave=await request('/api/characters/gemini','PUT',legacy);assert.equal(legacySave.status,200);saved=await legacySave.json();assert.deepEqual(saved.notes,[note]);
  const removed=await request('/api/characters/gemini','PUT',{...saved,arc:'Trust grows.',notes:[]});assert.equal(removed.status,200);assert.deepEqual((await removed.json()).notes,[]);
 }finally{db.close();}
});
