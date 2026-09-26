-- D1 and the local runner apply each migration file atomically. Do not embed a
-- nested transaction here. Only chapter novel_id is transformed; documents,
-- identities, edit revisions, timestamps, and manuscript order stay untouched.
INSERT INTO owner_default_novels (owner_id, novel_id)
  SELECT owners.owner_id, (
    SELECT id FROM novels WHERE owner_id = owners.owner_id
      AND json_extract(document, '$.title') = 'Imported manuscript'
    ORDER BY created_at, id LIMIT 1
  )
  FROM (SELECT DISTINCT owner_id FROM chapters WHERE novel_id IS NULL) AS owners
  WHERE NOT EXISTS (SELECT 1 FROM owner_default_novels WHERE owner_id = owners.owner_id)
    AND EXISTS (SELECT 1 FROM novels WHERE owner_id = owners.owner_id
      AND json_extract(document, '$.title') = 'Imported manuscript');
--> statement-breakpoint
INSERT INTO novels (id, owner_id, document, schema_version, version, created_at, updated_at)
  SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
    owners.owner_id,
    '{"title":"Imported manuscript","status":"drafting","synopsis":"","coverUrl":"","seriesId":"","seriesOrder":0,"hiddenFields":[]}',
    1, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM (SELECT DISTINCT owner_id FROM chapters WHERE novel_id IS NULL) AS owners
  WHERE NOT EXISTS (SELECT 1 FROM owner_default_novels WHERE owner_id = owners.owner_id);
--> statement-breakpoint
INSERT INTO owner_default_novels (owner_id, novel_id)
  SELECT owners.owner_id, (
    SELECT id FROM novels WHERE owner_id = owners.owner_id
      AND json_extract(document, '$.title') = 'Imported manuscript'
    ORDER BY created_at, id LIMIT 1
  )
  FROM (SELECT DISTINCT owner_id FROM chapters WHERE novel_id IS NULL) AS owners
  WHERE NOT EXISTS (SELECT 1 FROM owner_default_novels WHERE owner_id = owners.owner_id);
--> statement-breakpoint
UPDATE chapters SET novel_id = (
  SELECT novel_id FROM owner_default_novels WHERE owner_id = chapters.owner_id
) WHERE novel_id IS NULL;
--> statement-breakpoint
DROP TRIGGER `chapters_novel_update`;
--> statement-breakpoint
CREATE TRIGGER `chapters_novel_update` BEFORE UPDATE ON `chapters`
BEGIN
  SELECT CASE WHEN NEW.novel_id IS NULL THEN RAISE(ABORT, 'chapters: novel is required') END;
  SELECT CASE WHEN NEW.owner_id IS OLD.owner_id AND NEW.id IS OLD.id AND NOT EXISTS (SELECT 1 FROM novels WHERE id = NEW.novel_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'chapters: novel must belong to the same owner') END;
END;
--> statement-breakpoint
DROP TRIGGER `novel_associations_integrity_insert`;
--> statement-breakpoint
CREATE TRIGGER `novel_associations_integrity_insert` BEFORE INSERT ON `novel_associations`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 OR typeof(NEW.novel_id) != 'text' OR length(trim(NEW.novel_id)) = 0 OR typeof(NEW.target_kind) != 'text' OR length(trim(NEW.target_kind)) = 0 OR typeof(NEW.target_id) != 'text' OR length(trim(NEW.target_id)) = 0 THEN RAISE(ABORT, 'novel_associations: identity is required') END;
  SELECT CASE WHEN NEW.relation_kind NOT IN ('appears_in', 'referenced_by', 'linked') THEN RAISE(ABORT, 'novel_associations: invalid relation kind') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'novel_associations: invalid revision') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM novels WHERE id = NEW.novel_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'novel_associations: novel must belong to the same owner') END;
  SELECT CASE WHEN NEW.target_kind NOT IN ('character', 'faction', 'location', 'lore', 'story_arc') THEN RAISE(ABORT, 'novel_associations: invalid target kind') END;
  SELECT CASE WHEN
    (NEW.target_kind = 'character' AND NEW.target_id NOT IN ('claude', 'gpt', 'deepseek', 'gemini') AND NOT EXISTS (SELECT 1 FROM character_drafts WHERE id = NEW.target_id AND owner_id = NEW.owner_id AND COALESCE(json_extract(document, '$.sampleId'), '') = '')) OR
    (NEW.target_kind = 'faction' AND NEW.target_id NOT IN ('sample-ember', 'sample-lantern', 'sample-archive', 'sample-horizon') AND NOT EXISTS (SELECT 1 FROM factions WHERE id = NEW.target_id AND owner_id = NEW.owner_id)) OR
    (NEW.target_kind = 'location' AND NEW.target_id NOT IN ('sample-kingdom', 'sample-capital', 'sample-royal-archive', 'sample-river-workshops', 'sample-buried-city') AND NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.target_id AND owner_id = NEW.owner_id)) OR
    (NEW.target_kind = 'lore' AND NOT EXISTS (SELECT 1 FROM lore_entries WHERE id = NEW.target_id AND owner_id = NEW.owner_id)) OR
    (NEW.target_kind = 'story_arc' AND NOT EXISTS (SELECT 1 FROM story_arcs WHERE id = NEW.target_id AND owner_id = NEW.owner_id))
    THEN RAISE(ABORT, 'novel_associations: invalid owner-scoped target') END;
