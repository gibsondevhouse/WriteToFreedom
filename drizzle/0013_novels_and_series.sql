CREATE TABLE `novels` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `document` text NOT NULL,
  `schema_version` integer DEFAULT 1 NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_novels_owner_updated` ON `novels` (`owner_id`, `updated_at`);
--> statement-breakpoint
CREATE TABLE `series` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `document` text NOT NULL,
  `schema_version` integer DEFAULT 1 NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_series_owner_updated` ON `series` (`owner_id`, `updated_at`);
--> statement-breakpoint
CREATE TRIGGER `novels_integrity_insert` BEFORE INSERT ON `novels`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'novels: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'novels: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'novels: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'novels: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'novels: invalid schema version') END;
END;
--> statement-breakpoint
CREATE TRIGGER `novels_integrity_update` BEFORE UPDATE ON `novels`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'novels: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'novels: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'novels: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'novels: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'novels: invalid schema version') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.id IS NOT OLD.id THEN RAISE(ABORT, 'novels: immutable identity') END;
  SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'novels: revision must advance exactly once') END;
END;
--> statement-breakpoint
CREATE TRIGGER `series_integrity_insert` BEFORE INSERT ON `series`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'series: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'series: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'series: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'series: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'series: invalid schema version') END;
END;
--> statement-breakpoint
CREATE TRIGGER `series_integrity_update` BEFORE UPDATE ON `series`
BEGIN
  SELECT CASE WHEN typeof(NEW.owner_id) != 'text' OR length(trim(NEW.owner_id)) = 0 OR typeof(NEW.id) != 'text' OR length(trim(NEW.id)) = 0 THEN RAISE(ABORT, 'series: identity is required') END;
  SELECT CASE WHEN json_valid(NEW.document) = 0 THEN RAISE(ABORT, 'series: invalid JSON') WHEN json_type(NEW.document) != 'object' THEN RAISE(ABORT, 'series: document must be an object') END;
  SELECT CASE WHEN typeof(NEW.version) != 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991 THEN RAISE(ABORT, 'series: invalid revision') END;
  SELECT CASE WHEN typeof(NEW.schema_version) != 'integer' OR NEW.schema_version < 1 OR NEW.schema_version > 9007199254740991 THEN RAISE(ABORT, 'series: invalid schema version') END;
  SELECT CASE WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.id IS NOT OLD.id THEN RAISE(ABORT, 'series: immutable identity') END;
  SELECT CASE WHEN (NEW.document IS NOT OLD.document OR NEW.schema_version IS NOT OLD.schema_version OR NEW.version IS NOT OLD.version) AND NEW.version IS NOT OLD.version + 1 THEN RAISE(ABORT, 'series: revision must advance exactly once') END;
END;

-- Triggers are not modelled by Drizzle snapshots. Preserve on any table rebuild.
