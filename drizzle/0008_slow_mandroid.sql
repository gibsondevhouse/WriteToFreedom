CREATE TABLE `story_arcs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_story_arcs_owner_updated` ON `story_arcs` (`owner_id`,`updated_at`);