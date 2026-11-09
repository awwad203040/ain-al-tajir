CREATE TABLE `inventoryReplenishmentAudits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`branchId` int NOT NULL,
	`requestId` int NOT NULL,
	`fromStatus` enum('suggested','approved','ordered','closed','dismissed') NOT NULL,
	`toStatus` enum('suggested','approved','ordered','closed','dismissed') NOT NULL,
	`actorUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryReplenishmentAudits_id` PRIMARY KEY(`id`)
);
