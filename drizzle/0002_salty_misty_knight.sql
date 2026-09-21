CREATE TABLE `faction_profiles` (
	`owner_id` text NOT NULL,
	`faction_id` text NOT NULL,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_faction_profiles_owner_faction` ON `faction_profiles` (`owner_id`,`faction_id`);