CREATE TABLE `priceRecommendationDecisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productQuery` varchar(191) NOT NULL,
	`productSku` varchar(128),
	`productBarcode` varchar(32),
	`goal` enum('fast_sale','balanced','higher_margin') NOT NULL,
	`action` enum('accepted','customized','dismissed') NOT NULL,
	`ownPriceMinor` int NOT NULL,
	`targetPriceMinor` int NOT NULL,
	`selectedPriceMinor` int,
	`sourceCount` int NOT NULL,
	`note` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `priceRecommendationDecisions_id` PRIMARY KEY(`id`)
);
