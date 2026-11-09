CREATE TABLE `inventoryCountLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`productKey` varchar(191) NOT NULL,
	`productName` varchar(191) NOT NULL,
	`productSku` varchar(128),
	`systemQuantity` int NOT NULL,
	`countedQuantity` int NOT NULL,
	`varianceQuantity` int NOT NULL,
	`note` varchar(300),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryCountLines_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryCountLines_session_product` UNIQUE(`sessionId`,`productKey`)
);
--> statement-breakpoint
CREATE TABLE `inventoryCountSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`branchId` int NOT NULL,
	`status` enum('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
	`note` varchar(500),
	`createdBy` int NOT NULL,
	`submittedAt` timestamp,
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryCountSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryReorderRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`branchId` int NOT NULL,
	`productKey` varchar(191) NOT NULL,
	`productName` varchar(191) NOT NULL,
	`productSku` varchar(128),
	`minimumQuantity` int NOT NULL,
	`targetQuantity` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryReorderRules_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryReorderRules_branch_product` UNIQUE(`branchId`,`productKey`)
);
--> statement-breakpoint
CREATE TABLE `inventoryReplenishmentRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`branchId` int NOT NULL,
	`productKey` varchar(191) NOT NULL,
	`productName` varchar(191) NOT NULL,
	`productSku` varchar(128),
	`currentQuantity` int NOT NULL,
	`minimumQuantity` int NOT NULL,
	`suggestedQuantity` int NOT NULL,
	`status` enum('suggested','approved','ordered','closed','dismissed') NOT NULL DEFAULT 'suggested',
	`createdBy` int NOT NULL,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryReplenishmentRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryReplenishmentRequests_open_item` UNIQUE(`branchId`,`productKey`,`status`)
);
