import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const compiled=await build({entryPoints:['frontend/writing/contracts.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {readChapterRecord,readSceneRecord,readSceneSummary,serializeChapter,serializeScene,emptyWritingContent}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const chapter=()=>({id:crypto.randomUUID(),schemaVersion:1,version:3,title:'Chapter title',summary:'A summary',createdAt:'2026-09-01T10:00:00.000Z',updatedAt:'2026-09-24T10:00:00.000Z'});
const scene=()=>({...chapter(),chapterId:crypto.randomUUID(),status:'draft',contentSchemaVersion:1,content:emptyWritingContent()});

test('writing responses require supported formats, stable UUIDs, exact revisions, and valid stored metadata',()=>{
 const entry=scene();assert.deepEqual(readSceneRecord(entry),entry);
 const {content,...summary}=entry;assert.deepEqual(readSceneSummary(summary),summary);
 for(const bad of [{id:'not-a-uuid'},{chapterId:''},{schemaVersion:2},{schemaVersion:undefined},{version:Number.MAX_SAFE_INTEGER+1},{version:'3'},{title:' '},{title:'x'.repeat(161)},{summary:'x'.repeat(10001)},{status:{toString:()=> 'draft'}},{createdAt:'2026-02-30T10:00:00.000Z'},{updatedAt:'not-a-date'},{contentSchemaVersion:2}]){
  assert.throws(()=>readSceneRecord({...entry,...bad}),Error,JSON.stringify(bad));
 }
 assert.deepEqual(readChapterRecord(chapter()).schemaVersion,1);
});

test('writing serializers declare the storage format and reject unsupported or imprecise edits',()=>{
 const entry=scene(),before=structuredClone(entry),payload=serializeScene(entry);
 assert.deepEqual(entry,before);assert.equal(payload.schemaVersion,1);assert.equal(payload.version,entry.version);
 assert.equal(Object.hasOwn(payload,'id'),false);assert.equal(Object.hasOwn(payload,'createdAt'),false);assert.equal(Object.hasOwn(payload,'updatedAt'),false);
 assert.deepEqual(serializeChapter(chapter()),{title:'Chapter title',summary:'A summary',schemaVersion:1,version:3});
 for(const bad of [{schemaVersion:2},{version:0},{version:Number.MAX_SAFE_INTEGER},{version:Number.MAX_SAFE_INTEGER+1}]){
  assert.throws(()=>serializeChapter({...entry,...bad}),/Reload/);assert.throws(()=>serializeScene({...entry,...bad}),/Reload/);
 }
 for(const bad of [{contentSchemaVersion:2},{chapterId:'bad-id'},{status:'published'}])assert.throws(()=>serializeScene({...entry,...bad}),Error);
});
