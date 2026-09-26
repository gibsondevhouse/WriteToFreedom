-- Collection membership is a typed reference, separate from novel associations.
CREATE TABLE collections (
 id TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL,
 kind TEXT NOT NULL CONSTRAINT collections_kind_check CHECK (kind IN ('manual','smart')),
 document TEXT NOT NULL,
 schema_version INTEGER NOT NULL DEFAULT 1,
 version INTEGER NOT NULL DEFAULT 1,
 mutation_token TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_collections_owner_updated ON collections(owner_id,updated_at,id);
--> statement-breakpoint
CREATE TABLE collection_members (
 owner_id TEXT NOT NULL,
 collection_id TEXT NOT NULL,
 target_kind TEXT NOT NULL CONSTRAINT collection_members_target_kind_check CHECK (target_kind IN ('character','faction','location','lore','story_arc','note','novel','series','chapter','scene')),
 target_id TEXT NOT NULL,
 target_parent_id TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 PRIMARY KEY(owner_id,collection_id,target_kind,target_id,target_parent_id),
 FOREIGN KEY(collection_id) REFERENCES collections(id)
);
--> statement-breakpoint
CREATE TRIGGER collections_integrity_insert BEFORE INSERT ON collections BEGIN
 SELECT CASE WHEN typeof(NEW.id)!='text' OR length(trim(NEW.id))=0 OR typeof(NEW.owner_id)!='text' OR length(trim(NEW.owner_id))=0 THEN RAISE(ABORT,'collections: identity is required') END;
 SELECT CASE WHEN json_valid(NEW.document)=0 THEN RAISE(ABORT,'collections: invalid JSON') WHEN json_type(NEW.document)!='object' THEN RAISE(ABORT,'collections: document must be an object') END;
 SELECT CASE WHEN typeof(NEW.version)!='integer' OR NEW.version<1 OR NEW.version>9007199254740991 THEN RAISE(ABORT,'collections: invalid revision') END;
 SELECT CASE WHEN typeof(NEW.schema_version)!='integer' OR NEW.schema_version<1 OR NEW.schema_version>9007199254740991 THEN RAISE(ABORT,'collections: invalid schema version') END;
END;
--> statement-breakpoint
CREATE TRIGGER collections_integrity_update BEFORE UPDATE ON collections BEGIN
 SELECT CASE WHEN typeof(NEW.id)!='text' OR length(trim(NEW.id))=0 OR typeof(NEW.owner_id)!='text' OR length(trim(NEW.owner_id))=0 THEN RAISE(ABORT,'collections: identity is required') END;
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.owner_id IS NOT OLD.owner_id OR NEW.kind IS NOT OLD.kind THEN RAISE(ABORT,'collections: immutable identity and kind') END;
 SELECT CASE WHEN json_valid(NEW.document)=0 THEN RAISE(ABORT,'collections: invalid JSON') WHEN json_type(NEW.document)!='object' THEN RAISE(ABORT,'collections: document must be an object') END;
 SELECT CASE WHEN typeof(NEW.version)!='integer' OR NEW.version<1 OR NEW.version>9007199254740991 THEN RAISE(ABORT,'collections: invalid revision') END;
 SELECT CASE WHEN typeof(NEW.schema_version)!='integer' OR NEW.schema_version<1 OR NEW.schema_version>9007199254740991 THEN RAISE(ABORT,'collections: invalid schema version') END;
 SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.mutation_token IS NOT OLD.mutation_token OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version+1 THEN RAISE(ABORT,'collections: revision must advance exactly once') END;
END;
--> statement-breakpoint
CREATE TRIGGER collection_members_integrity_insert BEFORE INSERT ON collection_members BEGIN
 SELECT CASE WHEN typeof(NEW.owner_id)!='text' OR length(trim(NEW.owner_id))=0 OR typeof(NEW.collection_id)!='text' OR length(trim(NEW.collection_id))=0 OR typeof(NEW.target_kind)!='text' OR length(trim(NEW.target_kind))=0 THEN RAISE(ABORT,'collection_members: identity is required') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM collections WHERE id=NEW.collection_id AND owner_id=NEW.owner_id AND kind='manual') THEN RAISE(ABORT,'collection_members: invalid manual collection') END;
 SELECT CASE WHEN typeof(NEW.target_id)!='text' OR length(trim(NEW.target_id))=0 OR typeof(NEW.target_parent_id)!='text' OR (NEW.target_kind='note' AND length(trim(NEW.target_parent_id))=0) OR (NEW.target_kind!='note' AND NEW.target_parent_id!='') THEN RAISE(ABORT,'collection_members: invalid target identity') END;
 SELECT CASE WHEN
  (NEW.target_kind='character' AND NEW.target_id NOT IN ('claude','gpt','deepseek','gemini') AND NOT EXISTS(SELECT 1 FROM character_drafts WHERE owner_id=NEW.owner_id AND id=NEW.target_id AND COALESCE(json_extract(document,'$.sampleId'),'')='')) OR
  (NEW.target_kind='faction' AND NEW.target_id NOT IN ('sample-ember','sample-lantern','sample-archive','sample-horizon') AND NOT EXISTS(SELECT 1 FROM factions WHERE owner_id=NEW.owner_id AND id=NEW.target_id)) OR
  (NEW.target_kind='location' AND NEW.target_id NOT IN ('sample-kingdom','sample-capital','sample-royal-archive','sample-river-workshops','sample-buried-city') AND NOT EXISTS(SELECT 1 FROM locations WHERE owner_id=NEW.owner_id AND id=NEW.target_id)) OR
  (NEW.target_kind='lore' AND NOT EXISTS(SELECT 1 FROM lore_entries WHERE owner_id=NEW.owner_id AND id=NEW.target_id)) OR
  (NEW.target_kind='story_arc' AND NOT EXISTS(SELECT 1 FROM story_arcs WHERE owner_id=NEW.owner_id AND id=NEW.target_id)) OR
  (NEW.target_kind='novel' AND NOT EXISTS(SELECT 1 FROM novels WHERE owner_id=NEW.owner_id AND id=NEW.target_id)) OR
  (NEW.target_kind='series' AND NOT EXISTS(SELECT 1 FROM series WHERE owner_id=NEW.owner_id AND id=NEW.target_id)) OR
  (NEW.target_kind='chapter' AND NOT EXISTS(SELECT 1 FROM chapters WHERE owner_id=NEW.owner_id AND id=NEW.target_id)) OR
  (NEW.target_kind='scene' AND NOT EXISTS(SELECT 1 FROM scenes WHERE owner_id=NEW.owner_id AND id=NEW.target_id)) OR
  (NEW.target_kind='note' AND NOT EXISTS(SELECT 1 FROM character_drafts AS character,json_each(character.document,'$.notes') AS note WHERE character.owner_id=NEW.owner_id AND ((character.id=NEW.target_parent_id AND COALESCE(json_extract(character.document,'$.sampleId'),'')='') OR (json_extract(character.document,'$.sampleId')=NEW.target_parent_id AND NEW.target_parent_id IN ('claude','gpt','deepseek','gemini'))) AND json_type(character.document,'$.notes')='array' AND CASE WHEN note.type='object' THEN json_extract(note.value,'$.id') END=NEW.target_id))
 THEN RAISE(ABORT,'collection_members: invalid owner-scoped target') END;
END;
--> statement-breakpoint
CREATE TRIGGER collection_members_integrity_update BEFORE UPDATE ON collection_members BEGIN
 SELECT RAISE(ABORT,'collection_members: replace membership explicitly');
END;
--> statement-breakpoint
CREATE TRIGGER collections_restrict_delete BEFORE DELETE ON collections BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM collection_members WHERE owner_id=OLD.owner_id AND collection_id=OLD.id) THEN RAISE(ABORT,'collections: remove memberships first') END;
END;

-- Triggers are not modelled by Drizzle snapshots. Preserve on any table rebuild.
