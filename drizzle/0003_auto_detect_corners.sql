PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`photo_path` text NOT NULL,
	`corners` text,
	`draft` text,
	`round_id` integer,
	`created_at` integer NOT NULL,
	`ai_cells` text,
	`ai_note` text,
	`correction` text,
	`corners_source` text,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_imports`("id", "status", "photo_path", "corners", "draft", "round_id", "created_at", "ai_cells", "ai_note", "correction") SELECT "id", "status", "photo_path", "corners", "draft", "round_id", "created_at", "ai_cells", "ai_note", "correction" FROM `imports`;--> statement-breakpoint
DROP TABLE `imports`;--> statement-breakpoint
ALTER TABLE `__new_imports` RENAME TO `imports`;--> statement-breakpoint
PRAGMA foreign_keys=ON;