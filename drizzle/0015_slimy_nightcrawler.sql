ALTER TABLE `branchTransferNotifications` DROP INDEX `branchTransferNotifications_manager_transfer`;--> statement-breakpoint
ALTER TABLE `branchTransferNotifications` MODIFY COLUMN `type` enum('transfer_created','transfer_canceled') NOT NULL DEFAULT 'transfer_created';--> statement-breakpoint
ALTER TABLE `branchInventoryTransfers` ADD `cancellationReason` varchar(500);--> statement-breakpoint
ALTER TABLE `branchInventoryTransfers` ADD `canceledAt` timestamp;--> statement-breakpoint
ALTER TABLE `branchInventoryTransfers` ADD `canceledBy` int;--> statement-breakpoint
ALTER TABLE `branchTransferNotifications` ADD CONSTRAINT `branchTransferNotifications_manager_transfer_type` UNIQUE(`managerUserId`,`transferId`,`type`);