END;
--> statement-breakpoint
DROP TRIGGER `novel_associations_integrity_update`;
--> statement-breakpoint
CREATE TRIGGER `novel_associations_integrity_update` BEFORE UPDATE ON `novel_associations`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 OR typeof(NEW.novel_id) != 'text' OR length(trim(NEW.novel_id)) = 0 OR typeof(NEW.target_kind) != 'text' OR length(trim(NEW.target_kind)) = 0 OR typeof(NEW.target_id) != 'text' OR length(trim(NEW.target_id)) = 0 THEN RAISE(ABORT, 'novel_associations: identity is required') END;
  SELECT CASE WHEN NEW.relation_kind NOT IN ('appears_in', 'referenced_by', 'linked') THEN RAISE(ABORT, 'novel_associations: invalid relation kind') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'novel_associations: invalid revision') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.id IS NOT OLD.id OR NEW.novel_id IS NOT OLD.novel_id OR NEW.target_kind IS NOT OLD.target_kind OR NEW.target_id IS NOT OLD.target_id THEN RAISE(ABORT, 'novel_associations: immutable identity') END;
  SELECT CASE WHEN (NEW.prose IS NOT OLD.prose OR NEW.relation_kind IS NOT OLD.relation_kind OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'novel_associations: revision must advance exactly once') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM novels WHERE id = NEW.novel_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'novel_associations: novel must belong to the same owner') END;
  SELECT CASE WHEN NEW.target_kind NOT IN ('character', 'faction', 'location', 'lore', 'story_arc') THEN RAISE(ABORT, 'novel_associations: invalid target kind') END;
  SELECT CASE WHEN
    (NEW.target_kind = 'character' AND NEW.target_id NOT IN ('claude', 'gpt', 'deepseek', 'gemini') AND NOT EXISTS (SELECT 1 FROM character_drafts WHERE id = NEW.target_id AND owner_id = NEW.owner_id AND COALESCE(json_extract(document, '$.sampleId'), '') = '')) OR
    (NEW.target_kind = 'faction' AND NEW.target_id NOT IN ('sample-ember', 'sample-lantern', 'sample-archive', 'sample-horizon') AND NOT EXISTS (SELECT 1 FROM factions WHERE id = NEW.target_id AND owner_id = NEW.owner_id)) OR
    (NEW.target_kind = 'location' AND NEW.target_id NOT IN ('sample-kingdom', 'sample-capital', 'sample-royal-archive', 'sample-river-workshops', 'sample-buried-city') AND NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.target_id AND owner_id = NEW.owner_id)) OR
    (NEW.target_kind = 'lore' AND NOT EXISTS (SELECT 1 FROM lore_entries WHERE id = NEW.target_id AND owner_id = NEW.owner_id)) OR
    (NEW.target_kind = 'story_arc' AND NOT EXISTS (SELECT 1 FROM story_arcs WHERE id = NEW.target_id AND owner_id = NEW.owner_id))
    THEN RAISE(ABORT, 'novel_associations: invalid owner-scoped target') END;
END;
--> statement-breakpoint
-- Check legacy associations using the new guards without changing their bytes
-- or revisions. Invalid legacy links roll back the migration for repair.
UPDATE novel_associations SET prose = prose;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `character_drafts_novel_associations_restrict_delete` BEFORE DELETE ON `character_drafts`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM novel_associations WHERE owner_id = OLD.owner_id AND target_kind = 'character' AND target_id = OLD.id) THEN RAISE(ABORT, 'character_drafts: novel associations still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `factions_novel_associations_restrict_delete` BEFORE DELETE ON `factions`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM novel_associations WHERE owner_id = OLD.owner_id AND target_kind = 'faction' AND target_id = OLD.id) THEN RAISE(ABORT, 'factions: novel associations still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `locations_novel_associations_restrict_delete` BEFORE DELETE ON `locations`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM novel_associations WHERE owner_id = OLD.owner_id AND target_kind = 'location' AND target_id = OLD.id) THEN RAISE(ABORT, 'locations: novel associations still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `lore_entries_novel_associations_restrict_delete` BEFORE DELETE ON `lore_entries`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM novel_associations WHERE owner_id = OLD.owner_id AND target_kind = 'lore' AND target_id = OLD.id) THEN RAISE(ABORT, 'lore_entries: novel associations still reference this entity') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `story_arcs_novel_associations_restrict_delete` BEFORE DELETE ON `story_arcs`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM novel_associations WHERE owner_id = OLD.owner_id AND target_kind = 'story_arc' AND target_id = OLD.id) THEN RAISE(ABORT, 'story_arcs: novel associations still reference this entity') END;
END;

-- Triggers are not modelled by Drizzle snapshots. Preserve on any table rebuild.
