import { normalizeCharacter } from '../public/characters/template.js';
import { characters as seeds } from '../public/characters/data.js';
async function storageId(owner,id) {
 if(!seeds.some(seed=>seed.id===id))return id;
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(['sample-character',owner,id]))))).slice(0,16);
 hash[6]=(hash[6]&15)|64;hash[8]=(hash[8]&63)|128;
 const hex=hash.map(b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function repository(binding) {
 if (!binding) throw new Error('Character storage is unavailable.');
 const decode = row => {if(!row)return null;const doc=normalizeCharacter(JSON.parse(row.document));return {...doc,id:doc.sampleId||row.id,version:row.version,createdAt:row.created_at,updatedAt:row.updated_at};};
 return {
  async listCityProfiles(owner) {return (await binding.prepare('SELECT * FROM city_profiles WHERE owner_id = ?').bind(owner).all()).results.map(row=>({...JSON.parse(row.document),id:row.location_id,version:row.version}));},
  async saveCity(owner,id,version,document) {
   const encoded=JSON.stringify(document),now=new Date().toISOString();
   const write=version===0?binding.prepare('INSERT INTO city_profiles (owner_id, location_id, document, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(owner_id, location_id) DO NOTHING').bind(owner,id,encoded,now):binding.prepare('UPDATE city_profiles SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND location_id = ? AND version = ?').bind(encoded,now,owner,id,version);
   const rename=binding.prepare('UPDATE locations SET name = ?, parent_id = ? WHERE owner_id = ? AND id = ? AND type = ? AND EXISTS (SELECT 1 FROM city_profiles WHERE owner_id = ? AND location_id = ? AND version = ? AND document = ?)').bind(document.name,document.parentId,owner,id,'city',owner,id,version+1,encoded);
   const [result]=await binding.batch([write,rename]);return result.meta.changes?{...document,id,version:version+1}:null;
  },
  async listCountryProfiles(owner) {return (await binding.prepare('SELECT * FROM country_profiles WHERE owner_id = ?').bind(owner).all()).results.map(row=>({...JSON.parse(row.document),id:row.location_id,version:row.version}));},
  async saveCountry(owner,id,version,document) {
   const encoded=JSON.stringify(document),now=new Date().toISOString();
   const write=version===0?binding.prepare('INSERT INTO country_profiles (owner_id, location_id, document, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(owner_id, location_id) DO NOTHING').bind(owner,id,encoded,now):binding.prepare('UPDATE country_profiles SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND location_id = ? AND version = ?').bind(encoded,now,owner,id,version);
   const rename=binding.prepare('UPDATE locations SET name = ?, parent_id = ? WHERE owner_id = ? AND id = ? AND type = ? AND EXISTS (SELECT 1 FROM country_profiles WHERE owner_id = ? AND location_id = ? AND version = ? AND document = ?)').bind(document.name,document.parentId||null,owner,id,'country',owner,id,version+1,encoded);
   const [result]=await binding.batch([write,rename]);return result.meta.changes?{...document,id,version:version+1}:null;
  },
  async listLocationDetails(owner) {return (await binding.prepare('SELECT * FROM location_details WHERE owner_id = ?').bind(owner).all()).results.map(row=>({...JSON.parse(row.document),id:row.location_id,version:row.version}));},
  async saveLocationDetails(owner,id,version,document) {
   const encoded=JSON.stringify(document);
   const write=version===0?binding.prepare('INSERT INTO location_details (owner_id, location_id, document, version) VALUES (?, ?, ?, 1) ON CONFLICT(owner_id, location_id) DO NOTHING').bind(owner,id,encoded):binding.prepare('UPDATE location_details SET document = ?, version = version + 1 WHERE owner_id = ? AND location_id = ? AND version = ?').bind(encoded,owner,id,version);
   const rename=binding.prepare('UPDATE locations SET name = ?, parent_id = ? WHERE owner_id = ? AND id = ? AND EXISTS (SELECT 1 FROM location_details WHERE owner_id = ? AND location_id = ? AND version = ? AND document = ?)').bind(document.name,document.parentId,owner,id,owner,id,version+1,encoded);
   const [result]=await binding.batch([write,rename]);return result.meta.changes?{...document,id,version:version+1}:null;
  },
  async listLocations(owner) {return (await binding.prepare('SELECT id, name, type, parent_id AS parentId FROM locations WHERE owner_id = ? ORDER BY created_at, rowid').bind(owner).all()).results;},
  async createLocation(owner,location) {
   const insert=binding.prepare('INSERT INTO locations (id, owner_id, name, type, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(location.id,owner,location.name,location.type,location.parentId,new Date().toISOString());
   if(location.type==='area'){
    const details=binding.prepare('INSERT INTO location_details (owner_id, location_id, document, version) SELECT ?, ?, ?, 1 WHERE EXISTS (SELECT 1 FROM locations WHERE id = ? AND owner_id = ? AND type = ?) ON CONFLICT(owner_id, location_id) DO NOTHING').bind(owner,location.id,JSON.stringify({name:location.name,parentId:location.parentId,areaType:location.areaType}),location.id,owner,'area');
    await binding.batch([insert,details]);
   }else await insert.run();
   return await binding.prepare('SELECT id, name, type, parent_id AS parentId FROM locations WHERE owner_id = ? AND id = ?').bind(owner,location.id).first();
  },
  async list(owner) { const data = await binding.prepare('SELECT * FROM character_drafts WHERE owner_id = ? ORDER BY created_at ASC, id ASC').bind(owner).all(); return data.results.map(decode); },
  async get(owner,id) { return decode(await binding.prepare('SELECT * FROM character_drafts WHERE owner_id = ? AND id = ?').bind(owner,await storageId(owner,id)).first()); },
  async create(owner,id,document) { const now=new Date().toISOString();await binding.prepare('INSERT INTO character_drafts (id, owner_id, document, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id,owner,JSON.stringify(document),now,now).run(); return this.get(owner,id); },
  async save(owner,id,version,document) {
   const storedId=await storageId(owner,id),sample=seeds.some(seed=>seed.id===id),doc=sample?{...document,sampleId:id}:document,now=new Date().toISOString();
   if(sample&&version===0){const result=await binding.prepare('INSERT INTO character_drafts (id, owner_id, document, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(storedId,owner,JSON.stringify(doc),now,now).run();return result.meta.changes?this.get(owner,id):null;}
   const result=await binding.prepare('UPDATE character_drafts SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ?').bind(JSON.stringify(doc),now,owner,storedId,version).run();return result.meta.changes?this.get(owner,id):null;
  },
  async listFactionProfiles(owner) {return (await binding.prepare('SELECT * FROM faction_profiles WHERE owner_id = ?').bind(owner).all()).results.map(row=>({...JSON.parse(row.document),id:row.faction_id,version:row.version}));},
  async saveFaction(owner,id,version,document) {
   const statement=version===0?binding.prepare('INSERT INTO faction_profiles (owner_id, faction_id, document, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(owner_id, faction_id) DO NOTHING').bind(owner,id,JSON.stringify(document),new Date().toISOString()):binding.prepare('UPDATE faction_profiles SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND faction_id = ? AND version = ?').bind(JSON.stringify(document),new Date().toISOString(),owner,id,version);
   const encoded=JSON.stringify(document),nameKey=document.name?document.name.normalize('NFKC').toLocaleLowerCase():'draft:'+id;
   const rename=binding.prepare('UPDATE factions SET name = ?, name_key = ? WHERE owner_id = ? AND id = ? AND EXISTS (SELECT 1 FROM faction_profiles WHERE owner_id = ? AND faction_id = ? AND version = ? AND document = ?)').bind(document.name,nameKey,owner,id,owner,id,version+1,encoded);
   const [result]=await binding.batch([statement,rename]);return result.meta.changes?{...document,id,version:version+1}:null;
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
