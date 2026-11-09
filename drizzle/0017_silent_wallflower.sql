CREATE TABLE `inventoryCountAdjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`branchId` int NOT NULL,
	`sessionId` int NOT NULL,
	`lineId` int NOT NULL,
	`productKey` varchar(191) NOT NULL,
	`quantityChange` int NOT NULL,
	`approvedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryCountAdjustments_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryCountAdjustments_session_line` UNIQUE(`sessionId`,`lineId`)
);
