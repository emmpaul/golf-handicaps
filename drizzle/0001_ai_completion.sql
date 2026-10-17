CREATE TABLE `ai_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`month` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cost_micro_usd` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `imports` ADD `ai_cells` text;--> statement-breakpoint
ALTER TABLE `imports` ADD `ai_note` text;