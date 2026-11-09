CREATE TABLE `inventoryBalances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productKey` varchar(191) NOT NULL,
	`productName` varchar(191) NOT NULL,
	`productSku` varchar(128),
	`quantity` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryBalances_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryBalances_user_product_key` UNIQUE(`userId`,`productKey`)
);
--> statement-breakpoint
CREATE TABLE `inventoryMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`receiptEventId` int NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`purchaseOrderLineId` int NOT NULL,
	`productKey` varchar(191) NOT NULL,
	`quantityChange` int NOT NULL,
	`reason` enum('supplier_receipt') NOT NULL DEFAULT 'supplier_receipt',
	`approvedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryMovements_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryMovements_receipt_line` UNIQUE(`receiptEventId`,`purchaseOrderLineId`)
);
--> statement-breakpoint
ALTER TABLE `purchaseOrderReceiptEvents` ADD `inventoryPostedAt` timestamp;--> statement-breakpoint
ALTER TABLE `purchaseOrderReceiptEvents` ADD `inventoryApprovedBy` int;