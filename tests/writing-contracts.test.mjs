import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const compiled=await build({entryPoints:['frontend/writing/contracts.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {readChapterRecord,readSceneRecord,readSceneSummary,summarizeScene,groupScenesByChapter,serializeChapter,serializeScene,emptyWritingContent}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const chapter=()=>({id:crypto.randomUUID(),schemaVersion:1,version:3,title:'Chapter title',summary:'A summary',createdAt:'2026-09-01T10:00:00.000Z',updatedAt:'2026-09-24T10:00:00.000Z'});
const scene=()=>({...chapter(),chapterId:crypto.randomUUID(),status:'draft',contentSchemaVersion:1,content:emptyWritingContent()});

test('chapter scene grouping preserves catalog order and references without mutating source records',()=>{
 const first=scene(),second=scene(),third={...scene(),chapterId:first.chapterId},scenes=[first,second,third],before=structuredClone(scenes);
 const grouped=groupScenesByChapter(scenes);
 assert.deepEqual([...grouped.keys()],[first.chapterId,second.chapterId]);
 assert.deepEqual(grouped.get(first.chapterId),[first,third]);assert.equal(grouped.get(first.chapterId)[0],first);
 assert.deepEqual(grouped.get(second.chapterId),[second]);assert.equal(grouped.get('empty-chapter'),undefined);assert.deepEqual([...groupScenesByChapter([])],[]);
 grouped.get(first.chapterId).pop();assert.deepEqual(scenes,before);
 const moved={...first,chapterId:second.chapterId},updated=groupScenesByChapter([moved,second,third]);
 assert.deepEqual(updated.get(second.chapterId),[moved,second]);assert.deepEqual(updated.get(first.chapterId),[third]);assert.equal(first.chapterId,before[0].chapterId);
});

test('chapter scene grouping visits each scene once in a large catalog',()=>{
 let reads=0;
 const scenes=Array.from({length:2000},(_,index)=>({id:'scene-'+index,get chapterId(){reads++;return 'chapter-'+(index%100);}}));
 const grouped=groupScenesByChapter(scenes);
 assert.equal(reads,scenes.length);assert.equal(grouped.size,100);
 for(const entries of grouped.values())assert.equal(entries.length,20);
});

test('scene draft summaries remain displayable while incomplete titles still fail saved-record validation',()=>{
 const entry=scene();
 for(const title of ['', '   ']){
  const draft={...entry,title},before=structuredClone(draft),projected=summarizeScene(draft);
  const {content,...expected}=draft;
  assert.deepEqual(projected,expected);assert.deepEqual(draft,before);assert.notEqual(projected,draft);
  assert.equal(Object.hasOwn(projected,'content'),false);assert.throws(()=>readSceneSummary(projected),/metadata/);
 }
 assert.deepEqual(summarizeScene(entry),readSceneSummary(entry));
});

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

test('optional chapter profile metadata round-trips and title-only editing preserves its writable fields',()=>{
 const legacy=chapter();assert.deepEqual(readChapterRecord(legacy),legacy);
 const entry={...legacy,status:'revising',chapterNumber:25,connectedArcIds:[crypto.randomUUID(),crypto.randomUUID()]},before=structuredClone(entry);
 const decoded=readChapterRecord(entry);assert.deepEqual(decoded,entry);assert.notEqual(decoded.connectedArcIds,entry.connectedArcIds);
 const payload=serializeChapter({...decoded,title:'Updated title'});
 assert.deepEqual(payload,{title:'Updated title',summary:entry.summary,schemaVersion:1,version:entry.version,status:entry.status,chapterNumber:entry.chapterNumber,connectedArcIds:entry.connectedArcIds});
 assert.deepEqual(entry,before);assert.notEqual(payload.connectedArcIds,entry.connectedArcIds);
 assert.deepEqual(serializeChapter({...entry,connectedArcIds:[]}).connectedArcIds,[]);
 for(const bad of [{status:'published'},{status:null},{chapterNumber:0},{chapterNumber:10000},{chapterNumber:1.2},{chapterNumber:'3'},{chapterNumber:null},{connectedArcIds:null},{connectedArcIds:['bad']},{connectedArcIds:[entry.connectedArcIds[0],entry.connectedArcIds[0]]},{connectedArcIds:Array.from({length:51},()=>crypto.randomUUID())}]){
  assert.throws(()=>readChapterRecord({...entry,...bad}),Error,JSON.stringify(bad));assert.throws(()=>serializeChapter({...entry,...bad}),Error,JSON.stringify(bad));
 }
 const child=scene();assert.deepEqual(readSceneRecord(child),child);assert.equal(Object.hasOwn(serializeScene(child),'chapterNumber'),false);assert.equal(Object.hasOwn(serializeScene(child),'connectedArcIds'),false);
});
