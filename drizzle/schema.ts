import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const merchantProfiles = mysqlTable("merchantProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  ownerName: varchar("ownerName", { length: 191 }),
  ownerEmail: varchar("ownerEmail", { length: 320 }),
  storeName: varchar("storeName", { length: 191 }).notNull(),
  businessType: varchar("businessType", { length: 128 }).notNull(),
  city: varchar("city", { length: 128 }).notNull(),
  branchCount: int("branchCount").default(1).notNull(),
  contactPhone: varchar("contactPhone", { length: 32 }).notNull(),
  taxNumber: varchar("taxNumber", { length: 32 }),
  trialStartedAt: timestamp("trialStartedAt").notNull(),
  trialEndsAt: timestamp("trialEndsAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MerchantProfile = typeof merchantProfiles.$inferSelect;
export type InsertMerchantProfile = typeof merchantProfiles.$inferInsert;

/** Merchant branches are isolated per account; a primary branch is created on first use. */
export const branches = mysqlTable("branches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  city: varchar("city", { length: 128 }),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userBranchNameUnique: uniqueIndex("branches_user_name").on(table.userId, table.name),
}));

export type Branch = typeof branches.$inferSelect;
export type InsertBranch = typeof branches.$inferInsert;

/** One authenticated manager is assigned per branch; only that account may accept incoming stock. */
export const branchManagerAssignments = mysqlTable("branchManagerAssignments", {
  id: int("id").autoincrement().primaryKey(),
  merchantUserId: int("merchantUserId").notNull(),
  branchId: int("branchId").notNull(),
  managerUserId: int("managerUserId").notNull(),
  assignedBy: int("assignedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  branchUnique: uniqueIndex("branchManagerAssignments_branch").on(table.branchId),
  managerBranchUnique: uniqueIndex("branchManagerAssignments_manager_branch").on(table.managerUserId, table.branchId),
}));

export type BranchManagerAssignment = typeof branchManagerAssignments.$inferSelect;
export type InsertBranchManagerAssignment = typeof branchManagerAssignments.$inferInsert;

/** Private inbox alerts created for the manager assigned to a target branch. */
export const branchTransferNotifications = mysqlTable("branchTransferNotifications", {
  id: int("id").autoincrement().primaryKey(),
  managerUserId: int("managerUserId").notNull(),
  merchantUserId: int("merchantUserId").notNull(),
  branchId: int("branchId").notNull(),
  transferId: int("transferId").notNull(),
  type: mysqlEnum("type", ["transfer_created", "transfer_canceled"]).default("transfer_created").notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  body: varchar("body", { length: 500 }).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  managerTransferType: uniqueIndex("branchTransferNotifications_manager_transfer_type").on(table.managerUserId, table.transferId, table.type),
}));

export type BranchTransferNotification = typeof branchTransferNotifications.$inferSelect;
export type InsertBranchTransferNotification = typeof branchTransferNotifications.$inferInsert;

/** Private inbox alerts for the merchant owner and assigned branch manager. */
export const inventoryReplenishmentNotifications = mysqlTable("inventoryReplenishmentNotifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientUserId: int("recipientUserId").notNull(),
  merchantUserId: int("merchantUserId").notNull(),
  branchId: int("branchId").notNull(),
  replenishmentRequestId: int("replenishmentRequestId").notNull(),
  type: mysqlEnum("type", ["replenishment_suggested", "replenishment_approved", "replenishment_closed"]).default("replenishment_suggested").notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  body: varchar("body", { length: 500 }).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  recipientRequestType: uniqueIndex("inventoryReplenishmentNotifications_recipient_request_type").on(table.recipientUserId, table.replenishmentRequestId, table.type),
}));

export type InventoryReplenishmentNotification = typeof inventoryReplenishmentNotifications.$inferSelect;
export type InsertInventoryReplenishmentNotification = typeof inventoryReplenishmentNotifications.$inferInsert;

/** Expo push tokens are private to a user account and are never returned to other users. */
export const devicePushTokens = mysqlTable("devicePushTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  expoToken: varchar("expoToken", { length: 255 }).notNull(),
  platform: mysqlEnum("platform", ["android", "ios"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tokenUnique: uniqueIndex("devicePushTokens_token").on(table.expoToken),
}));

export type DevicePushToken = typeof devicePushTokens.$inferSelect;
export type InsertDevicePushToken = typeof devicePushTokens.$inferInsert;

