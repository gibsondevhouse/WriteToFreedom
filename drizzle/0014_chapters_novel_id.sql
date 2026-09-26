ALTER TABLE `chapters` ADD COLUMN `novel_id` text;
--> statement-breakpoint
CREATE INDEX `idx_chapters_novel` ON `chapters` (`novel_id`);
