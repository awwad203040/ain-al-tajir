CREATE TABLE `manualPayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subscriptionId` int,
	`provider` enum('instapay') NOT NULL DEFAULT 'instapay',
	`reference` varchar(128) NOT NULL,
	`senderName` varchar(191) NOT NULL,
	`amountMinor` int NOT NULL DEFAULT 10000,
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`proofUrl` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewNote` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manualPayments_id` PRIMARY KEY(`id`),
	CONSTRAINT `manualPayments_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `paymentEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('stripe','paytabs','paypal') NOT NULL,
	`providerEventId` varchar(191) NOT NULL,
	`eventType` varchar(191) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paymentEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `paymentEvents_providerEventId_unique` UNIQUE(`providerEventId`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planCode` varchar(64) NOT NULL DEFAULT 'merchant_monthly',
	`provider` enum('stripe','instapay','paytabs','paypal') NOT NULL DEFAULT 'stripe',
	`status` enum('inactive','checkout_pending','manual_review','active','past_due','canceled','manual_rejected') NOT NULL DEFAULT 'inactive',
	`amountMinor` int NOT NULL DEFAULT 10000,
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`providerCustomerId` varchar(191),
	`providerSubscriptionId` varchar(191),
	`currentPeriodEnd` timestamp,
	`cancelAtPeriodEnd` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_userId_unique` UNIQUE(`userId`)
);
