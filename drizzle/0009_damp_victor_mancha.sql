CREATE TABLE `purchaseOrderLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`productName` varchar(191) NOT NULL,
	`productSku` varchar(128),
	`orderedQuantity` int NOT NULL,
	`receivedQuantity` int NOT NULL DEFAULT 0,
	`rejectedQuantity` int NOT NULL DEFAULT 0,
	`unitCostMinor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrderLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrderReceiptEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`receiptJson` text NOT NULL,
	`note` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchaseOrderReceiptEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`supplierId` int NOT NULL,
	`status` enum('draft','submitted','approved','partially_received','received','canceled') NOT NULL DEFAULT 'draft',
	`expectedDeliveryDate` timestamp,
	`notes` varchar(500),
	`totalMinor` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(191) NOT NULL,
	`contactName` varchar(191),
	`contactPhone` varchar(32),
	`contactEmail` varchar(320),
	`paymentTerms` varchar(191),
	`leadTimeDays` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
