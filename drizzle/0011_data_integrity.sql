-- Additive guards preserve existing documents and identities; no table rebuild.
-- Format versions are separate from optimistic edit revisions.
-- Triggers are not represented by Drizzle snapshots: retain these on any future rebuild.
--> statement-breakpoint
CREATE TRIGGER `character_drafts_integrity_insert` BEFORE INSERT ON `character_drafts`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'character_drafts: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'character_drafts: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'character_drafts: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'character_drafts: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'character_drafts: invalid schema version') END;
END;
--> statement-breakpoint
CREATE TRIGGER `character_drafts_integrity_update` BEFORE UPDATE ON `character_drafts`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'character_drafts: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'character_drafts: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'character_drafts: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'character_drafts: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'character_drafts: invalid schema version') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.id IS NOT OLD.id THEN RAISE(ABORT, 'character_drafts: immutable identity') END;
  SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'character_drafts: revision must advance exactly once') END;
END;
--> statement-breakpoint
CREATE TRIGGER `lore_entries_integrity_insert` BEFORE INSERT ON `lore_entries`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'lore_entries: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'lore_entries: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'lore_entries: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'lore_entries: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'lore_entries: invalid schema version') END;
END;
--> statement-breakpoint
CREATE TRIGGER `lore_entries_integrity_update` BEFORE UPDATE ON `lore_entries`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'lore_entries: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'lore_entries: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'lore_entries: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'lore_entries: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'lore_entries: invalid schema version') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.id IS NOT OLD.id THEN RAISE(ABORT, 'lore_entries: immutable identity') END;
  SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'lore_entries: revision must advance exactly once') END;
END;
--> statement-breakpoint
CREATE TRIGGER `story_arcs_integrity_insert` BEFORE INSERT ON `story_arcs`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'story_arcs: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'story_arcs: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'story_arcs: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'story_arcs: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'story_arcs: invalid schema version') END;
END;
--> statement-breakpoint
CREATE TRIGGER `story_arcs_integrity_update` BEFORE UPDATE ON `story_arcs`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'story_arcs: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'story_arcs: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'story_arcs: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'story_arcs: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'story_arcs: invalid schema version') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.id IS NOT OLD.id THEN RAISE(ABORT, 'story_arcs: immutable identity') END;
  SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'story_arcs: revision must advance exactly once') END;
END;
--> statement-breakpoint
CREATE TRIGGER `chapters_integrity_insert` BEFORE INSERT ON `chapters`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'chapters: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'chapters: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'chapters: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'chapters: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'chapters: invalid schema version') END;
END;
--> statement-breakpoint
CREATE TRIGGER `chapters_integrity_update` BEFORE UPDATE ON `chapters`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'chapters: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'chapters: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'chapters: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'chapters: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'chapters: invalid schema version') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.id IS NOT OLD.id THEN RAISE(ABORT, 'chapters: immutable identity') END;
  SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'chapters: revision must advance exactly once') END;
END;
--> statement-breakpoint
CREATE TRIGGER `scenes_integrity_insert` BEFORE INSERT ON `scenes`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'scenes: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'scenes: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'scenes: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'scenes: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'scenes: invalid schema version') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM chapters WHERE id = NEW.chapter_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'scenes: chapter must belong to the same owner') END;
  SELECT CASE WHEN json_extract(NEW.document, '$.chapterId') IS NOT NEW.chapter_id THEN RAISE(ABORT, 'scenes: conflicting chapter identity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `scenes_integrity_update` BEFORE UPDATE ON `scenes`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'scenes: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'scenes: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'scenes: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'scenes: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'scenes: invalid schema version') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.id IS NOT OLD.id THEN RAISE(ABORT, 'scenes: immutable identity') END;
  SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'scenes: revision must advance exactly once') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM chapters WHERE id = NEW.chapter_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'scenes: chapter must belong to the same owner') END;
  SELECT CASE WHEN json_extract(NEW.document, '$.chapterId') IS NOT NEW.chapter_id THEN RAISE(ABORT, 'scenes: conflicting chapter identity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `faction_profiles_integrity_insert` BEFORE INSERT ON `faction_profiles`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.faction_id) != 'text' OR length(trim(NEW.faction_id)) = 0 THEN RAISE(ABORT, 'faction_profiles: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'faction_profiles: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'faction_profiles: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'faction_profiles: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'faction_profiles: invalid schema version') END;
END;
--> statement-breakpoint
CREATE TRIGGER `faction_profiles_integrity_update` BEFORE UPDATE ON `faction_profiles`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.faction_id) != 'text' OR length(trim(NEW.faction_id)) = 0 THEN RAISE(ABORT, 'faction_profiles: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'faction_profiles: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'faction_profiles: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'faction_profiles: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'faction_profiles: invalid schema version') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.faction_id IS NOT OLD.faction_id THEN RAISE(ABORT, 'faction_profiles: immutable identity') END;
  SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'faction_profiles: revision must advance exactly once') END;
