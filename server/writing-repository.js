import {decodeStoredDocument,supportedSchemaVersion} from './document-storage.js';

/** Owner-scoped, versioned writing persistence. Routes validate every document. */
export function writingRepository(binding){
 if(!binding)throw new Error('Writing storage is unavailable.');
 const decode=row=>row?{...decodeStoredDocument(row),...(row.chapter_id?{chapterId:row.chapter_id}:{}),id:row.id,schemaVersion:row.schema_version??supportedSchemaVersion,version:row.version,createdAt:row.created_at,updatedAt:row.updated_at}:null;
 const get=async(table,owner,id)=>decode(await binding.prepare(`SELECT * FROM ${table} WHERE owner_id = ? AND id = ?`).bind(owner,id).first());
 const create=async(table,owner,id,document)=>{
  const now=new Date().toISOString(),scene=table==='scenes';
  const sql=`INSERT INTO ${table} (id, owner_id, ${scene?'chapter_id, ':''}document, version, created_at, updated_at) VALUES (?, ?, ${scene?'?, ':''}?, 1, ?, ?) ON CONFLICT(id) DO NOTHING`;
  const result=await binding.prepare(sql).bind(id,owner,...(scene?[document.chapterId]:[]),JSON.stringify(document),now,now).run();
  // A concurrent save can run before a follow-up SELECT. As with updates,
  // acknowledge the exact revision that this request created, so a caller
  // cannot receive another writer's version and later overwrite their work.
  return result.meta.changes?{...document,id,schemaVersion:supportedSchemaVersion,version:1,createdAt:now,updatedAt:now}:get(table,owner,id);
 };
 const save=async(table,owner,current,document)=>{
  const now=new Date().toISOString(),scene=table==='scenes';
  const sql=`UPDATE ${table} SET ${scene?'chapter_id = ?, ':''}document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1`;
  const result=await binding.prepare(sql).bind(...(scene?[document.chapterId]:[]),JSON.stringify(document),now,owner,current.id,current.version).run();
  // Return this exact successful write, not a subsequent read that could already
  // contain another tab's newer document and incorrectly advance the caller.
  return result.meta.changes?{...document,id:current.id,schemaVersion:supportedSchemaVersion,version:current.version+1,createdAt:current.createdAt,updatedAt:now}:null;
 };
 return {
  async listChapters(owner){return (await binding.prepare('SELECT * FROM chapters WHERE owner_id = ? ORDER BY created_at, id').bind(owner).all()).results.map(decode);},
  getChapter:(owner,id)=>get('chapters',owner,id),
  createChapter:(owner,id,document)=>create('chapters',owner,id,document),
  saveChapter:(owner,current,document)=>save('chapters',owner,current,document),
  async listScenes(owner,chapterId){
   // Exclude prose at the SQL boundary: switching outline/filter state does not
   // load or transfer every scene's rich-text JSON.
   const sql=`SELECT id, chapter_id AS chapterId, json_extract(document, '$.title') AS title, json_extract(document, '$.summary') AS summary, json_extract(document, '$.status') AS status, json_extract(document, '$.contentSchemaVersion') AS contentSchemaVersion, schema_version AS schemaVersion, version, created_at AS createdAt, updated_at AS updatedAt FROM scenes WHERE owner_id = ?${chapterId?' AND chapter_id = ?':''} ORDER BY created_at, id`;
   const rows=(await binding.prepare(sql).bind(owner,...(chapterId?[chapterId]:[])).all()).results;
   if(rows.some(row=>row.schemaVersion!==supportedSchemaVersion))throw new Error('This writing format version is not supported.');
   return rows;
  },
  getScene:(owner,id)=>get('scenes',owner,id),
  createScene:(owner,id,document)=>create('scenes',owner,id,document),
  saveScene:(owner,current,document)=>save('scenes',owner,current,document),
 };
}
