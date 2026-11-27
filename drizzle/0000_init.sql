CREATE TABLE `auction` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`status` enum('draft','published','cancelled') NOT NULL DEFAULT 'draft',
	`starts_at` datetime(3) NOT NULL,
	`ends_at` datetime(3) NOT NULL,
	`timezone` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `auction_id` PRIMARY KEY(`id`),
	CONSTRAINT `auction_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `auction_window_chk` CHECK(`ends_at` > `starts_at`)
);
--> statement-breakpoint
CREATE TABLE `product` (
	`id` varchar(36) NOT NULL,
	`auction_id` varchar(36) NOT NULL,
	`lot_number` int unsigned NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`starting_price_cents` bigint unsigned NOT NULL,
	`min_increment_cents` bigint unsigned NOT NULL,
	`reserve_price_cents` bigint unsigned,
	`current_price_cents` bigint unsigned,
	`leading_bid_id` varchar(36),
	`bid_count` int unsigned NOT NULL DEFAULT 0,
	`position` int unsigned NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `product_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_auction_lot_unique` UNIQUE(`auction_id`,`lot_number`),
	CONSTRAINT `product_increment_chk` CHECK(`min_increment_cents` > 0)
);
--> statement-breakpoint
CREATE TABLE `product_image` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`width` int unsigned NOT NULL,
	`height` int unsigned NOT NULL,
	`alt` varchar(300) NOT NULL DEFAULT '',
	`position` int unsigned NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `product_image_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_auction_id_auction_id_fk` FOREIGN KEY (`auction_id`) REFERENCES `auction`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_image` ADD CONSTRAINT `product_image_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auction_status_starts_idx` ON `auction` (`status`,`starts_at`);--> statement-breakpoint
CREATE INDEX `product_auction_position_idx` ON `product` (`auction_id`,`position`);--> statement-breakpoint
CREATE INDEX `product_image_product_position_idx` ON `product_image` (`product_id`,`position`);