END;
--> statement-breakpoint
CREATE TRIGGER `country_profiles_integrity_insert` BEFORE INSERT ON `country_profiles`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.location_id) != 'text' OR length(trim(NEW.location_id)) = 0 THEN RAISE(ABORT, 'country_profiles: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'country_profiles: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'country_profiles: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'country_profiles: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'country_profiles: invalid schema version') END;
END;
--> statement-breakpoint
CREATE TRIGGER `country_profiles_integrity_update` BEFORE UPDATE ON `country_profiles`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.location_id) != 'text' OR length(trim(NEW.location_id)) = 0 THEN RAISE(ABORT, 'country_profiles: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'country_profiles: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'country_profiles: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'country_profiles: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'country_profiles: invalid schema version') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.location_id IS NOT OLD.location_id THEN RAISE(ABORT, 'country_profiles: immutable identity') END;
  SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'country_profiles: revision must advance exactly once') END;
END;
--> statement-breakpoint
CREATE TRIGGER `city_profiles_integrity_insert` BEFORE INSERT ON `city_profiles`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.location_id) != 'text' OR length(trim(NEW.location_id)) = 0 THEN RAISE(ABORT, 'city_profiles: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'city_profiles: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'city_profiles: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'city_profiles: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'city_profiles: invalid schema version') END;
END;
--> statement-breakpoint
CREATE TRIGGER `city_profiles_integrity_update` BEFORE UPDATE ON `city_profiles`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.location_id) != 'text' OR length(trim(NEW.location_id)) = 0 THEN RAISE(ABORT, 'city_profiles: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'city_profiles: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'city_profiles: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'city_profiles: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'city_profiles: invalid schema version') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.location_id IS NOT OLD.location_id THEN RAISE(ABORT, 'city_profiles: immutable identity') END;
  SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'city_profiles: revision must advance exactly once') END;
END;
--> statement-breakpoint
CREATE TRIGGER `location_details_integrity_insert` BEFORE INSERT ON `location_details`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.location_id) != 'text' OR length(trim(NEW.location_id)) = 0 THEN RAISE(ABORT, 'location_details: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'location_details: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'location_details: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'location_details: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'location_details: invalid schema version') END;
END;
--> statement-breakpoint
CREATE TRIGGER `location_details_integrity_update` BEFORE UPDATE ON `location_details`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.location_id) != 'text' OR length(trim(NEW.location_id)) = 0 THEN RAISE(ABORT, 'location_details: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'location_details: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'location_details: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'location_details: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'location_details: invalid schema version') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.location_id IS NOT OLD.location_id THEN RAISE(ABORT, 'location_details: immutable identity') END;
  SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'location_details: revision must advance exactly once') END;
END;
--> statement-breakpoint
CREATE TRIGGER `factions_integrity_insert` BEFORE INSERT ON `factions`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'factions: identity is required') END;
END;
--> statement-breakpoint
CREATE TRIGGER `factions_integrity_update` BEFORE UPDATE ON `factions`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'factions: identity is required') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.id IS NOT OLD.id THEN RAISE(ABORT, 'factions: immutable identity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `locations_integrity_insert` BEFORE INSERT ON `locations`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'locations: identity is required') END;
  SELECT CASE WHEN NEW.type NOT IN ('universe','galaxy','solar-system','planet','moon','continent','country','city','area','landmark') THEN RAISE(ABORT, 'locations: invalid type') END;
  SELECT CASE WHEN NEW.parent_id = NEW.id OR (NEW.type = 'universe' AND NEW.parent_id IS NOT NULL) THEN RAISE(ABORT, 'locations: invalid parent') END;
END;
--> statement-breakpoint
CREATE TRIGGER `locations_integrity_update` BEFORE UPDATE ON `locations`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'locations: identity is required') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.id IS NOT OLD.id THEN RAISE(ABORT, 'locations: immutable identity') END;
  SELECT CASE WHEN NEW.type NOT IN ('universe','galaxy','solar-system','planet','moon','continent','country','city','area','landmark') THEN RAISE(ABORT, 'locations: invalid type') END;
  SELECT CASE WHEN NEW.parent_id = NEW.id OR (NEW.type = 'universe' AND NEW.parent_id IS NOT NULL) THEN RAISE(ABORT, 'locations: invalid parent') END;
  SELECT CASE WHEN NEW.type IS NOT OLD.type THEN RAISE(ABORT, 'locations: immutable type') END;
