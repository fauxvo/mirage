CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_token` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`texture_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