export const priceObservations = mysqlTable("priceObservations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productQuery: varchar("productQuery", { length: 191 }).notNull(),
  productSku: varchar("productSku", { length: 128 }),
  productBarcode: varchar("productBarcode", { length: 32 }),
  sourceName: varchar("sourceName", { length: 191 }).notNull(),
  sourceUrl: text("sourceUrl").notNull(),
  priceMinor: int("priceMinor").notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  observedAt: timestamp("observedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PriceObservation = typeof priceObservations.$inferSelect;
export type InsertPriceObservation = typeof priceObservations.$inferInsert;

export const priceRecommendationDecisions = mysqlTable("priceRecommendationDecisions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productQuery: varchar("productQuery", { length: 191 }).notNull(),
  productSku: varchar("productSku", { length: 128 }),
  productBarcode: varchar("productBarcode", { length: 32 }),
  goal: mysqlEnum("goal", ["fast_sale", "balanced", "higher_margin"]).notNull(),
  action: mysqlEnum("action", ["accepted", "customized", "dismissed"]).notNull(),
  ownPriceMinor: int("ownPriceMinor").notNull(),
  costPriceMinor: int("costPriceMinor"),
  additionalCostMinor: int("additionalCostMinor"),
  targetPriceMinor: int("targetPriceMinor").notNull(),
  selectedPriceMinor: int("selectedPriceMinor"),
  sourceCount: int("sourceCount").notNull(),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PriceRecommendationDecision = typeof priceRecommendationDecisions.$inferSelect;
export type InsertPriceRecommendationDecision = typeof priceRecommendationDecisions.$inferInsert;

/** Merchant-owned suppliers. Contact details are optional and never shared across accounts. */
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  contactName: varchar("contactName", { length: 191 }),
  contactPhone: varchar("contactPhone", { length: 32 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  paymentTerms: varchar("paymentTerms", { length: 191 }),
  leadTimeDays: int("leadTimeDays"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

/** Purchase orders require explicit progression; receiving never changes product stock automatically. */
export const purchaseOrders = mysqlTable("purchaseOrders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  supplierId: int("supplierId").notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "partially_received", "received", "canceled"]).default("draft").notNull(),
  expectedDeliveryDate: timestamp("expectedDeliveryDate"),
  notes: varchar("notes", { length: 500 }),
  totalMinor: int("totalMinor").notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

export const purchaseOrderLines = mysqlTable("purchaseOrderLines", {
  id: int("id").autoincrement().primaryKey(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  productName: varchar("productName", { length: 191 }).notNull(),
  productSku: varchar("productSku", { length: 128 }),
  orderedQuantity: int("orderedQuantity").notNull(),
  receivedQuantity: int("receivedQuantity").default(0).notNull(),
  rejectedQuantity: int("rejectedQuantity").default(0).notNull(),
  unitCostMinor: int("unitCostMinor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect;
export type InsertPurchaseOrderLine = typeof purchaseOrderLines.$inferInsert;

/** Immutable receipt event for an auditable history of partial delivery and rejections. */
export const purchaseOrderReceiptEvents = mysqlTable("purchaseOrderReceiptEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  receiptJson: text("receiptJson").notNull(),
  note: varchar("note", { length: 500 }),
  inventoryPostedAt: timestamp("inventoryPostedAt"),
  inventoryApprovedBy: int("inventoryApprovedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PurchaseOrderReceiptEvent = typeof purchaseOrderReceiptEvents.$inferSelect;
export type InsertPurchaseOrderReceiptEvent = typeof purchaseOrderReceiptEvents.$inferInsert;

/** Current quantities created solely by approved supplier-receipt inventory postings. */
export const inventoryBalances = mysqlTable("inventoryBalances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Nullable only for legacy rows until they are assigned to the merchant's primary branch. */
  branchId: int("branchId"),
  productKey: varchar("productKey", { length: 191 }).notNull(),
  productName: varchar("productName", { length: 191 }).notNull(),
  productSku: varchar("productSku", { length: 128 }),
  quantity: int("quantity").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userBranchProductKeyUnique: uniqueIndex("inventoryBalances_user_branch_product_key").on(table.userId, table.branchId, table.productKey),
}));

export type InventoryBalance = typeof inventoryBalances.$inferSelect;
export type InsertInventoryBalance = typeof inventoryBalances.$inferInsert;

/** Branch-specific reorder thresholds used to create reviewable replenishment requests. */
export const inventoryReorderRules = mysqlTable("inventoryReorderRules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  branchId: int("branchId").notNull(),
  productKey: varchar("productKey", { length: 191 }).notNull(),
  productName: varchar("productName", { length: 191 }).notNull(),
  productSku: varchar("productSku", { length: 128 }),
  minimumQuantity: int("minimumQuantity").notNull(),
  targetQuantity: int("targetQuantity").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  branchProductUnique: uniqueIndex("inventoryReorderRules_branch_product").on(table.branchId, table.productKey),
}));

export type InventoryReorderRule = typeof inventoryReorderRules.$inferSelect;
export type InsertInventoryReorderRule = typeof inventoryReorderRules.$inferInsert;

/** Reviewable replenishment suggestions; creation never changes inventory or creates a purchase order. */
export const inventoryReplenishmentRequests = mysqlTable("inventoryReplenishmentRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  branchId: int("branchId").notNull(),
  productKey: varchar("productKey", { length: 191 }).notNull(),
  productName: varchar("productName", { length: 191 }).notNull(),
  productSku: varchar("productSku", { length: 128 }),
  currentQuantity: int("currentQuantity").notNull(),
  minimumQuantity: int("minimumQuantity").notNull(),
  suggestedQuantity: int("suggestedQuantity").notNull(),
  receivedQuantity: int("receivedQuantity").default(0).notNull(),
  status: mysqlEnum("status", ["suggested", "approved", "ordered", "closed", "dismissed"]).default("suggested").notNull(),
  createdBy: int("createdBy").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  openRequestUnique: uniqueIndex("inventoryReplenishmentRequests_open_item").on(table.branchId, table.productKey, table.status),
}));

export type InventoryReplenishmentRequest = typeof inventoryReplenishmentRequests.$inferSelect;
export type InsertInventoryReplenishmentRequest = typeof inventoryReplenishmentRequests.$inferInsert;

/** Immutable audit trail for every reviewed replenishment status transition. */
export const inventoryReplenishmentAudits = mysqlTable("inventoryReplenishmentAudits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  branchId: int("branchId").notNull(),
  requestId: int("requestId").notNull(),
  fromStatus: mysqlEnum("fromStatus", ["suggested", "approved", "ordered", "closed", "dismissed"]).notNull(),
  toStatus: mysqlEnum("toStatus", ["suggested", "approved", "ordered", "closed", "dismissed"]).notNull(),
  actorUserId: int("actorUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryReplenishmentAudit = typeof inventoryReplenishmentAudits.$inferSelect;
export type InsertInventoryReplenishmentAudit = typeof inventoryReplenishmentAudits.$inferInsert;

/** Periodic branch stocktake header; lines capture system, counted, and variance quantities. */
export const inventoryCountSessions = mysqlTable("inventoryCountSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  branchId: int("branchId").notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "rejected"]).default("draft").notNull(),
  note: varchar("note", { length: 500 }),
  createdBy: int("createdBy").notNull(),
  submittedAt: timestamp("submittedAt"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InventoryCountSession = typeof inventoryCountSessions.$inferSelect;
export type InsertInventoryCountSession = typeof inventoryCountSessions.$inferInsert;

export const inventoryCountLines = mysqlTable("inventoryCountLines", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  productKey: varchar("productKey", { length: 191 }).notNull(),
  productName: varchar("productName", { length: 191 }).notNull(),
  productSku: varchar("productSku", { length: 128 }),
  systemQuantity: int("systemQuantity").notNull(),
  countedQuantity: int("countedQuantity").notNull(),
  varianceQuantity: int("varianceQuantity").notNull(),
  note: varchar("note", { length: 300 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sessionProductUnique: uniqueIndex("inventoryCountLines_session_product").on(table.sessionId, table.productKey),
}));

export type InventoryCountLine = typeof inventoryCountLines.$inferSelect;
export type InsertInventoryCountLine = typeof inventoryCountLines.$inferInsert;

/** Immutable ledger of quantities changed by an approved periodic stocktake. */
export const inventoryCountAdjustments = mysqlTable("inventoryCountAdjustments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  branchId: int("branchId").notNull(),
  sessionId: int("sessionId").notNull(),
  lineId: int("lineId").notNull(),
  productKey: varchar("productKey", { length: 191 }).notNull(),
  quantityChange: int("quantityChange").notNull(),
  approvedBy: int("approvedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sessionLineUnique: uniqueIndex("inventoryCountAdjustments_session_line").on(table.sessionId, table.lineId),
}));

export type InventoryCountAdjustment = typeof inventoryCountAdjustments.$inferSelect;
export type InsertInventoryCountAdjustment = typeof inventoryCountAdjustments.$inferInsert;

/** Immutable audit ledger for reviewed supplier receipts that were posted to stock. */
export const inventoryMovements = mysqlTable("inventoryMovements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Nullable only for receipt movements written before branch tracking was introduced. */
  branchId: int("branchId"),
  receiptEventId: int("receiptEventId").notNull(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  purchaseOrderLineId: int("purchaseOrderLineId").notNull(),
  productKey: varchar("productKey", { length: 191 }).notNull(),
  quantityChange: int("quantityChange").notNull(),
  reason: mysqlEnum("reason", ["supplier_receipt"]).default("supplier_receipt").notNull(),
  approvedBy: int("approvedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  receiptLineUnique: uniqueIndex("inventoryMovements_receipt_line").on(table.receiptEventId, table.purchaseOrderLineId),
}));

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = typeof inventoryMovements.$inferInsert;

/** A source branch deducts stock at send time; the target adds it only after explicit receipt approval. */
export const branchInventoryTransfers = mysqlTable("branchInventoryTransfers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceBranchId: int("sourceBranchId").notNull(),
  targetBranchId: int("targetBranchId").notNull(),
  status: mysqlEnum("status", ["in_transit", "received", "canceled"]).default("in_transit").notNull(),
  note: varchar("note", { length: 500 }),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  sentBy: int("sentBy").notNull(),
  receivedAt: timestamp("receivedAt"),
  receivedBy: int("receivedBy"),
  cancellationReason: varchar("cancellationReason", { length: 500 }),
  canceledAt: timestamp("canceledAt"),
  canceledBy: int("canceledBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BranchInventoryTransfer = typeof branchInventoryTransfers.$inferSelect;
export type InsertBranchInventoryTransfer = typeof branchInventoryTransfers.$inferInsert;

export const branchInventoryTransferLines = mysqlTable("branchInventoryTransferLines", {
  id: int("id").autoincrement().primaryKey(),
  transferId: int("transferId").notNull(),
  productKey: varchar("productKey", { length: 191 }).notNull(),
  productName: varchar("productName", { length: 191 }).notNull(),
  productSku: varchar("productSku", { length: 128 }),
  quantity: int("quantity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BranchInventoryTransferLine = typeof branchInventoryTransferLines.$inferSelect;
export type InsertBranchInventoryTransferLine = typeof branchInventoryTransferLines.$inferInsert;

/** Immutable audit rows for the source deduction and destination receipt of every transferred line. */
export const branchInventoryTransferMovements = mysqlTable("branchInventoryTransferMovements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  transferId: int("transferId").notNull(),
  transferLineId: int("transferLineId").notNull(),
  branchId: int("branchId").notNull(),
  productKey: varchar("productKey", { length: 191 }).notNull(),
  quantityChange: int("quantityChange").notNull(),
  direction: mysqlEnum("direction", ["sent", "received", "reversed"]).notNull(),
  actorId: int("actorId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  transferLineDirectionUnique: uniqueIndex("branchTransferMovement_line_direction").on(table.transferLineId, table.direction),
}));

export type BranchInventoryTransferMovement = typeof branchInventoryTransferMovements.$inferSelect;
export type InsertBranchInventoryTransferMovement = typeof branchInventoryTransferMovements.$inferInsert;

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  planCode: varchar("planCode", { length: 64 }).default("merchant_monthly").notNull(),
  provider: mysqlEnum("provider", ["stripe", "instapay", "paytabs", "paypal"]).default("stripe").notNull(),
  status: mysqlEnum("status", [
    "inactive",
    "checkout_pending",
    "manual_review",
    "active",
    "past_due",
    "canceled",
    "manual_rejected",
  ]).default("inactive").notNull(),
  amountMinor: int("amountMinor").default(10000).notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  providerCustomerId: varchar("providerCustomerId", { length: 191 }),
  providerSubscriptionId: varchar("providerSubscriptionId", { length: 191 }),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const manualPayments = mysqlTable("manualPayments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subscriptionId: int("subscriptionId"),
  provider: mysqlEnum("provider", ["instapay"]).default("instapay").notNull(),
  reference: varchar("reference", { length: 128 }).notNull().unique(),
  senderName: varchar("senderName", { length: 191 }).notNull(),
  amountMinor: int("amountMinor").default(10000).notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  proofUrl: text("proofUrl"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewNote: text("reviewNote"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const paymentEvents = mysqlTable("paymentEvents", {
  id: int("id").autoincrement().primaryKey(),
  provider: mysqlEnum("provider", ["stripe", "paytabs", "paypal"]).notNull(),
  providerEventId: varchar("providerEventId", { length: 191 }).notNull().unique(),
  eventType: varchar("eventType", { length: 191 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subscriptionId: int("subscriptionId"),
  provider: mysqlEnum("provider", ["stripe", "paytabs", "paypal"]).notNull(),
  providerInvoiceId: varchar("providerInvoiceId", { length: 191 }).notNull().unique(),
  invoiceNumber: varchar("invoiceNumber", { length: 128 }),
  status: mysqlEnum("status", ["draft", "open", "paid", "void", "uncollectible"]).default("open").notNull(),
  amountDueMinor: int("amountDueMinor").default(10000).notNull(),
  amountPaidMinor: int("amountPaidMinor").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  hostedInvoiceUrl: text("hostedInvoiceUrl"),
  invoicePdfUrl: text("invoicePdfUrl"),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;
export type ManualPayment = typeof manualPayments.$inferSelect;
export type InsertManualPayment = typeof manualPayments.$inferInsert;
export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
