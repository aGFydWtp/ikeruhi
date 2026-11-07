CREATE TABLE `candidate_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`dates` text NOT NULL,
	`deadline` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `create_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `date_marks` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`mark` text NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`, `date`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`answer_deadline` text,
	`status` text DEFAULT 'collecting' NOT NULL,
	`tentative_date` text,
	`tentative_until` text,
	`decided_date` text,
	`created_by` text NOT NULL,
	`group_size` integer,
	`announced_key` text,
	`announce_after` text,
	`pending_note` text,
	`deadline_nudged_at` text,
	`reminder_sent_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text,
	`user_id` text,
	`action` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`wish_text` text,
	`first_answered_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `weekday_ng` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`weekday` integer NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`, `weekday`)
);
