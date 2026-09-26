CREATE TABLE `novel_associations` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `novel_id` text NOT NULL,
  `target_kind` text NOT NULL,
  `target_id` text NOT NULL,
  `relation_kind` text DEFAULT 'appears_in' NOT NULL,
  `prose` text DEFAULT '' NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_novel_assoc_owner_novel_target` ON `novel_associations` (`owner_id`, `novel_id`, `target_kind`, `target_id`);
--> statement-breakpoint
CREATE INDEX `idx_novel_assoc_owner_target` ON `novel_associations` (`owner_id`, `target_kind`, `target_id`);
--> statement-breakpoint
CREATE TRIGGER `novel_associations_integrity_insert` BEFORE INSERT ON `novel_associations`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 OR typeof(NEW.novel_id) != 'text' OR length(trim(NEW.novel_id)) = 0 OR typeof(NEW.target_kind) != 'text' OR length(trim(NEW.target_kind)) = 0 OR typeof(NEW.target_id) != 'text' OR length(trim(NEW.target_id)) = 0 THEN RAISE(ABORT, 'novel_associations: identity is required') END;
  SELECT CASE WHEN NEW.relation_kind NOT IN ('appears_in', 'referenced_by', 'linked') THEN RAISE(ABORT, 'novel_associations: invalid relation kind') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'novel_associations: invalid revision') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM novels WHERE id = NEW.novel_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'novel_associations: novel must belong to the same owner') END;
END;
--> statement-breakpoint
CREATE TRIGGER `novel_associations_integrity_update` BEFORE UPDATE ON `novel_associations`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 OR typeof(NEW.novel_id) != 'text' OR length(trim(NEW.novel_id)) = 0 OR typeof(NEW.target_kind) != 'text' OR length(trim(NEW.target_kind)) = 0 OR typeof(NEW.target_id) != 'text' OR length(trim(NEW.target_id)) = 0 THEN RAISE(ABORT, 'novel_associations: identity is required') END;
  SELECT CASE WHEN NEW.relation_kind NOT IN ('appears_in', 'referenced_by', 'linked') THEN RAISE(ABORT, 'novel_associations: invalid relation kind') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'novel_associations: invalid revision') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.id IS NOT OLD.id OR NEW.novel_id IS NOT OLD.novel_id OR NEW.target_kind IS NOT OLD.target_kind OR NEW.target_id IS NOT OLD.target_id THEN RAISE(ABORT, 'novel_associations: immutable identity') END;
  SELECT CASE WHEN (NEW.prose IS NOT OLD.prose OR NEW.relation_kind IS NOT OLD.relation_kind OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'novel_associations: revision must advance exactly once') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM novels WHERE id = NEW.novel_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'novel_associations: novel must belong to the same owner') END;
END;
--> statement-breakpoint
CREATE TABLE `owner_default_novels` (
  `owner_id` text PRIMARY KEY NOT NULL,
  `novel_id` text NOT NULL,
  FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`)
);
--> statement-breakpoint
CREATE TRIGGER `owner_default_novels_integrity_insert` BEFORE INSERT ON `owner_default_novels`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.novel_id) != 'text' OR length(trim(NEW.novel_id)) = 0 THEN RAISE(ABORT, 'owner_default_novels: identity is required') END;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM owner_default_novels WHERE owner_id = NEW.owner_id AND novel_id IS NOT NEW.novel_id) THEN RAISE(ABORT, 'owner_default_novels: immutable identity') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM novels WHERE id = NEW.novel_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'owner_default_novels: novel must belong to the same owner') END;
END;
--> statement-breakpoint
CREATE TRIGGER `owner_default_novels_integrity_update` BEFORE UPDATE ON `owner_default_novels`
BEGIN
  SELECT RAISE(ABORT, 'owner_default_novels: immutable identity');
END;
--> statement-breakpoint
CREATE TRIGGER `owner_default_novels_integrity_delete` BEFORE DELETE ON `owner_default_novels`
BEGIN
  SELECT RAISE(ABORT, 'owner_default_novels: immutable identity');
END;
--> statement-breakpoint
CREATE TRIGGER `chapters_novel_insert` BEFORE INSERT ON `chapters`
BEGIN
  SELECT CASE WHEN NEW.novel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM novels WHERE id = NEW.novel_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'chapters: novel must belong to the same owner') END;
END;
--> statement-breakpoint
CREATE TRIGGER `chapters_novel_update` BEFORE UPDATE ON `chapters`
BEGIN
  SELECT CASE WHEN NEW.novel_id IS NULL AND OLD.novel_id IS NOT NULL THEN RAISE(ABORT, 'chapters: novel is required') END;
  SELECT CASE WHEN NEW.owner_id IS OLD.owner_id AND NEW.id IS OLD.id AND NEW.novel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM novels WHERE id = NEW.novel_id AND owner_id = NEW.owner_id) THEN RAISE(ABORT, 'chapters: novel must belong to the same owner') END;
END;
--> statement-breakpoint
CREATE TRIGGER `chapters_default_novel_insert` AFTER INSERT ON `chapters` WHEN NEW.novel_id IS NULL
BEGIN
  INSERT OR IGNORE INTO owner_default_novels (owner_id, novel_id)
    SELECT NEW.owner_id, id FROM novels
    WHERE owner_id = NEW.owner_id AND json_extract(document, '$.title') = 'Imported manuscript'
      AND NOT EXISTS (SELECT 1 FROM owner_default_novels WHERE owner_id = NEW.owner_id)
    ORDER BY created_at, id LIMIT 1;
  INSERT INTO novels (id, owner_id, document, schema_version, version, created_at, updated_at)
    SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
      NEW.owner_id,
      '{"title":"Imported manuscript","status":"drafting","synopsis":"","coverUrl":"","seriesId":"","seriesOrder":0,"hiddenFields":[]}',
      1, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE NOT EXISTS (SELECT 1 FROM owner_default_novels WHERE owner_id = NEW.owner_id);
  INSERT OR IGNORE INTO owner_default_novels (owner_id, novel_id)
    SELECT NEW.owner_id, id FROM novels
    WHERE owner_id = NEW.owner_id AND json_extract(document, '$.title') = 'Imported manuscript'
      AND NOT EXISTS (SELECT 1 FROM owner_default_novels WHERE owner_id = NEW.owner_id)
    ORDER BY created_at DESC, id LIMIT 1;
  UPDATE chapters SET novel_id = (SELECT novel_id FROM owner_default_novels WHERE owner_id = NEW.owner_id)
    WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER `novels_restrict_references_delete` BEFORE DELETE ON `novels`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM chapters WHERE novel_id = OLD.id)
    OR EXISTS (SELECT 1 FROM novel_associations WHERE novel_id = OLD.id)
    OR EXISTS (SELECT 1 FROM owner_default_novels WHERE novel_id = OLD.id)
    THEN RAISE(ABORT, 'novels: references still depend on this novel') END;
END;

-- Triggers not modelled by Drizzle. Preserve on any table rebuild.
