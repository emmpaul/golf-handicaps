CREATE TABLE `course_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_name` text NOT NULL,
	`tees` text NOT NULL,
	`rating_t` integer,
	`slope` integer,
	`source` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`sgt_course_id` integer,
	`sgt_course_name` text,
	`sgt_course_location` text,
	`candidates` text,
	`tees_read` text,
	`proposed_tee` text,
	`note` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_ratings_course_tees_unique` ON `course_ratings` (lower(trim("course_name")),lower(trim("tees")));