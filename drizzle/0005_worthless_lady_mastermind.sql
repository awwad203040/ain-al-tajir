CREATE TABLE `priceObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productQuery` varchar(191) NOT NULL,
	`productSku` varchar(128),
	`productBarcode` varchar(32),
	`sourceName` varchar(191) NOT NULL,
	`sourceUrl` text NOT NULL,
	`priceMinor` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `priceObservations_id` PRIMARY KEY(`id`)
);