END;
--> statement-breakpoint
CREATE TRIGGER `chapters_restrict_delete` BEFORE DELETE ON `chapters`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM scenes WHERE chapter_id = OLD.id) THEN RAISE(ABORT, 'chapters: scenes still reference this chapter') END;
END;

-- Reserved source IDs are virtual owner-local targets. Keep their identity stable.
--> statement-breakpoint
CREATE TRIGGER `locations_restrict_children_delete` BEFORE DELETE ON `locations`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM locations WHERE owner_id = OLD.owner_id AND parent_id = OLD.id)
    OR EXISTS (SELECT 1 FROM country_profiles WHERE owner_id = OLD.owner_id AND json_extract(document, '$.parentId') = OLD.id)
    OR EXISTS (SELECT 1 FROM city_profiles WHERE owner_id = OLD.owner_id AND json_extract(document, '$.parentId') = OLD.id)
    OR EXISTS (SELECT 1 FROM location_details WHERE owner_id = OLD.owner_id AND json_extract(document, '$.parentId') = OLD.id)
    THEN RAISE(ABORT, 'locations: children still reference this parent') END;
END;
--> statement-breakpoint
CREATE TRIGGER `faction_profiles_target_insert` BEFORE INSERT ON `faction_profiles`
BEGIN
  SELECT CASE WHEN NEW.faction_id NOT IN ('sample-ember','sample-lantern','sample-archive','sample-horizon') AND NOT EXISTS (SELECT 1 FROM factions WHERE id = NEW.faction_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'faction_profiles: invalid owner-scoped target') END;
END;
--> statement-breakpoint
CREATE TRIGGER `faction_profiles_target_update` BEFORE UPDATE ON `faction_profiles`
BEGIN
  SELECT CASE WHEN NEW.faction_id NOT IN ('sample-ember','sample-lantern','sample-archive','sample-horizon') AND NOT EXISTS (SELECT 1 FROM factions WHERE id = NEW.faction_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'faction_profiles: invalid owner-scoped target') END;
END;
--> statement-breakpoint
CREATE TRIGGER `faction_profiles_restrict_target_delete` BEFORE DELETE ON `factions`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM faction_profiles WHERE faction_id = OLD.id AND owner_id = OLD.owner_id) THEN RAISE(ABORT, 'factions: profile still references this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `country_profiles_target_insert` BEFORE INSERT ON `country_profiles`
BEGIN
  SELECT CASE WHEN NEW.location_id NOT IN ('sample-kingdom') AND NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.location_id AND owner_id = NEW.owner_id AND type = 'country') THEN RAISE(ABORT, 'country_profiles: invalid owner-scoped target') END;
END;
--> statement-breakpoint
CREATE TRIGGER `country_profiles_target_update` BEFORE UPDATE ON `country_profiles`
BEGIN
  SELECT CASE WHEN NEW.location_id NOT IN ('sample-kingdom') AND NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.location_id AND owner_id = NEW.owner_id AND type = 'country') THEN RAISE(ABORT, 'country_profiles: invalid owner-scoped target') END;
END;
--> statement-breakpoint
CREATE TRIGGER `country_profiles_restrict_target_delete` BEFORE DELETE ON `locations`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM country_profiles WHERE location_id = OLD.id AND owner_id = OLD.owner_id) THEN RAISE(ABORT, 'locations: profile still references this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `city_profiles_target_insert` BEFORE INSERT ON `city_profiles`
BEGIN
  SELECT CASE WHEN NEW.location_id NOT IN ('sample-capital') AND NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.location_id AND owner_id = NEW.owner_id AND type = 'city') THEN RAISE(ABORT, 'city_profiles: invalid owner-scoped target') END;
END;
--> statement-breakpoint
CREATE TRIGGER `city_profiles_target_update` BEFORE UPDATE ON `city_profiles`
BEGIN
  SELECT CASE WHEN NEW.location_id NOT IN ('sample-capital') AND NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.location_id AND owner_id = NEW.owner_id AND type = 'city') THEN RAISE(ABORT, 'city_profiles: invalid owner-scoped target') END;
END;
--> statement-breakpoint
CREATE TRIGGER `city_profiles_restrict_target_delete` BEFORE DELETE ON `locations`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM city_profiles WHERE location_id = OLD.id AND owner_id = OLD.owner_id) THEN RAISE(ABORT, 'locations: profile still references this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `location_details_target_insert` BEFORE INSERT ON `location_details`
BEGIN
  SELECT CASE WHEN NEW.location_id NOT IN ('sample-royal-archive','sample-river-workshops','sample-buried-city') AND NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.location_id AND owner_id = NEW.owner_id AND type NOT IN ('country','city')) THEN RAISE(ABORT, 'location_details: invalid owner-scoped target') END;
