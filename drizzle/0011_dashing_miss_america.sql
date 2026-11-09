CREATE TABLE `branchInventoryTransferLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transferId` int NOT NULL,
	`productKey` varchar(191) NOT NULL,
	`productName` varchar(191) NOT NULL,
	`productSku` varchar(128),
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `branchInventoryTransferLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branchInventoryTransferMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`transferId` int NOT NULL,
	`transferLineId` int NOT NULL,
	`branchId` int NOT NULL,
	`productKey` varchar(191) NOT NULL,
	`quantityChange` int NOT NULL,
	`direction` enum('sent','received') NOT NULL,
	`actorId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `branchInventoryTransferMovements_id` PRIMARY KEY(`id`),
	CONSTRAINT `branchTransferMovement_line_direction` UNIQUE(`transferLineId`,`direction`)
);
--> statement-breakpoint
CREATE TABLE `branchInventoryTransfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceBranchId` int NOT NULL,
	`targetBranchId` int NOT NULL,
	`status` enum('in_transit','received','canceled') NOT NULL DEFAULT 'in_transit',
	`note` varchar(500),
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`sentBy` int NOT NULL,
	`receivedAt` timestamp,
	`receivedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branchInventoryTransfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(191) NOT NULL,
	`city` varchar(128),
	`isPrimary` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `branches_user_name` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `inventoryBalances` DROP INDEX `inventoryBalances_user_product_key`;--> statement-breakpoint
ALTER TABLE `inventoryBalances` ADD `branchId` int;--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD `branchId` int;--> statement-breakpoint
ALTER TABLE `inventoryBalances` ADD CONSTRAINT `inventoryBalances_user_branch_product_key` UNIQUE(`userId`,`branchId`,`productKey`);