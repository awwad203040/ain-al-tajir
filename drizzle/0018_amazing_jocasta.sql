CREATE TABLE `inventoryReplenishmentNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientUserId` int NOT NULL,
	`merchantUserId` int NOT NULL,
	`branchId` int NOT NULL,
	`replenishmentRequestId` int NOT NULL,
	`type` enum('replenishment_suggested') NOT NULL DEFAULT 'replenishment_suggested',
	`title` varchar(191) NOT NULL,
	`body` varchar(500) NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryReplenishmentNotifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryReplenishmentNotifications_recipient_request_type` UNIQUE(`recipientUserId`,`replenishmentRequestId`,`type`)
);
