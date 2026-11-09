CREATE TABLE `branchTransferNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerUserId` int NOT NULL,
	`merchantUserId` int NOT NULL,
	`branchId` int NOT NULL,
	`transferId` int NOT NULL,
	`type` enum('transfer_created') NOT NULL DEFAULT 'transfer_created',
	`title` varchar(191) NOT NULL,
	`body` varchar(500) NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `branchTransferNotifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `branchTransferNotifications_manager_transfer` UNIQUE(`managerUserId`,`transferId`)
);
--> statement-breakpoint
CREATE TABLE `devicePushTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`expoToken` varchar(255) NOT NULL,
	`platform` enum('android','ios') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `devicePushTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `devicePushTokens_token` UNIQUE(`expoToken`)
);
