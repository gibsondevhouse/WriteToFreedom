import { normalizeCharacter } from '../public/characters/template.js';
export function repository(binding) {
 if (!binding) throw new Error('Character storage is unavailable.');
 const decode = row => row ? {...normalizeCharacter(JSON.parse(row.document)), id:row.id, version:row.version, createdAt:row.created_at, updatedAt:row.updated_at} : null;
 return {
  async list(owner) { const data = await binding.prepare('SELECT * FROM character_drafts WHERE owner_id = ? ORDER BY created_at ASC, id ASC').bind(owner).all(); return data.results.map(decode); },
  async get(owner,id) { return decode(await binding.prepare('SELECT * FROM character_drafts WHERE owner_id = ? AND id = ?').bind(owner,id).first()); },
  async create(owner,id,document) { const now=new Date().toISOString();await binding.prepare('INSERT INTO character_drafts (id, owner_id, document, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id,owner,JSON.stringify(document),now,now).run(); return this.get(owner,id); },
  async save(owner,id,version,document) { const result=await binding.prepare('UPDATE character_drafts SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ?').bind(JSON.stringify(document),new Date().toISOString(),owner,id,version).run(); return result.meta.changes ? this.get(owner,id) : null; },
  async listFactions(owner) { return (await binding.prepare('SELECT id, name FROM factions WHERE owner_id = ? ORDER BY name COLLATE NOCASE').bind(owner).all()).results; },
  async createFaction(owner,id,name) {
   const nameKey=name.normalize('NFKC').toLocaleLowerCase();
   await binding.prepare('INSERT INTO factions (id, owner_id, name, name_key, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING').bind(id,owner,name,nameKey,new Date().toISOString()).run();
   return await binding.prepare('SELECT id, name FROM factions WHERE owner_id = ? AND name_key = ?').bind(owner,nameKey).first();
  }
 };
}
