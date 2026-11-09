CREATE TABLE `merchantProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`storeName` varchar(191) NOT NULL,
	`businessType` varchar(128) NOT NULL,
	`city` varchar(128) NOT NULL,
	`branchCount` int NOT NULL DEFAULT 1,
	`contactPhone` varchar(32) NOT NULL,
	`taxNumber` varchar(32),
	`trialStartedAt` timestamp NOT NULL,
	`trialEndsAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchantProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchantProfiles_userId_unique` UNIQUE(`userId`)
);
