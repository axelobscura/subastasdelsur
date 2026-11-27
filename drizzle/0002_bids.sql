CREATE TABLE `bid` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`amount_cents` bigint unsigned NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `bid_id` PRIMARY KEY(`id`),
	CONSTRAINT `bid_product_amount_unique` UNIQUE(`product_id`,`amount_cents`)
);
--> statement-breakpoint
ALTER TABLE `auction` ADD `listed` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `bid` ADD CONSTRAINT `bid_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bid` ADD CONSTRAINT `bid_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bid_product_created_idx` ON `bid` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `bid_user_created_idx` ON `bid` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_leading_bid_id_bid_id_fk` FOREIGN KEY (`leading_bid_id`) REFERENCES `bid`(`id`) ON DELETE set null ON UPDATE no action;