END;
--> statement-breakpoint
CREATE TRIGGER `location_details_target_update` BEFORE UPDATE ON `location_details`
BEGIN
  SELECT CASE WHEN NEW.location_id NOT IN ('sample-royal-archive','sample-river-workshops','sample-buried-city') AND NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.location_id AND owner_id = NEW.owner_id AND type NOT IN ('country','city')) THEN RAISE(ABORT, 'location_details: invalid owner-scoped target') END;
END;
--> statement-breakpoint
CREATE TRIGGER `location_details_restrict_target_delete` BEFORE DELETE ON `locations`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM location_details WHERE location_id = OLD.id AND owner_id = OLD.owner_id) THEN RAISE(ABORT, 'locations: profile still references this entity') END;
END;

--> statement-breakpoint
CREATE TRIGGER `locations_parent_insert` BEFORE INSERT ON `locations`
BEGIN
  SELECT CASE WHEN NEW.type IN ('city','area','landmark') AND NEW.parent_id IS NULL THEN RAISE(ABORT, 'locations: invalid parent') END;
  SELECT CASE WHEN NEW.parent_id IS NOT NULL AND NOT (
    (NEW.parent_id = 'sample-kingdom' AND NEW.type = 'city')
    OR (NEW.parent_id = 'sample-capital' AND NEW.type IN ('area','landmark'))
    OR EXISTS (SELECT 1 FROM locations AS parent WHERE parent.id = NEW.parent_id AND parent.owner_id = NEW.owner_id AND (
      (NEW.type = 'galaxy' AND parent.type IN ('universe')) OR
      (NEW.type = 'solar-system' AND parent.type IN ('galaxy')) OR
      (NEW.type = 'planet' AND parent.type IN ('solar-system')) OR
      (NEW.type = 'moon' AND parent.type IN ('planet')) OR
      (NEW.type = 'continent' AND parent.type IN ('planet','moon')) OR
      (NEW.type = 'country' AND parent.type IN ('continent','planet','moon')) OR
      (NEW.type = 'city' AND parent.type IN ('country')) OR
      (NEW.type = 'area' AND parent.type IN ('city','area')) OR
      (NEW.type = 'landmark' AND parent.type IN ('city','area'))
    ))
  ) THEN RAISE(ABORT, 'locations: invalid parent') END;
  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE lineage(id) AS (
      SELECT NEW.parent_id WHERE NEW.parent_id IS NOT NULL
      UNION
      SELECT parent.parent_id FROM locations AS parent JOIN lineage ON parent.id = lineage.id WHERE parent.owner_id = NEW.owner_id AND parent.parent_id IS NOT NULL
    )
    SELECT 1 FROM lineage WHERE id = NEW.id
  ) THEN RAISE(ABORT, 'locations: hierarchy cycle') END;
END;

--> statement-breakpoint
CREATE TRIGGER `locations_parent_update` BEFORE UPDATE ON `locations`
BEGIN
  SELECT CASE WHEN NEW.type IN ('city','area','landmark') AND NEW.parent_id IS NULL THEN RAISE(ABORT, 'locations: invalid parent') END;
  SELECT CASE WHEN NEW.parent_id IS NOT NULL AND NOT (
    (NEW.parent_id = 'sample-kingdom' AND NEW.type = 'city')
    OR (NEW.parent_id = 'sample-capital' AND NEW.type IN ('area','landmark'))
    OR EXISTS (SELECT 1 FROM locations AS parent WHERE parent.id = NEW.parent_id AND parent.owner_id = NEW.owner_id AND (
      (NEW.type = 'galaxy' AND parent.type IN ('universe')) OR
      (NEW.type = 'solar-system' AND parent.type IN ('galaxy')) OR
      (NEW.type = 'planet' AND parent.type IN ('solar-system')) OR
      (NEW.type = 'moon' AND parent.type IN ('planet')) OR
      (NEW.type = 'continent' AND parent.type IN ('planet','moon')) OR
      (NEW.type = 'country' AND parent.type IN ('continent','planet','moon')) OR
      (NEW.type = 'city' AND parent.type IN ('country')) OR
      (NEW.type = 'area' AND parent.type IN ('city','area')) OR
      (NEW.type = 'landmark' AND parent.type IN ('city','area'))
    ))
  ) THEN RAISE(ABORT, 'locations: invalid parent') END;
  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE lineage(id) AS (
      SELECT NEW.parent_id WHERE NEW.parent_id IS NOT NULL
      UNION
      SELECT parent.parent_id FROM locations AS parent JOIN lineage ON parent.id = lineage.id WHERE parent.owner_id = NEW.owner_id AND parent.parent_id IS NOT NULL
    )
    SELECT 1 FROM lineage WHERE id = NEW.id
  ) THEN RAISE(ABORT, 'locations: hierarchy cycle') END;
END;
