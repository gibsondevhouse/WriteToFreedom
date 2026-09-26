-- Private sample storage UUIDs are not a second canonical character identity.
CREATE TRIGGER `collection_members_canonical_character_insert` BEFORE INSERT ON `collection_members`
BEGIN
  SELECT CASE WHEN NEW.target_kind = 'character' AND NEW.target_id NOT IN ('claude', 'gpt', 'deepseek', 'gemini')
    AND EXISTS (SELECT 1 FROM character_drafts WHERE owner_id = NEW.owner_id AND id = NEW.target_id AND COALESCE(json_extract(document, '$.sampleId'), '') != '')
    THEN RAISE(ABORT, 'collection_members: use canonical character identity') END;
  SELECT CASE WHEN NEW.target_kind = 'note' AND length(trim(NEW.target_parent_id)) > 0
    AND NOT EXISTS (SELECT 1 FROM character_drafts AS character, json_each(character.document, '$.notes') AS note
      WHERE character.owner_id = NEW.owner_id
        AND ((character.id = NEW.target_parent_id AND COALESCE(json_extract(character.document, '$.sampleId'), '') = '')
          OR (json_extract(character.document, '$.sampleId') = NEW.target_parent_id AND NEW.target_parent_id IN ('claude', 'gpt', 'deepseek', 'gemini')))
        AND json_type(character.document, '$.notes') = 'array'
        AND CASE WHEN note.type = 'object' THEN json_extract(note.value, '$.id') END = NEW.target_id)
    THEN RAISE(ABORT, 'collection_members: invalid owner-scoped target') END;
END;
--> statement-breakpoint
-- Re-check existing typed memberships without changing identities or timestamps.
-- Invalid old links roll back this migration for explicit repair/unlinking.
INSERT INTO collection_members (owner_id, collection_id, target_kind, target_id, target_parent_id, created_at)
  SELECT owner_id, collection_id, target_kind, target_id, target_parent_id, created_at
  FROM collection_members WHERE 1 ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER `character_drafts_collection_members_restrict_delete` BEFORE DELETE ON `character_drafts`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM collection_members WHERE owner_id = OLD.owner_id AND (
    (target_kind = 'character' AND target_id = OLD.id) OR
    (target_kind = 'note' AND (target_parent_id = OLD.id OR target_parent_id = json_extract(OLD.document, '$.sampleId')))
  )) THEN RAISE(ABORT, 'character_drafts: collection memberships still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `character_drafts_collection_notes_update` BEFORE UPDATE ON `character_drafts`
WHEN CASE WHEN json_valid(NEW.document) = 1 THEN json_type(NEW.document) END = 'object'
  AND NEW.id IS OLD.id AND NEW.owner_id IS OLD.owner_id
BEGIN
  SELECT CASE WHEN COALESCE(json_extract(OLD.document, '$.sampleId'), '') = ''
    AND COALESCE(json_extract(NEW.document, '$.sampleId'), '') != ''
    AND (EXISTS (SELECT 1 FROM collection_members WHERE owner_id = OLD.owner_id AND target_kind = 'character' AND target_id = OLD.id)
      OR EXISTS (SELECT 1 FROM novel_associations WHERE owner_id = OLD.owner_id AND target_kind = 'character' AND target_id = OLD.id))
    THEN RAISE(ABORT, 'character_drafts: linked canonical identity is immutable') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM collection_members AS membership
    WHERE membership.owner_id = OLD.owner_id AND membership.target_kind = 'note'
      AND (membership.target_parent_id = OLD.id OR membership.target_parent_id = json_extract(OLD.document, '$.sampleId'))
      AND (
        (membership.target_parent_id IS NOT OLD.id AND json_extract(NEW.document, '$.sampleId') IS NOT json_extract(OLD.document, '$.sampleId')) OR
        NOT EXISTS (SELECT 1 FROM json_each(NEW.document, '$.notes') AS note
          WHERE json_type(NEW.document, '$.notes') = 'array'
            AND CASE WHEN note.type = 'object' THEN json_extract(note.value, '$.id') END = membership.target_id)
      )
  ) THEN RAISE(ABORT, 'character_drafts: collection memberships still reference these notes') END;
END;
--> statement-breakpoint
CREATE TRIGGER `factions_collection_members_restrict_delete` BEFORE DELETE ON `factions`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM collection_members WHERE owner_id = OLD.owner_id AND target_kind = 'faction' AND target_id = OLD.id) THEN RAISE(ABORT, 'factions: collection memberships still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `locations_collection_members_restrict_delete` BEFORE DELETE ON `locations`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM collection_members WHERE owner_id = OLD.owner_id AND target_kind = 'location' AND target_id = OLD.id) THEN RAISE(ABORT, 'locations: collection memberships still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `lore_entries_collection_members_restrict_delete` BEFORE DELETE ON `lore_entries`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM collection_members WHERE owner_id = OLD.owner_id AND target_kind = 'lore' AND target_id = OLD.id) THEN RAISE(ABORT, 'lore_entries: collection memberships still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `story_arcs_collection_members_restrict_delete` BEFORE DELETE ON `story_arcs`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM collection_members WHERE owner_id = OLD.owner_id AND target_kind = 'story_arc' AND target_id = OLD.id) THEN RAISE(ABORT, 'story_arcs: collection memberships still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `novels_collection_members_restrict_delete` BEFORE DELETE ON `novels`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM collection_members WHERE owner_id = OLD.owner_id AND target_kind = 'novel' AND target_id = OLD.id) THEN RAISE(ABORT, 'novels: collection memberships still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `series_collection_members_restrict_delete` BEFORE DELETE ON `series`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM collection_members WHERE owner_id = OLD.owner_id AND target_kind = 'series' AND target_id = OLD.id) THEN RAISE(ABORT, 'series: collection memberships still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `chapters_collection_members_restrict_delete` BEFORE DELETE ON `chapters`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM collection_members WHERE owner_id = OLD.owner_id AND target_kind = 'chapter' AND target_id = OLD.id) THEN RAISE(ABORT, 'chapters: collection memberships still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `scenes_collection_members_restrict_delete` BEFORE DELETE ON `scenes`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM collection_members WHERE owner_id = OLD.owner_id AND target_kind = 'scene' AND target_id = OLD.id) THEN RAISE(ABORT, 'scenes: collection memberships still reference this entity') END;
END;

-- Triggers are not modelled by Drizzle snapshots. Preserve on any table rebuild.
