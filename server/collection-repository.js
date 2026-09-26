import {decodeStoredDocument} from './document-storage.js';
import {libraryEntries,libraryKey} from './library-targets.js';
import {smartKinds} from '../public/collections/rules.js';

const decode=row=>row?{...decodeStoredDocument(row),id:row.id,kind:row.kind,schemaVersion:row.schema_version,version:row.version,createdAt:row.created_at,updatedAt:row.updated_at}:null;
const member=row=>({kind:row.target_kind,id:row.target_id,...(row.target_kind==='note'?{characterId:row.target_parent_id}:{}),createdAt:row.created_at});

/** Called after character normalization, using its public/canonical identity. */
export async function validateCollectedNotes(binding,owner,characterId,document){
 const referenced=(await binding.prepare("SELECT target_id FROM collection_members WHERE owner_id = ? AND target_kind = 'note' AND target_parent_id = ?").bind(owner,characterId).all()).results;
 const remaining=new Set((document.notes||[]).map(note=>note.id));
 if(referenced.some(note=>!remaining.has(note.target_id)))throw new Error('A note you are removing belongs to a collection. Remove its collection membership before deleting the note.');
}

export function collectionRepository(binding){
 if(!binding)throw new Error('Collection storage is unavailable.');
 return {
  async list(owner){return (await binding.prepare('SELECT * FROM collections WHERE owner_id = ? ORDER BY updated_at DESC,id').bind(owner).all()).results.map(decode);},
  async get(owner,id){return decode(await binding.prepare('SELECT * FROM collections WHERE owner_id = ? AND id = ?').bind(owner,id).first());},
  async create(owner,id,kind,document){const now=new Date().toISOString(),created=await binding.prepare('INSERT INTO collections (id,owner_id,kind,document,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING *').bind(id,owner,kind,JSON.stringify(document),now,now).first();return created?decode(created):this.get(owner,id);},
  async save(owner,id,version,document){return decode(await binding.prepare('UPDATE collections SET document = ?,version = version+1,mutation_token = ?,updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 RETURNING *').bind(JSON.stringify(document),crypto.randomUUID(),new Date().toISOString(),owner,id,version).first());},
  async members(owner,id){return (await binding.prepare('SELECT * FROM collection_members WHERE owner_id = ? AND collection_id = ? ORDER BY created_at,target_kind,target_parent_id,target_id').bind(owner,id).all()).results.map(member);},
  async changeMember(owner,id,version,ref,remove=false){
   const current=await this.get(owner,id);if(!current||current.version!==version||current.kind!=='manual')return null;
   const token=crypto.randomUUID(),now=new Date().toISOString();
   const advance=binding.prepare('UPDATE collections SET version = version+1,mutation_token = ?,updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND kind = ? AND schema_version = 1 RETURNING *').bind(token,now,owner,id,version,'manual');
   const guard='EXISTS(SELECT 1 FROM collections WHERE owner_id = ? AND id = ? AND mutation_token = ?)';
   const write=remove?binding.prepare('DELETE FROM collection_members WHERE owner_id = ? AND collection_id = ? AND target_kind = ? AND target_id = ? AND target_parent_id = ? AND '+guard).bind(owner,id,ref.kind,ref.id,ref.characterId||'',owner,id,token):binding.prepare('INSERT INTO collection_members (owner_id,collection_id,target_kind,target_id,target_parent_id,created_at) SELECT ?,?,?,?,?,? WHERE '+guard+' ON CONFLICT DO NOTHING').bind(owner,id,ref.kind,ref.id,ref.characterId||'',now,owner,id,token);
   const results=await binding.batch([advance,write]);
   return results[0].meta?.changes?{...current,version:version+1,updatedAt:now}:null;
  },
  async remove(owner,id,version){
   const token=crypto.randomUUID(),now=new Date().toISOString();
   const results=await binding.batch([
    binding.prepare('UPDATE collections SET version = version+1,mutation_token = ?,updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 AND version < ? RETURNING *').bind(token,now,owner,id,version,Number.MAX_SAFE_INTEGER),
    binding.prepare('DELETE FROM collection_members WHERE owner_id = ? AND collection_id = ? AND EXISTS(SELECT 1 FROM collections WHERE owner_id = ? AND id = ? AND mutation_token = ?)').bind(owner,id,owner,id,token),
    binding.prepare('DELETE FROM collections WHERE owner_id = ? AND id = ? AND mutation_token = ?').bind(owner,id,token)
   ]);return Boolean(results[0].meta?.changes);
  },
  async entries(owner,collection){
   const entries=await libraryEntries(binding,owner),map=new Map(entries.map(entry=>[libraryKey(entry),entry]));
   if(collection.kind==='manual'){
    const members=await this.members(owner,collection.id),order=new Map((collection.order||[]).map((key,index)=>[key,index]));
    return members.sort((a,b)=>(order.get(libraryKey(a))??100000)-(order.get(libraryKey(b))??100000)).map(ref=>map.get(libraryKey(ref))).filter(Boolean);
   }
   const associations=(await binding.prepare('SELECT novel_id,target_kind,target_id FROM novel_associations WHERE owner_id = ?').bind(owner).all()).results;
   const novels=(await binding.prepare('SELECT id,json_extract(document,\'$.seriesId\') AS seriesId FROM novels WHERE owner_id = ?').bind(owner).all()).results;
   const seriesByNovel=new Map(novels.map(novel=>[novel.id,novel.seriesId]));
   const linked=new Map();for(const association of associations){const key=libraryKey({kind:association.target_kind,id:association.target_id});if(!linked.has(key))linked.set(key,new Set());linked.get(key).add(association.novel_id);}
   return entries.filter(entry=>smartKinds.includes(entry.kind)).filter(entry=>{
    // Embedded notes retain their own parent-qualified identity and follow
    // their parent character's declared novel links for scope predicates.
    const scopeKey=entry.kind==='note'?libraryKey({kind:'character',id:entry.characterId}):libraryKey(entry);
    const novelIds=linked.get(scopeKey)||new Set();
    const matches=collection.rules.predicates.map(rule=>{
     switch(rule.field){case 'entityType':return entry.kind===rule.value;case 'subtype':return entry.kind===rule.kind&&entry.type===rule.value;case 'linkedNovel':return novelIds.has(rule.value);case 'series':return [...novelIds].some(id=>seriesByNovel.get(id)===rule.value);case 'minNovelCount':return novelIds.size>=rule.value;case 'unassigned':return novelIds.size===0;default:return false;}
    });return collection.rules.mode==='any'?matches.some(Boolean):matches.every(Boolean);
   });
  }
 };
}
