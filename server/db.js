import {decodeStoredDocument, supportedSchemaVersion} from './document-storage.js';
import { normalizeCharacter } from '../public/characters/template.js';
import { characters as seeds } from '../public/characters/data.js';
async function storageId(owner,id) {
 if(!seeds.some(seed=>seed.id===id))return id;
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(['sample-character',owner,id]))))).slice(0,16);
 hash[6]=(hash[6]&15)|64;hash[8]=(hash[8]&63)|128;
 const hex=hash.map(b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
/**
 * Owner-scoped persistence boundary used by routes and catalog aggregators.
 * Exposes D1 prepared queries and conditional versioned writes; batch operations
 * keep document/catalog representations together. Does not authenticate requests
 * or validate domain references: handlers must supply an owner and valid data.
 * Source samples are merged above this layer; character sample IDs are mapped to
 * deterministic private storage IDs here. See docs/routing.md for caller contracts.
 */
export function repository(binding) {
 if (!binding) throw new Error('Character storage is unavailable.');
 const decode = row => {if(!row)return null;const doc=normalizeCharacter(decodeStoredDocument(row));return {...doc,id:doc.sampleId||row.id,version:row.version,schemaVersion:row.schema_version??supportedSchemaVersion,createdAt:row.created_at,updatedAt:row.updated_at};};
 const decodeNovelDocument=row=>row?{...decodeStoredDocument(row),id:row.id,version:row.version,schemaVersion:row.schema_version??supportedSchemaVersion,createdAt:row.created_at,updatedAt:row.updated_at}:null;
 const decodeNovelAssociation=row=>row?{id:row.id,novelId:row.novel_id,targetKind:row.target_kind,targetId:row.target_id,relationKind:row.relation_kind,prose:row.prose,version:row.version,createdAt:row.created_at,updatedAt:row.updated_at}:null;
 const seriesSnapshots=async(owner,ids)=>{
  const rows=await Promise.all([...new Set(ids.filter(Boolean))].map(id=>binding.prepare('SELECT * FROM series WHERE owner_id = ? AND id = ?').bind(owner,id).first()));
  return rows.some(row=>!row||row.schema_version!==1||row.version>=Number.MAX_SAFE_INTEGER)?null:rows;
 };
 const seriesChecks=rows=>rows.map(()=> 'EXISTS (SELECT 1 FROM series WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 AND version < ?)').join(' AND ');
 const seriesArgs=rows=>rows.flatMap(row=>[row.owner_id,row.id,row.version,Number.MAX_SAFE_INTEGER]);
 const advanceSeries=(rows,now,ack)=>rows.map(row=>binding.prepare('UPDATE series SET version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 AND EXISTS (SELECT 1 FROM novels WHERE owner_id = ? AND id = ? AND version = ? AND document = ? AND updated_at = ?)').bind(now,row.owner_id,row.id,row.version,ack.owner,ack.id,ack.version,ack.document,now));
 return {
  async listNovels(owner) {return (await binding.prepare('SELECT * FROM novels WHERE owner_id = ? ORDER BY updated_at DESC, id').bind(owner).all()).results.map(decodeNovelDocument);},
  async getNovel(owner,id) {return decodeNovelDocument(await binding.prepare('SELECT * FROM novels WHERE owner_id = ? AND id = ?').bind(owner,id).first());},
  async createNovel(owner,id,document) {
   const now=new Date().toISOString();
   if(!document.seriesId){const created=await binding.prepare('INSERT INTO novels (id, owner_id, document, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING *').bind(id,owner,JSON.stringify(document),now,now).first();return created?decodeNovelDocument(created):this.getNovel(owner,id);}
   const existing=await this.getNovel(owner,id);if(existing)return existing;
   const rows=await seriesSnapshots(owner,[document.seriesId]);if(!rows)return null;
   // Membership changes and reorder use the same series revision. Assertions
   // run inside the D1 transaction, so a failed check rolls back every write.
   const assertion=binding.prepare(`INSERT INTO series (id, owner_id, document, schema_version, version, created_at, updated_at) SELECT id, owner_id, document, schema_version, version, created_at, updated_at FROM series WHERE owner_id = ? AND id = ? AND NOT (${seriesChecks(rows)})`).bind(owner,document.seriesId,...seriesArgs(rows));
   const insert=binding.prepare(`INSERT INTO novels (id, owner_id, document, version, created_at, updated_at) SELECT ?, ?, ?, 1, ?, ? WHERE ${seriesChecks(rows)}`).bind(id,owner,JSON.stringify(document),now,now,...seriesArgs(rows));
   let results;try{results=await binding.batch([assertion,insert,...advanceSeries(rows,now,{owner,id,version:1,document:JSON.stringify(document)})]);}catch(error){if(/UNIQUE constraint failed: novels\.id/i.test(error.message))return this.getNovel(owner,id);if(/UNIQUE constraint failed: series\.id/i.test(error.message))return null;throw error;}
   if(results[1].meta.changes!==1)return null;
   return {...document,id,version:1,schemaVersion:1,createdAt:now,updatedAt:now};
  },
  async saveNovel(owner,id,version,document) {
   const current=await this.getNovel(owner,id);if(!current||current.version!==version)return null;
   const changed=(current.seriesId||'')!==(document.seriesId||'')||(current.seriesOrder??0)!==(document.seriesOrder??0),now=new Date().toISOString();
   const affected=changed?[current.seriesId,document.seriesId].filter(Boolean):[];
   if(!affected.length)return decodeNovelDocument(await binding.prepare('UPDATE novels SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 RETURNING *').bind(JSON.stringify(document),now,owner,id,version).first());
   const rows=await seriesSnapshots(owner,affected);if(!rows)return null;
   const checks=`version = ? AND schema_version = 1 AND version < ? AND ${seriesChecks(rows)}`,args=[version,Number.MAX_SAFE_INTEGER,...seriesArgs(rows)];
   const assertion=binding.prepare(`INSERT INTO novels (id, owner_id, document, schema_version, version, created_at, updated_at) SELECT id, owner_id, document, schema_version, version, created_at, updated_at FROM novels WHERE owner_id = ? AND id = ? AND NOT (${checks})`).bind(owner,id,...args);
   const update=binding.prepare(`UPDATE novels SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND ${checks}`).bind(JSON.stringify(document),now,owner,id,...args);
   let results;try{results=await binding.batch([assertion,update,...advanceSeries(rows,now,{owner,id,version:version+1,document:JSON.stringify(document)})]);}catch(error){if(/UNIQUE constraint failed: novels\.id/i.test(error.message))return null;throw error;}
   if(results[1].meta.changes!==1)return null;
   return {...document,id,version:version+1,schemaVersion:1,createdAt:current.createdAt,updatedAt:now};
  },
  async listSeries(owner) {return (await binding.prepare('SELECT * FROM series WHERE owner_id = ? ORDER BY updated_at DESC, id').bind(owner).all()).results.map(decodeNovelDocument);},
  async getSeries(owner,id) {return decodeNovelDocument(await binding.prepare('SELECT * FROM series WHERE owner_id = ? AND id = ?').bind(owner,id).first());},
  async createSeries(owner,id,document) {const now=new Date().toISOString(),created=await binding.prepare('INSERT INTO series (id, owner_id, document, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING *').bind(id,owner,JSON.stringify(document),now,now).first();return created?decodeNovelDocument(created):this.getSeries(owner,id);},
  async saveSeries(owner,id,version,document) {return decodeNovelDocument(await binding.prepare('UPDATE series SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 RETURNING *').bind(JSON.stringify(document),new Date().toISOString(),owner,id,version).first());},
  async reorderSeriesNovels(owner,id,version,novelIds) {
   if(!Array.isArray(novelIds)||novelIds.some(id=>typeof id!=='string')||new Set(novelIds).size!==novelIds.length)return null;
   // D1 batches roll back when any statement fails. The first statement asserts
   // all preconditions in the transaction by provoking a primary-key conflict
   // only when they fail. It cannot insert a row. This prevents a later revision
   // check from leaving an earlier member update committed on its own.
   // json_set preserves unrelated, freshly saved profile fields.
   const current=await this.getSeries(owner,id);if(!current||current.version!==version)return null;
   const encoded=JSON.stringify(novelIds),now=new Date().toISOString();
   const members='SELECT 1 FROM novels AS candidate WHERE candidate.owner_id = ? AND json_extract(candidate.document, \'$.seriesId\') = ?';
   const exact="(SELECT COUNT(*) FROM novels WHERE owner_id = ? AND json_extract(document, '$.seriesId') = ?) = json_array_length(?) AND NOT EXISTS (SELECT 1 FROM json_each(?) AS requested LEFT JOIN novels AS member ON member.owner_id = ? AND member.id = requested.value AND json_extract(member.document, '$.seriesId') = ? WHERE member.id IS NULL)";
   const editable=`NOT EXISTS (${members} AND (candidate.schema_version != 1 OR candidate.version >= ?))`;
   const guard='EXISTS (SELECT 1 FROM series WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 AND version < ?)';
   const assertion=binding.prepare(`INSERT INTO series (id, owner_id, document, schema_version, version, created_at, updated_at) SELECT id, owner_id, document, schema_version, version, created_at, updated_at FROM series WHERE owner_id = ? AND id = ? AND NOT (version = ? AND schema_version = 1 AND version < ? AND ${exact} AND ${editable})`).bind(owner,id,version,Number.MAX_SAFE_INTEGER,owner,id,encoded,encoded,owner,id,owner,id,Number.MAX_SAFE_INTEGER);
   const first=binding.prepare(`UPDATE novels SET document = json_set(document, '$.seriesOrder', (SELECT CAST(position.key AS INTEGER) FROM json_each(?) AS position WHERE position.value = novels.id)), version = version + 1, updated_at = ? WHERE owner_id = ? AND json_extract(document, '$.seriesId') = ? AND ${guard}`).bind(encoded,now,owner,id,owner,id,version,Number.MAX_SAFE_INTEGER);
   const second=binding.prepare('UPDATE series SET version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 AND version < ?').bind(now,owner,id,version,Number.MAX_SAFE_INTEGER);
   let novels,series;try{[,novels,series]=await binding.batch([assertion,first,second]);}catch(error){if(/UNIQUE constraint failed: series\.id/i.test(error.message))return null;throw error;}
   if(series.meta.changes!==1||novels.meta.changes!==novelIds.length)return null;
   return {series:{...current,version:version+1,updatedAt:now},novelIds:[...novelIds]};
  },
  async listNovelAssociations(owner,novelId) {return (await binding.prepare('SELECT * FROM novel_associations WHERE owner_id = ? AND novel_id = ? ORDER BY created_at, id').bind(owner,novelId).all()).results.map(decodeNovelAssociation);},
  async listNovelAssociationsByTarget(owner,targetKind,targetId) {return (await binding.prepare('SELECT * FROM novel_associations WHERE owner_id = ? AND target_kind = ? AND target_id = ? ORDER BY created_at, id').bind(owner,targetKind,targetId).all()).results.map(decodeNovelAssociation);},
  async getNovelAssociation(owner,id) {return decodeNovelAssociation(await binding.prepare('SELECT * FROM novel_associations WHERE owner_id = ? AND id = ?').bind(owner,id).first());},
  async createNovelAssociation(owner,id,novelId,targetKind,targetId,relationKind,prose) {
   const now=new Date().toISOString();
   const created=await binding.prepare('INSERT INTO novel_associations (id, owner_id, novel_id, target_kind, target_id, relation_kind, prose, version, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, 1, ?, ? WHERE EXISTS (SELECT 1 FROM novels WHERE owner_id = ? AND id = ?) ON CONFLICT DO NOTHING RETURNING *').bind(id,owner,novelId,targetKind,targetId,relationKind,prose,now,now,owner,novelId).first();
   if(created)return decodeNovelAssociation(created);
   return decodeNovelAssociation(await binding.prepare('SELECT * FROM novel_associations WHERE owner_id = ? AND novel_id = ? AND target_kind = ? AND target_id = ?').bind(owner,novelId,targetKind,targetId).first());
  },
  async saveNovelAssociation(owner,id,version,relationKind,prose) {return decodeNovelAssociation(await binding.prepare('UPDATE novel_associations SET relation_kind = ?, prose = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? RETURNING *').bind(relationKind,prose,new Date().toISOString(),owner,id,version).first());},
  async deleteNovelAssociation(owner,id,version) {if(!Number.isSafeInteger(version)||version<1)return false;return (await binding.prepare('DELETE FROM novel_associations WHERE owner_id = ? AND id = ? AND version = ?').bind(owner,id,version).run()).meta.changes>0;},
  async listStoryArcs(owner) {return (await binding.prepare('SELECT * FROM story_arcs WHERE owner_id = ? ORDER BY updated_at DESC, id').bind(owner).all()).results.map(row=>({...decodeStoredDocument(row),id:row.id,version:row.version,schemaVersion:row.schema_version??supportedSchemaVersion,createdAt:row.created_at,updatedAt:row.updated_at}));},
  async getStoryArc(owner,id) {const row=await binding.prepare('SELECT * FROM story_arcs WHERE owner_id = ? AND id = ?').bind(owner,id).first();return row?{...decodeStoredDocument(row),id:row.id,version:row.version,schemaVersion:row.schema_version??supportedSchemaVersion,createdAt:row.created_at,updatedAt:row.updated_at}:null;},
  async createStoryArc(owner,id,document) {const now=new Date().toISOString();await binding.prepare('INSERT INTO story_arcs (id, owner_id, document, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id,owner,JSON.stringify(document),now,now).run();return this.getStoryArc(owner,id);},
  async saveStoryArc(owner,id,version,document) {const row=await binding.prepare('UPDATE story_arcs SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 RETURNING *').bind(JSON.stringify(document),new Date().toISOString(),owner,id,version).first();return row?{...decodeStoredDocument(row),id:row.id,version:row.version,schemaVersion:row.schema_version,createdAt:row.created_at,updatedAt:row.updated_at}:null;},
  async listLore(owner) {return (await binding.prepare('SELECT * FROM lore_entries WHERE owner_id = ? ORDER BY updated_at DESC, id').bind(owner).all()).results.map(row=>({...decodeStoredDocument(row),id:row.id,version:row.version,schemaVersion:row.schema_version??supportedSchemaVersion,createdAt:row.created_at,updatedAt:row.updated_at}));},
  async getLore(owner,id) {const row=await binding.prepare('SELECT * FROM lore_entries WHERE owner_id = ? AND id = ?').bind(owner,id).first();return row?{...decodeStoredDocument(row),id:row.id,version:row.version,schemaVersion:row.schema_version??supportedSchemaVersion,createdAt:row.created_at,updatedAt:row.updated_at}:null;},
  async createLore(owner,id,document) {const now=new Date().toISOString();await binding.prepare('INSERT INTO lore_entries (id, owner_id, document, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id,owner,JSON.stringify(document),now,now).run();return this.getLore(owner,id);},
  async saveLore(owner,id,version,document) {const row=await binding.prepare('UPDATE lore_entries SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 RETURNING *').bind(JSON.stringify(document),new Date().toISOString(),owner,id,version).first();return row?{...decodeStoredDocument(row),id:row.id,version:row.version,schemaVersion:row.schema_version,createdAt:row.created_at,updatedAt:row.updated_at}:null;},
  async listCityProfiles(owner) {return (await binding.prepare('SELECT * FROM city_profiles WHERE owner_id = ?').bind(owner).all()).results.map(row=>({...decodeStoredDocument(row),id:row.location_id,version:row.version,schemaVersion:row.schema_version??supportedSchemaVersion,updatedAt:row.updated_at??null}));},
  async saveCity(owner,id,version,document) {
   const encoded=JSON.stringify(document),now=new Date().toISOString();
   const write=version===0?binding.prepare('INSERT INTO city_profiles (owner_id, location_id, document, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(owner_id, location_id) DO NOTHING').bind(owner,id,encoded,now):binding.prepare('UPDATE city_profiles SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND location_id = ? AND version = ? AND schema_version = 1').bind(encoded,now,owner,id,version);
   const rename=binding.prepare('UPDATE locations SET name = ?, parent_id = ? WHERE owner_id = ? AND id = ? AND type = ? AND EXISTS (SELECT 1 FROM city_profiles WHERE owner_id = ? AND location_id = ? AND version = ? AND schema_version = 1 AND document = ?)').bind(document.name,document.parentId,owner,id,'city',owner,id,version+1,encoded);
   const [result]=await binding.batch([write,rename]);return result.meta.changes?{...document,id,version:version+1,schemaVersion:supportedSchemaVersion,updatedAt:now}:null;
  },
  async listCountryProfiles(owner) {return (await binding.prepare('SELECT * FROM country_profiles WHERE owner_id = ?').bind(owner).all()).results.map(row=>({...decodeStoredDocument(row),id:row.location_id,version:row.version,schemaVersion:row.schema_version??supportedSchemaVersion,updatedAt:row.updated_at??null}));},
  async saveCountry(owner,id,version,document) {
   const encoded=JSON.stringify(document),now=new Date().toISOString();
   const write=version===0?binding.prepare('INSERT INTO country_profiles (owner_id, location_id, document, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(owner_id, location_id) DO NOTHING').bind(owner,id,encoded,now):binding.prepare('UPDATE country_profiles SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND location_id = ? AND version = ? AND schema_version = 1').bind(encoded,now,owner,id,version);
   const rename=binding.prepare('UPDATE locations SET name = ?, parent_id = ? WHERE owner_id = ? AND id = ? AND type = ? AND EXISTS (SELECT 1 FROM country_profiles WHERE owner_id = ? AND location_id = ? AND version = ? AND schema_version = 1 AND document = ?)').bind(document.name,document.parentId||null,owner,id,'country',owner,id,version+1,encoded);
   const [result]=await binding.batch([write,rename]);return result.meta.changes?{...document,id,version:version+1,schemaVersion:supportedSchemaVersion,updatedAt:now}:null;
  },
  async listLocationDetails(owner) {return (await binding.prepare('SELECT * FROM location_details WHERE owner_id = ?').bind(owner).all()).results.map(row=>({...decodeStoredDocument(row),id:row.location_id,version:row.version,schemaVersion:row.schema_version??supportedSchemaVersion,updatedAt:row.updated_at??null}));},
  async saveLocationDetails(owner,id,version,document) {
   const encoded=JSON.stringify(document),now=new Date().toISOString();
   const write=version===0?binding.prepare('INSERT INTO location_details (owner_id, location_id, document, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(owner_id, location_id) DO NOTHING').bind(owner,id,encoded,now):binding.prepare('UPDATE location_details SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND location_id = ? AND version = ? AND schema_version = 1').bind(encoded,now,owner,id,version);
   const rename=binding.prepare('UPDATE locations SET name = ?, parent_id = ? WHERE owner_id = ? AND id = ? AND EXISTS (SELECT 1 FROM location_details WHERE owner_id = ? AND location_id = ? AND version = ? AND schema_version = 1 AND document = ?)').bind(document.name,document.parentId,owner,id,owner,id,version+1,encoded);
   const [result]=await binding.batch([write,rename]);return result.meta.changes?{...document,id,version:version+1,schemaVersion:supportedSchemaVersion,updatedAt:now}:null;
  },
  async listLocations(owner) {return (await binding.prepare('SELECT id, name, type, parent_id AS parentId FROM locations WHERE owner_id = ? ORDER BY created_at, rowid').bind(owner).all()).results;},
  async createLocation(owner,location) {
   const insert=binding.prepare('INSERT INTO locations (id, owner_id, name, type, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(location.id,owner,location.name,location.type,location.parentId,new Date().toISOString());
   if(location.type==='area'){
    const details=binding.prepare('INSERT INTO location_details (owner_id, location_id, document, version, updated_at) SELECT ?, ?, ?, 1, ? WHERE EXISTS (SELECT 1 FROM locations WHERE id = ? AND owner_id = ? AND type = ?) ON CONFLICT(owner_id, location_id) DO NOTHING').bind(owner,location.id,JSON.stringify({name:location.name,parentId:location.parentId,areaType:location.areaType}),new Date().toISOString(),location.id,owner,'area');
    await binding.batch([insert,details]);
   }else await insert.run();
   return await binding.prepare('SELECT id, name, type, parent_id AS parentId FROM locations WHERE owner_id = ? AND id = ?').bind(owner,location.id).first();
  },
  async list(owner) { const data = await binding.prepare('SELECT * FROM character_drafts WHERE owner_id = ? ORDER BY created_at ASC, id ASC').bind(owner).all(); return data.results.map(decode); },
  async get(owner,id) { return decode(await binding.prepare('SELECT * FROM character_drafts WHERE owner_id = ? AND id = ?').bind(owner,await storageId(owner,id)).first()); },
  async create(owner,id,document) { const now=new Date().toISOString();await binding.prepare('INSERT INTO character_drafts (id, owner_id, document, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id,owner,JSON.stringify(document),now,now).run(); return this.get(owner,id); },
  async save(owner,id,version,document) {
   const storedId=await storageId(owner,id),sample=seeds.some(seed=>seed.id===id),doc=sample?{...document,sampleId:id}:document,now=new Date().toISOString();
   if(sample&&version===0)return decode(await binding.prepare('INSERT INTO character_drafts (id, owner_id, document, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING *').bind(storedId,owner,JSON.stringify(doc),now,now).first());
   return decode(await binding.prepare('UPDATE character_drafts SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 RETURNING *').bind(JSON.stringify(doc),now,owner,storedId,version).first());
  },
  async listFactionProfiles(owner) {return (await binding.prepare('SELECT * FROM faction_profiles WHERE owner_id = ?').bind(owner).all()).results.map(row=>({...decodeStoredDocument(row),id:row.faction_id,version:row.version,schemaVersion:row.schema_version??supportedSchemaVersion,updatedAt:row.updated_at??null}));},
  async saveFaction(owner,id,version,document) {
   const now=new Date().toISOString();
   const statement=version===0?binding.prepare('INSERT INTO faction_profiles (owner_id, faction_id, document, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(owner_id, faction_id) DO NOTHING').bind(owner,id,JSON.stringify(document),now):binding.prepare('UPDATE faction_profiles SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND faction_id = ? AND version = ? AND schema_version = 1').bind(JSON.stringify(document),now,owner,id,version);
   const encoded=JSON.stringify(document),nameKey=document.name?document.name.normalize('NFKC').toLocaleLowerCase():'draft:'+id;
   const rename=binding.prepare('UPDATE factions SET name = ?, name_key = ? WHERE owner_id = ? AND id = ? AND EXISTS (SELECT 1 FROM faction_profiles WHERE owner_id = ? AND faction_id = ? AND version = ? AND schema_version = 1 AND document = ?)').bind(document.name,nameKey,owner,id,owner,id,version+1,encoded);
   const [result]=await binding.batch([statement,rename]);return result.meta.changes?{...document,id,version:version+1,schemaVersion:supportedSchemaVersion,updatedAt:now}:null;
  },
  async createBlankFaction(owner,id) {
   await binding.prepare('INSERT INTO factions (id, owner_id, name, name_key, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING').bind(id,owner,'','draft:'+id,new Date().toISOString()).run();
   return (await this.listFactions(owner)).find(f=>f.id===id)||null;
  },
  async listFactions(owner) { return (await binding.prepare('SELECT id, name FROM factions WHERE owner_id = ? ORDER BY name COLLATE NOCASE').bind(owner).all()).results; },
  async createFaction(owner,id,name) {
   const nameKey=name.normalize('NFKC').toLocaleLowerCase();
   await binding.prepare('INSERT INTO factions (id, owner_id, name, name_key, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING').bind(id,owner,name,nameKey,new Date().toISOString()).run();
   return await binding.prepare('SELECT id, name FROM factions WHERE owner_id = ? AND name_key = ?').bind(owner,nameKey).first();
  }
 };
}
