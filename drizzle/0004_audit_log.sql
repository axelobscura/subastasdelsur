CREATE TABLE `audit_log` (
	`id` varchar(36) NOT NULL,
	`actor_id` varchar(36),
	`actor_name` varchar(255) NOT NULL,
	`action` varchar(64) NOT NULL,
	`entity_type` enum('auction','product','product_image','user') NOT NULL,
	`entity_id` varchar(36) NOT NULL,
	`entity_label` varchar(300) NOT NULL,
	`details` text,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`,`created_at`);