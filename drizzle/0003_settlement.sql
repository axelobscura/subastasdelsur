CREATE TABLE `notification` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`email` varchar(255),
	`kind` enum('outbid','auction_result','admin_summary') NOT NULL,
	`auction_id` varchar(36),
	`product_id` varchar(36),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `notification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auction` ADD `settled_at` datetime(3);--> statement-breakpoint
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification` ADD CONSTRAINT `notification_auction_id_auction_id_fk` FOREIGN KEY (`auction_id`) REFERENCES `auction`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification` ADD CONSTRAINT `notification_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notification_user_product_kind_idx` ON `notification` (`user_id`,`product_id`,`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_auction_idx` ON `notification` (`auction_id`,`kind`);