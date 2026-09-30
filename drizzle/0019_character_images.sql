-- Portraits are owner-scoped. Two <=1 MiB BLOB rows accommodate a 2 MiB image
-- while keeping each row below D1's 2,000,000-byte limit.
CREATE TABLE `character_images` (
	`image_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`owner_id` text NOT NULL,
	`character_id` text NOT NULL,
	`content_type` text NOT NULL,
	`total_size` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`image_id`, `chunk_index`),
	CONSTRAINT "character_images_chunk_index" CHECK("character_images"."chunk_index" IN (0, 1)),
	CONSTRAINT "character_images_content_type" CHECK("character_images"."content_type" IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
	CONSTRAINT "character_images_total_size" CHECK("character_images"."total_size" BETWEEN 1 AND 2097152),
	CONSTRAINT "character_images_chunk_size" CHECK(length("character_images"."data") BETWEEN 1 AND 1048576)
);
--> statement-breakpoint
CREATE INDEX `idx_character_images_owner_character` ON `character_images` (`owner_id`,`character_id`,`image_id`);
