CREATE TABLE `branchManagerAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchantUserId` int NOT NULL,
	`branchId` int NOT NULL,
	`managerUserId` int NOT NULL,
	`assignedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branchManagerAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `branchManagerAssignments_branch` UNIQUE(`branchId`),
	CONSTRAINT `branchManagerAssignments_manager_branch` UNIQUE(`managerUserId`,`branchId`)
);
