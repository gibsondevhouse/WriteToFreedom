CREATE TABLE `location_details` (
	`owner_id` text NOT NULL,
	`location_id` text NOT NULL,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_location_details_owner_location` ON `location_details` (`owner_id`,`location_id`);