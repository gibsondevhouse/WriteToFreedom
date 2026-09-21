CREATE TABLE `city_profiles` (
	`owner_id` text NOT NULL,
	`location_id` text NOT NULL,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_city_profiles_owner_location` ON `city_profiles` (`owner_id`,`location_id`);