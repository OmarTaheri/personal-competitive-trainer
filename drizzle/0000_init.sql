CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`handle` text NOT NULL,
	`rating` integer,
	`last_synced_at` integer,
	`last_status` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_platform` ON `accounts` (`platform`);--> statement-breakpoint
CREATE TABLE `attempt_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`storage_key` text NOT NULL,
	`caption` text
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`problem_id` integer NOT NULL,
	`track_id` text,
	`is_resolve` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'plan' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`phase` text DEFAULT 'think' NOT NULL,
	`resume_phase` text,
	`phase_started_at` integer,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`think_sec` integer DEFAULT 0 NOT NULL,
	`stuck_sec` integer DEFAULT 0 NOT NULL,
	`code_sec` integer DEFAULT 0 NOT NULL,
	`help_used` text DEFAULT 'none' NOT NULL,
	`result` text,
	`felt` integer,
	`slowed_by` text DEFAULT '[]' NOT NULL,
	`key_idea` text,
	`notes` text,
	`time_ratio` real,
	`expected_min` integer
);
--> statement-breakpoint
CREATE INDEX `attempts_problem` ON `attempts` (`problem_id`);--> statement-breakpoint
CREATE INDEX `attempts_ended` ON `attempts` (`ended_at`);--> statement-breakpoint
CREATE TABLE `concept_mastery` (
	`concept_id` text PRIMARY KEY NOT NULL,
	`score` real NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_seen` integer,
	`weak` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `concepts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`group` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL,
	`start_utc` integer NOT NULL,
	`duration_sec` integer NOT NULL,
	`url` text NOT NULL,
	`joined` integer DEFAULT false NOT NULL,
	`reminded_60` integer DEFAULT false NOT NULL,
	`reminded_10` integer DEFAULT false NOT NULL,
	`upsolve_done` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contests_platform_ext` ON `contests` (`platform`,`external_id`);--> statement-breakpoint
CREATE TABLE `daily_plans` (
	`date` text PRIMARY KEY NOT NULL,
	`queue` text NOT NULL,
	`goal_min` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `problem_concepts` (
	`problem_id` integer NOT NULL,
	`concept_id` text NOT NULL,
	PRIMARY KEY(`problem_id`, `concept_id`)
);
--> statement-breakpoint
CREATE INDEX `pc_concept` ON `problem_concepts` (`concept_id`);--> statement-breakpoint
CREATE TABLE `problems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`raw_difficulty` text,
	`norm_rating` integer,
	`tags` text DEFAULT '[]' NOT NULL,
	`section` text,
	`solve_count` integer,
	`ac_rate` real,
	`paid_only` integer DEFAULT false NOT NULL,
	`video_url` text,
	`editorial_url` text,
	`contest_id` text,
	`solved` integer DEFAULT false NOT NULL,
	`solved_at` integer,
	`solved_source` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `problems_platform_ext` ON `problems` (`platform`,`external_id`);--> statement-breakpoint
CREATE INDEX `problems_rating` ON `problems` (`platform`,`norm_rating`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`problem_id` integer PRIMARY KEY NOT NULL,
	`due_date` text NOT NULL,
	`gap_days` real NOT NULL,
	`clean_streak` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`last_time_sec` integer,
	`last_attempt_id` integer,
	`reps` integer DEFAULT 0 NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `sent_notifications` (
	`key` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT 'Omar' NOT NULL,
	`timezone` text DEFAULT 'Asia/Bangkok' NOT NULL,
	`daily_goal_min` integer DEFAULT 120 NOT NULL,
	`share_neetcode` integer DEFAULT 60 NOT NULL,
	`share_codeforces` integer DEFAULT 25 NOT NULL,
	`share_cses` integer DEFAULT 15 NOT NULL,
	`hint_delay_min` integer DEFAULT 30 NOT NULL,
	`editorial_delay_min` integer DEFAULT 60 NOT NULL,
	`idle_pause_min` integer DEFAULT 10 NOT NULL,
	`resolve_cap` integer DEFAULT 3 NOT NULL,
	`show_cf_tags` integer DEFAULT false NOT NULL,
	`contest_day_factor` real DEFAULT 0.5 NOT NULL,
	`weak_every` integer DEFAULT 3 NOT NULL,
	`telegram_token` text,
	`telegram_chat_id` text,
	`clist_username` text,
	`clist_key` text,
	`leetcode_session` text,
	`leetcode_csrf` text,
	`vapid_public` text,
	`vapid_private` text,
	`atcoder_table` text,
	`codechef_table` text,
	`digest_hour` integer DEFAULT 9 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`job` text NOT NULL,
	`ok` integer NOT NULL,
	`message` text
);
--> statement-breakpoint
CREATE TABLE `topic_boosts` (
	`concept_id` text PRIMARY KEY NOT NULL,
	`until` text NOT NULL,
	`reason` text
);
--> statement-breakpoint
CREATE TABLE `track_items` (
	`track_id` text NOT NULL,
	`position` integer NOT NULL,
	`problem_id` integer NOT NULL,
	PRIMARY KEY(`track_id`, `problem_id`)
);
--> statement-breakpoint
CREATE INDEX `ti_pos` ON `track_items` (`track_id`,`position`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`priority` integer NOT NULL,
	`mode` text NOT NULL,
	`window_lo` integer,
	`window_changed_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `upsolves` (
	`problem_id` integer PRIMARY KEY NOT NULL,
	`contest_id` integer,
	`added_at` integer NOT NULL,
	`until` text NOT NULL,
	`done` integer DEFAULT false NOT NULL
);
