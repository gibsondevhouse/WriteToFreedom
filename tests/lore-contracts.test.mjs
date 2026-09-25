import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {blankLore,loreTemplates} from '../public/lore/template.js';
import {ratingGroupsFor} from '../public/profiles/ratings.js';

// Bundle the DOM-free TypeScript contract to exercise the same browser serializer
// without depending on experimental Node TypeScript loading.
const compiled=await build({entryPoints:['frontend/lore/contracts.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {draftFromRecord,readProfileData,serializeNote,textFields,ratingFields}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const record=()=>({...blankLore('note'),id:'research-note',schemaVersion:1,version:4,name:'Research',body:'Plain text [1]\n<em>Literal markup</em>',originDate:'The first winter'});

test('typed note allowlists cover the shared domain schema',()=>{
 assert.deepEqual([...textFields].sort(),[...loreTemplates.note.fields].sort());
 assert.deepEqual(ratingFields,ratingGroupsFor('lore','note').flatMap(group=>group.fields));
});

test('note serialization preserves text and reference identity without leaking display projections or metadata',()=>{
 const saved={...record(),updatedAt:'server-only',connections:[{target:{kind:'note',id:'embedded-note',characterId:'claude'},relationship:'explained in'}],profileRatings:{clarity:0},hiddenFields:['body']};
 const initial=readProfileData({record:saved,targets:[{kind:'note',id:'embedded-note',characterId:'claude',label:'An embedded note',group:'Notes',href:'/characters/claude/#note-embedded-note'}],incoming:[]});
 const draft=draftFromRecord(initial.record),payload=serializeNote(draft,initial.record.version);
 assert.equal(payload.body,saved.body);assert.equal(payload.originDate,'The first winter');assert.deepEqual(payload.hiddenFields,['body']);
 assert.deepEqual(payload.connections,saved.connections);assert.deepEqual(payload.profileRatings,{clarity:0});
 assert.equal(payload.version,4);assert.equal(payload.schemaVersion,1);assert.deepEqual(payload.collections,['notes']);
 assert.equal('id' in payload,false);assert.equal('updatedAt' in payload,false);assert.equal('key' in payload.connections[0],false);
 assert.deepEqual(Object.keys(payload).sort(),[...loreTemplates.note.fields,'type','schemaVersion','version','hiddenFields','collections','profileRatings','pinned','featured','connections'].sort());
});

test('invalid note writes reject incomplete links and ratings without mutating drafts',()=>{
 const draft=draftFromRecord(record());
 draft.connections=[{key:'local',target:null,relationship:'pending'}];
 const before=structuredClone(draft);
 assert.throws(()=>serializeNote(draft,4),/Choose a connected entry/);assert.deepEqual(draft,before);
 draft.connections=[];draft.profileRatings.clarity='2.5';
 assert.throws(()=>serializeNote(draft,4),/whole-number ratings/);assert.equal(draft.profileRatings.clarity,'2.5');
 draft.profileRatings.clarity='';assert.deepEqual(serializeNote(draft,4).profileRatings,{});
});

test('initial display links and versioned note documents are checked at the boundary',()=>{
 const initial={record:record(),targets:[],incoming:[]};
 assert.throws(()=>readProfileData({...initial,record:{...initial.record,version:'4'}}),/Reload/);
 for(const schemaVersion of [undefined,2,'1'])assert.throws(()=>readProfileData({...initial,record:{...initial.record,schemaVersion}}),/unsupported data format/);
 assert.throws(()=>readProfileData({...initial,record:{...initial.record,version:Number.MAX_SAFE_INTEGER+1}}),/Reload/);
 for(const version of [0,1.5,Number.MAX_SAFE_INTEGER])assert.throws(()=>serializeNote(draftFromRecord(initial.record),version),/Reload/);
 assert.throws(()=>serializeNote({...draftFromRecord(initial.record),schemaVersion:2},4),/unsupported data format/);
 assert.throws(()=>readProfileData({...initial,record:{...initial.record,body:42}}),/unreadable field/);
 assert.throws(()=>readProfileData({...initial,targets:[{kind:'character',id:'claude',label:'Claude',group:'Characters',href:'//outside.example'}]}),/unreadable link/);
 assert.throws(()=>readProfileData({...initial,record:{...initial.record,hiddenFields:['name']}}),/hidden field/);
});
