CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`photo_path` text NOT NULL,
	`corners` text NOT NULL,
	`draft` text,
	`round_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`run_after` integer NOT NULL,
	`locked_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_status_run_after_idx` ON `jobs` (`status`,`run_after`);--> statement-breakpoint
CREATE TABLE `player_aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`alias` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_aliases_alias_nocase_unique` ON `player_aliases` (lower("alias"));--> statement-breakpoint
CREATE INDEX `player_aliases_player_idx` ON `player_aliases` (`player_id`);--> statement-breakpoint
CREATE TABLE `player_round_stats` (
	`round_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`gross` integer NOT NULL,
	`adjusted` integer NOT NULL,
	`differential_t` integer NOT NULL,
	`index_before_t` integer,
	`index_after_t` integer NOT NULL,
	`counts_in_current` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`round_id`, `player_id`),
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `player_round_stats_player_idx` ON `player_round_stats` (`player_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_name_nocase_unique` ON `players` (lower("name"));--> statement-breakpoint
CREATE TABLE `round_holes` (
	`round_id` integer NOT NULL,
	`hole` integer NOT NULL,
	`par` integer NOT NULL,
	`stroke_index` integer NOT NULL,
	`distance` integer,
	PRIMARY KEY(`round_id`, `hole`),
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `round_players` (
	`round_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`round_id`, `player_id`),
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `round_players_player_idx` ON `round_players` (`player_id`);--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_name` text NOT NULL,
	`tees` text NOT NULL,
	`played_on` text NOT NULL,
	`created_at` integer NOT NULL,
	`photo_path` text
);
--> statement-breakpoint
CREATE INDEX `rounds_played_on_idx` ON `rounds` (`played_on`,`created_at`);--> statement-breakpoint
CREATE TABLE `scores` (
	`round_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`hole` integer NOT NULL,
	`strokes` integer NOT NULL,
	PRIMARY KEY(`round_id`, `player_id`, `hole`),
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
