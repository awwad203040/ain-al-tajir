import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertInvoice,
  InsertBranch,
  InsertBranchInventoryTransfer,
  InsertBranchInventoryTransferLine,
  InsertBranchInventoryTransferMovement,
  InsertBranchManagerAssignment,
  InsertBranchTransferNotification,
  InsertDevicePushToken,
  InsertManualPayment,
  InsertSubscription,
  invoices,
  InsertMerchantProfile,
  InsertPriceObservation,
  InsertPriceRecommendationDecision,
  InsertInventoryMovement,
  InsertInventoryCountAdjustment,
  InsertInventoryCountLine,
  InsertInventoryCountSession,
  InsertInventoryReorderRule,
  InsertPurchaseOrder,
  InsertPurchaseOrderLine,
  InsertPurchaseOrderReceiptEvent,
  InsertSupplier,
  branches,
  branchInventoryTransferLines,
  branchInventoryTransferMovements,
  branchInventoryTransfers,
  branchManagerAssignments,
  branchTransferNotifications,
  devicePushTokens,
  inventoryBalances,
  inventoryCountAdjustments,
  inventoryCountLines,
  inventoryCountSessions,
  inventoryMovements,
  inventoryReorderRules,
  inventoryReplenishmentAudits,
  inventoryReplenishmentNotifications,
  inventoryReplenishmentRequests,
  manualPayments,
  merchantProfiles,
  paymentEvents,
  priceObservations,
  priceRecommendationDecisions,
  purchaseOrderLines,
  purchaseOrderReceiptEvents,
  purchaseOrders,
  suppliers,
  subscriptions,
  InsertUser,
  users,
} from "../drizzle/schema";
import { matchesPriceObservation, type PriceResearchFilters } from "../shared/price-research";
import { inventoryProductKey, parseReceiptSnapshot, statusAfterReceipt, type PurchaseOrderLineProgress } from "../shared/procurement";
import { canCancelBranchTransfer, canReceiveBranchTransfer, canSendFromBalance, normalizeBranchTransferCancellationReason, normalizeBranchTransferLines, type BranchTransferLineInput } from "../shared/branch-transfers";
import { canApproveInventoryCount, canSubmitInventoryCount, canTransitionReplenishment, normalizeCountLines, normalizeReorderRule, replenishmentAuditTransition, shouldCreateReplenishment, suggestedReplenishmentQuantity, varianceForCount, type InventoryCountStatus, type ReplenishmentStatus } from "../shared/inventory-operations";
import { branchTransferCancellationNotificationCopy } from "../shared/branch-transfer-cancellation-notification";
import { inventoryReplenishmentNotificationCopy, inventoryReplenishmentStatusNotificationCopy } from "../shared/inventory-replenishment-notification";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getSubscriptionByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return rows[0];
}

export async function getMerchantProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(merchantProfiles).where(eq(merchantProfiles.userId, userId)).limit(1);
  return rows[0];
}

export async function createMerchantProfile(data: InsertMerchantProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMerchantProfileByUserId(data.userId);
  if (existing) return existing;
  await db.insert(merchantProfiles).values(data);
  return getMerchantProfileByUserId(data.userId);
}

/** Creates one primary branch on demand and assigns legacy stock history to it exactly once. */
export async function ensurePrimaryBranchForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const existing = await tx.select().from(branches).where(and(eq(branches.userId, userId), eq(branches.isPrimary, true))).limit(1);
    let primary = existing[0];
    if (!primary) {
      const profileRows = await tx.select().from(merchantProfiles).where(eq(merchantProfiles.userId, userId)).limit(1);
      const profile = profileRows[0];
      try {
        const result = await tx.insert(branches).values({ userId, name: "الفرع الرئيسي", city: profile?.city, isPrimary: true });
        const branchId = Number(result[0].insertId);
        const inserted = await tx.select().from(branches).where(and(eq(branches.id, branchId), eq(branches.userId, userId))).limit(1);
        primary = inserted[0];
      } catch (error) {
        const concurrent = await tx.select().from(branches).where(and(eq(branches.userId, userId), eq(branches.name, "الفرع الرئيسي"))).limit(1);
        if (!concurrent[0]) throw error;
        primary = concurrent[0];
      }
    }
    if (!primary) throw new Error("Primary branch could not be created");
    await tx.update(inventoryBalances).set({ branchId: primary.id, updatedAt: new Date() }).where(and(eq(inventoryBalances.userId, userId), isNull(inventoryBalances.branchId)));
    await tx.update(inventoryMovements).set({ branchId: primary.id }).where(and(eq(inventoryMovements.userId, userId), isNull(inventoryMovements.branchId)));
    return primary;
  });
}

export async function listBranchesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensurePrimaryBranchForUser(userId);
  return db.select().from(branches).where(eq(branches.userId, userId)).orderBy(desc(branches.isPrimary), desc(branches.updatedAt));
}

export async function createBranch(data: InsertBranch) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensurePrimaryBranchForUser(data.userId);
  const result = await db.insert(branches).values({ ...data, isPrimary: false });
  const id = Number(result[0].insertId);
  const rows = await db.select().from(branches).where(and(eq(branches.id, id), eq(branches.userId, data.userId))).limit(1);
  return rows[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  return rows[0];
}

export async function listBranchManagerAssignmentsByMerchantUserId(merchantUserId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensurePrimaryBranchForUser(merchantUserId);
  const assignments = await db.select().from(branchManagerAssignments).where(eq(branchManagerAssignments.merchantUserId, merchantUserId)).orderBy(desc(branchManagerAssignments.updatedAt));
  if (!assignments.length) return [];
  const [merchantBranches, managers] = await Promise.all([
    db.select().from(branches).where(and(eq(branches.userId, merchantUserId), inArray(branches.id, assignments.map((assignment) => assignment.branchId)))),
    db.select().from(users).where(inArray(users.id, assignments.map((assignment) => assignment.managerUserId))),
  ]);
  const branchesById = new Map(merchantBranches.map((branch) => [branch.id, branch]));
  const managersById = new Map(managers.map((manager) => [manager.id, manager]));
  return assignments.map((assignment) => ({ ...assignment, branch: branchesById.get(assignment.branchId), manager: managersById.get(assignment.managerUserId) }));
}

export async function assignBranchManager(merchantUserId: number, branchId: number, managerEmail: string, assignedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalizedEmail = managerEmail.trim().toLowerCase();
  const [branch, manager] = await Promise.all([
    db.select().from(branches).where(and(eq(branches.id, branchId), eq(branches.userId, merchantUserId))).limit(1),
    getUserByEmail(normalizedEmail),
  ]);
  if (!branch[0]) throw new Error("Branch not found");
  if (!manager) throw new Error("The manager must sign in once before assignment");
  if (manager.id === merchantUserId) throw new Error("The merchant owner cannot be assigned as a branch manager");
  const assignment: InsertBranchManagerAssignment = { merchantUserId, branchId, managerUserId: manager.id, assignedBy };
  await db.insert(branchManagerAssignments).values(assignment).onDuplicateKeyUpdate({ set: { managerUserId: manager.id, assignedBy, updatedAt: new Date() } });
  const assignments = await listBranchManagerAssignmentsByMerchantUserId(merchantUserId);
  return assignments.find((item) => item.branchId === branchId);
}

export async function removeBranchManager(merchantUserId: number, branchId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(branchManagerAssignments).where(and(eq(branchManagerAssignments.merchantUserId, merchantUserId), eq(branchManagerAssignments.branchId, branchId)));
}

export async function getBranchManagerAssignmentByBranch(merchantUserId: number, branchId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(branchManagerAssignments).where(and(eq(branchManagerAssignments.merchantUserId, merchantUserId), eq(branchManagerAssignments.branchId, branchId))).limit(1);
  return rows[0];
}

export async function listBranchManagerAssignmentsForManager(managerUserId: number) {
  const db = await getDb();
  if (!db) return [];
  const assignments = await db.select().from(branchManagerAssignments).where(eq(branchManagerAssignments.managerUserId, managerUserId)).orderBy(desc(branchManagerAssignments.updatedAt));
  if (!assignments.length) return [];
  const branchIds = assignments.map((assignment) => assignment.branchId);
  const assignedBranches = await db.select().from(branches).where(inArray(branches.id, branchIds));
  const branchesById = new Map(assignedBranches.map((branch) => [branch.id, branch]));
  return assignments.map((assignment) => ({ ...assignment, branch: branchesById.get(assignment.branchId) })).filter((assignment) => assignment.branch?.userId === assignment.merchantUserId);
}

/** Finds the exact target-branch assignment for a manager without exposing other transfer records. */
export async function getBranchManagerAssignmentForTransfer(managerUserId: number, transferId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const transferRows = await db.select().from(branchInventoryTransfers).where(eq(branchInventoryTransfers.id, transferId)).limit(1);
  const transfer = transferRows[0];
  if (!transfer) return undefined;
  const assignments = await db.select().from(branchManagerAssignments).where(and(eq(branchManagerAssignments.managerUserId, managerUserId), eq(branchManagerAssignments.merchantUserId, transfer.userId), eq(branchManagerAssignments.branchId, transfer.targetBranchId))).limit(1);
  return assignments[0] ? { assignment: assignments[0], transfer } : undefined;
}

export async function createBranchTransferNotification(data: InsertBranchTransferNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(branchTransferNotifications).values(data).onDuplicateKeyUpdate({
    set: { title: data.title, body: data.body, readAt: null, createdAt: new Date() },
  });
  const rows = await db.select().from(branchTransferNotifications).where(and(eq(branchTransferNotifications.managerUserId, data.managerUserId), eq(branchTransferNotifications.transferId, data.transferId), eq(branchTransferNotifications.type, data.type ?? "transfer_created"))).limit(1);
  return rows[0];
}

/** Manager-only inbox; notifications never reveal another branch's alerts. */
export async function listBranchTransferNotificationsForManager(managerUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(branchTransferNotifications).where(eq(branchTransferNotifications.managerUserId, managerUserId)).orderBy(desc(branchTransferNotifications.createdAt));
}

export async function markBranchTransferNotificationRead(managerUserId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(branchTransferNotifications).set({ readAt: new Date() }).where(and(eq(branchTransferNotifications.id, notificationId), eq(branchTransferNotifications.managerUserId, managerUserId)));
}

export async function upsertDevicePushToken(data: InsertDevicePushToken) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(devicePushTokens).values(data).onDuplicateKeyUpdate({ set: { userId: data.userId, platform: data.platform, updatedAt: new Date() } });
}

export async function listDevicePushTokensForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(devicePushTokens).where(eq(devicePushTokens.userId, userId)).orderBy(desc(devicePushTokens.updatedAt));
}

export async function removeDevicePushToken(userId: number, expoToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(devicePushTokens).where(and(eq(devicePushTokens.userId, userId), eq(devicePushTokens.expoToken, expoToken)));
}

async function getOwnedBranch(tx: any, userId: number, branchId: number) {
  const rows = await tx.select().from(branches).where(and(eq(branches.id, branchId), eq(branches.userId, userId))).limit(1);
  return rows[0];
}

export async function listPriceObservationsByUserId(userId: number, filters?: PriceResearchFilters) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(priceObservations).where(eq(priceObservations.userId, userId)).orderBy(desc(priceObservations.observedAt));
  return rows.filter((row) => matchesPriceObservation(filters, row));
}

export async function createPriceObservation(data: InsertPriceObservation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(priceObservations).values(data);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(priceObservations).where(eq(priceObservations.id, id)).limit(1);
  return rows[0];
}

export async function listPriceRecommendationDecisionsByUserId(userId: number, filters?: PriceResearchFilters) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(priceRecommendationDecisions).where(eq(priceRecommendationDecisions.userId, userId)).orderBy(desc(priceRecommendationDecisions.createdAt));
  return rows.filter((row) => matchesPriceObservation(filters, row));
}

export async function createPriceRecommendationDecision(data: InsertPriceRecommendationDecision) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(priceRecommendationDecisions).values(data);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(priceRecommendationDecisions).where(eq(priceRecommendationDecisions.id, id)).limit(1);
  return rows[0];
}

export async function listSuppliersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers).where(eq(suppliers.userId, userId)).orderBy(desc(suppliers.updatedAt));
}

export async function createSupplier(data: InsertSupplier) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(suppliers).values(data);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.userId, data.userId))).limit(1);
  return rows[0];
}

export async function listPurchaseOrdersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const orders = await db.select().from(purchaseOrders).where(eq(purchaseOrders.userId, userId)).orderBy(desc(purchaseOrders.updatedAt));
  if (!orders.length) return [];
  const orderIds = orders.map((order) => order.id);
  const supplierIds = [...new Set(orders.map((order) => order.supplierId))];
  const [lines, orderSuppliers] = await Promise.all([
    db.select().from(purchaseOrderLines).where(inArray(purchaseOrderLines.purchaseOrderId, orderIds)).orderBy(purchaseOrderLines.id),
    db.select().from(suppliers).where(and(inArray(suppliers.id, supplierIds), eq(suppliers.userId, userId))),
  ]);
  const suppliersById = new Map(orderSuppliers.map((supplier) => [supplier.id, supplier]));
  return orders.map((order) => ({
    ...order,
    supplier: suppliersById.get(order.supplierId),
    lines: lines.filter((line) => line.purchaseOrderId === order.id),
  }));
}

export async function createPurchaseOrderWithLines(data: InsertPurchaseOrder, lines: Omit<InsertPurchaseOrderLine, "purchaseOrderId">[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const supplierRows = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, data.supplierId), eq(suppliers.userId, data.userId), eq(suppliers.isActive, true))).limit(1);
  if (!supplierRows[0]) throw new Error("Supplier not found or inactive");
  const orderId = await db.transaction(async (tx) => {
    const result = await tx.insert(purchaseOrders).values(data);
    const id = Number(result[0].insertId);
    await tx.insert(purchaseOrderLines).values(lines.map((line) => ({ ...line, purchaseOrderId: id })));
    return id;
  });
  const orders = await listPurchaseOrdersByUserId(data.userId);
  return orders.find((order) => order.id === orderId);
}

export async function getPurchaseOrderForUser(userId: number, purchaseOrderId: number) {
  const orders = await listPurchaseOrdersByUserId(userId);
  return orders.find((order) => order.id === purchaseOrderId);
}

export async function transitionPurchaseOrderStatus(userId: number, purchaseOrderId: number, status: "submitted" | "approved" | "canceled") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(purchaseOrders).set({ status, updatedAt: new Date() }).where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.userId, userId)));
  return getPurchaseOrderForUser(userId, purchaseOrderId);
}

export type ReceiptLineUpdate = { lineId: number; receivedQuantity: number; rejectedQuantity: number };

/** Records only confirmed delivery quantities. Inventory deliberately remains unchanged. */
export async function recordPurchaseOrderReceipt(userId: number, purchaseOrderId: number, receivedLines: ReceiptLineUpdate[], note?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const orderRows = await tx.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.userId, userId))).limit(1);
    const order = orderRows[0];
    if (!order) throw new Error("Purchase order not found");
    if (order.status !== "approved" && order.status !== "partially_received") throw new Error("Purchase order is not ready for receiving");
    const lines = await tx.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId));
    const updatesByLineId = new Map(receivedLines.map((line) => [line.lineId, line]));
    if (updatesByLineId.size !== receivedLines.length || !receivedLines.length) throw new Error("Valid receipt lines are required");
    if (!receivedLines.every((line) => lines.some((candidate) => candidate.id === line.lineId))) throw new Error("Receipt line does not belong to this purchase order");
    const amended: PurchaseOrderLineProgress[] = [];
    for (const line of lines) {
      const update = updatesByLineId.get(line.id);
      if (!update) {
        amended.push({ orderedQuantity: line.orderedQuantity, receivedQuantity: line.receivedQuantity, rejectedQuantity: line.rejectedQuantity });
        continue;
      }
      const receivedQuantity = line.receivedQuantity + update.receivedQuantity;
      const rejectedQuantity = line.rejectedQuantity + update.rejectedQuantity;
      if (receivedQuantity + rejectedQuantity > line.orderedQuantity) throw new Error("Receipt quantities exceed the ordered quantity");
      await tx.update(purchaseOrderLines).set({ receivedQuantity, rejectedQuantity, updatedAt: new Date() }).where(eq(purchaseOrderLines.id, line.id));
      amended.push({ orderedQuantity: line.orderedQuantity, receivedQuantity, rejectedQuantity });
    }
    const status = statusAfterReceipt(amended);
    const receipt: InsertPurchaseOrderReceiptEvent = { userId, purchaseOrderId, receiptJson: JSON.stringify(receivedLines), note };
    await tx.insert(purchaseOrderReceiptEvents).values(receipt);
    await tx.update(purchaseOrders).set({ status, updatedAt: new Date() }).where(eq(purchaseOrders.id, purchaseOrderId));
  });
  return getPurchaseOrderForUser(userId, purchaseOrderId);
}

export async function listInventoryBalancesByUserId(userId: number, branchId?: number) {
  const db = await getDb();
  if (!db) return [];
  await ensurePrimaryBranchForUser(userId);
  const condition = branchId === undefined ? eq(inventoryBalances.userId, userId) : and(eq(inventoryBalances.userId, userId), eq(inventoryBalances.branchId, branchId));
  return db.select().from(inventoryBalances).where(condition).orderBy(desc(inventoryBalances.updatedAt));
}

/** Receipts remain reviewable until a merchant explicitly posts them to the inventory ledger. */
export async function listPendingInventoryReceiptsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const events = await db.select().from(purchaseOrderReceiptEvents).where(and(eq(purchaseOrderReceiptEvents.userId, userId), isNull(purchaseOrderReceiptEvents.inventoryPostedAt))).orderBy(desc(purchaseOrderReceiptEvents.createdAt));
  if (!events.length) return [];
  const orderIds = [...new Set(events.map((event) => event.purchaseOrderId))];
  const [orders, lines] = await Promise.all([
    db.select().from(purchaseOrders).where(and(inArray(purchaseOrders.id, orderIds), eq(purchaseOrders.userId, userId))),
    db.select().from(purchaseOrderLines).where(inArray(purchaseOrderLines.purchaseOrderId, orderIds)),
  ]);
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const linesById = new Map(lines.map((line) => [line.id, line]));
  return events.map((event) => {
    const snapshot = parseReceiptSnapshot(safelyParseJson(event.receiptJson)) ?? [];
    return {
      ...event,
      purchaseOrder: ordersById.get(event.purchaseOrderId),
      lines: snapshot.map((receiptLine) => ({ receiptLine, purchaseOrderLine: linesById.get(receiptLine.lineId) })).filter((item) => Boolean(item.purchaseOrderLine)),
    };
  });
}

/** Posts a merchant-reviewed receipt once, creating an immutable movement and an updated balance atomically. */
export async function postReviewedReceiptToInventory(userId: number, receiptEventId: number, approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const primaryBranch = await ensurePrimaryBranchForUser(userId);
  return db.transaction(async (tx) => {
    const receiptRows = await tx.select().from(purchaseOrderReceiptEvents).where(and(eq(purchaseOrderReceiptEvents.id, receiptEventId), eq(purchaseOrderReceiptEvents.userId, userId), isNull(purchaseOrderReceiptEvents.inventoryPostedAt))).limit(1);
    const receipt = receiptRows[0];
    if (!receipt) throw new Error("Receipt was not found or has already been posted to inventory");
    const snapshot = parseReceiptSnapshot(safelyParseJson(receipt.receiptJson));
    if (!snapshot) throw new Error("Receipt data is invalid and cannot be posted");
    const orderRows = await tx.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, receipt.purchaseOrderId), eq(purchaseOrders.userId, userId))).limit(1);
    if (!orderRows[0]) throw new Error("Purchase order not found");
    const lineIds = snapshot.map((line) => line.lineId);
    const lines = await tx.select().from(purchaseOrderLines).where(inArray(purchaseOrderLines.id, lineIds));
    if (lines.length !== lineIds.length || !lines.every((line) => line.purchaseOrderId === receipt.purchaseOrderId)) throw new Error("Receipt lines do not belong to this purchase order");
    const linesById = new Map(lines.map((line) => [line.id, line]));
    const approvedAt = new Date();
    const movements: InsertInventoryMovement[] = [];
    for (const receiptLine of snapshot) {
      if (!receiptLine.receivedQuantity) continue;
      const line = linesById.get(receiptLine.lineId)!;
      const productKey = inventoryProductKey(line.productName, line.productSku);
      if (!productKey) throw new Error("A receipt line has no valid product identity");
      await tx.insert(inventoryBalances).values({
        userId,
        branchId: primaryBranch.id,
        productKey,
        productName: line.productName,
        productSku: line.productSku,
        quantity: receiptLine.receivedQuantity,
        updatedAt: approvedAt,
      }).onDuplicateKeyUpdate({
        set: {
          quantity: sql`${inventoryBalances.quantity} + ${receiptLine.receivedQuantity}`,
          productName: line.productName,
          productSku: line.productSku,
          updatedAt: approvedAt,
        },
      });
      movements.push({
        userId,
        branchId: primaryBranch.id,
        receiptEventId: receipt.id,
        purchaseOrderId: receipt.purchaseOrderId,
        purchaseOrderLineId: line.id,
        productKey,
        quantityChange: receiptLine.receivedQuantity,
        reason: "supplier_receipt",
        approvedBy,
      });
    }
    if (movements.length) await tx.insert(inventoryMovements).values(movements);
    await tx.update(purchaseOrderReceiptEvents).set({ inventoryPostedAt: approvedAt, inventoryApprovedBy: approvedBy }).where(and(eq(purchaseOrderReceiptEvents.id, receipt.id), isNull(purchaseOrderReceiptEvents.inventoryPostedAt)));
    return { receiptEventId: receipt.id, movementCount: movements.length, quantityPosted: movements.reduce((sum, movement) => sum + movement.quantityChange, 0), postedAt: approvedAt };
  });
}

export async function listBranchInventoryTransfersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensurePrimaryBranchForUser(userId);
  const transfers = await db.select().from(branchInventoryTransfers).where(eq(branchInventoryTransfers.userId, userId)).orderBy(desc(branchInventoryTransfers.updatedAt));
  if (!transfers.length) return [];
  const branchIds = [...new Set(transfers.flatMap((transfer) => [transfer.sourceBranchId, transfer.targetBranchId]))];
  const transferIds = transfers.map((transfer) => transfer.id);
  const [ownedBranches, lines] = await Promise.all([
    db.select().from(branches).where(and(eq(branches.userId, userId), inArray(branches.id, branchIds))),
    db.select().from(branchInventoryTransferLines).where(inArray(branchInventoryTransferLines.transferId, transferIds)),
  ]);
  const branchesById = new Map(ownedBranches.map((branch) => [branch.id, branch]));
  return transfers.map((transfer) => ({
    ...transfer,
    sourceBranch: branchesById.get(transfer.sourceBranchId),
    targetBranch: branchesById.get(transfer.targetBranchId),
    lines: lines.filter((line) => line.transferId === transfer.id),
  }));
}

/** Returns only transfers targeting a branch explicitly assigned to the signed-in manager. */
export async function listIncomingBranchTransfersForManager(managerUserId: number, activeMerchantUserIds: number[]) {
  const db = await getDb();
  if (!db || !activeMerchantUserIds.length) return [];
  const allAssignments = await listBranchManagerAssignmentsForManager(managerUserId);
  const assignments = allAssignments.filter((assignment) => activeMerchantUserIds.includes(assignment.merchantUserId));
  if (!assignments.length) return [];
  const assignmentByBranchId = new Map(assignments.map((assignment) => [assignment.branchId, assignment]));
  const transfers = await db.select().from(branchInventoryTransfers).where(inArray(branchInventoryTransfers.targetBranchId, assignments.map((assignment) => assignment.branchId))).orderBy(desc(branchInventoryTransfers.updatedAt));
  if (!transfers.length) return [];
  const transferIds = transfers.map((transfer) => transfer.id);
  const branchIds = [...new Set(transfers.flatMap((transfer) => [transfer.sourceBranchId, transfer.targetBranchId]))];
  const [transferLines, transferBranches] = await Promise.all([
    db.select().from(branchInventoryTransferLines).where(inArray(branchInventoryTransferLines.transferId, transferIds)),
    db.select().from(branches).where(inArray(branches.id, branchIds)),
  ]);
  const branchesById = new Map(transferBranches.map((branch) => [branch.id, branch]));
  return transfers
    .filter((transfer) => assignmentByBranchId.get(transfer.targetBranchId)?.merchantUserId === transfer.userId)
    .map((transfer) => ({
      ...transfer,
      sourceBranch: branchesById.get(transfer.sourceBranchId),
      targetBranch: branchesById.get(transfer.targetBranchId),
      lines: transferLines.filter((line) => line.transferId === transfer.id),
    }));
}

/** Deducts confirmed source stock and records the outbound audit movement in the same transaction. */
export async function createBranchInventoryTransfer(userId: number, sourceBranchId: number, targetBranchId: number, rawLines: unknown, note: string | undefined, sentBy: number, managerNotification: { managerUserId: number; title: string; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const requestedLines = normalizeBranchTransferLines(rawLines);
  if (!requestedLines) throw new Error("Valid unique transfer lines are required");
  if (sourceBranchId === targetBranchId) throw new Error("Choose a different destination branch");
  await ensurePrimaryBranchForUser(userId);
  return db.transaction(async (tx) => {
    const [sourceBranch, targetBranch] = await Promise.all([getOwnedBranch(tx, userId, sourceBranchId), getOwnedBranch(tx, userId, targetBranchId)]);
    if (!sourceBranch || !targetBranch) throw new Error("Source or destination branch was not found");
    const assignedManager = await tx.select().from(branchManagerAssignments).where(and(eq(branchManagerAssignments.merchantUserId, userId), eq(branchManagerAssignments.branchId, targetBranchId), eq(branchManagerAssignments.managerUserId, managerNotification.managerUserId))).limit(1);
    if (!assignedManager[0]) throw new Error("Target branch manager assignment changed before the transfer could be sent");
    const productKeys = requestedLines.map((line) => line.productKey);
    const sourceBalances = await tx.select().from(inventoryBalances).where(and(eq(inventoryBalances.userId, userId), eq(inventoryBalances.branchId, sourceBranchId), inArray(inventoryBalances.productKey, productKeys)));
    const balanceByKey = new Map(sourceBalances.map((balance) => [balance.productKey, balance]));
    for (const line of requestedLines) {
      const balance = balanceByKey.get(line.productKey);
      if (!balance || !canSendFromBalance(balance.quantity, line.quantity)) throw new Error(`Insufficient confirmed stock for ${line.productKey}`);
    }
    const now = new Date();
    const transferData: InsertBranchInventoryTransfer = { userId, sourceBranchId, targetBranchId, status: "in_transit", note, sentAt: now, sentBy };
    const transferResult = await tx.insert(branchInventoryTransfers).values(transferData);
    const transferId = Number(transferResult[0].insertId);
    const notificationResult = await tx.insert(branchTransferNotifications).values({
      managerUserId: managerNotification.managerUserId,
      merchantUserId: userId,
      branchId: targetBranchId,
      transferId,
      type: "transfer_created",
      title: managerNotification.title,
      body: managerNotification.body,
    });
    const transferLines: InsertBranchInventoryTransferLine[] = requestedLines.map((line) => {
      const balance = balanceByKey.get(line.productKey)!;
      return { transferId, productKey: line.productKey, productName: balance.productName, productSku: balance.productSku, quantity: line.quantity };
    });
    await tx.insert(branchInventoryTransferLines).values(transferLines);
    const persistedLines = await tx.select().from(branchInventoryTransferLines).where(eq(branchInventoryTransferLines.transferId, transferId));
    for (const line of persistedLines) {
      const updateResult = await tx.update(inventoryBalances).set({ quantity: sql`${inventoryBalances.quantity} - ${line.quantity}`, updatedAt: now }).where(and(eq(inventoryBalances.userId, userId), eq(inventoryBalances.branchId, sourceBranchId), eq(inventoryBalances.productKey, line.productKey), gte(inventoryBalances.quantity, line.quantity)));
      if (affectedRowsOf(updateResult) !== 1) throw new Error(`Source stock changed before transfer could be sent for ${line.productKey}`);
    }
    const movements: InsertBranchInventoryTransferMovement[] = persistedLines.map((line) => ({ userId, transferId, transferLineId: line.id, branchId: sourceBranchId, productKey: line.productKey, quantityChange: -line.quantity, direction: "sent", actorId: sentBy }));
    await tx.insert(branchInventoryTransferMovements).values(movements);
    return { transferId, notificationId: Number(notificationResult[0].insertId), sourceBranch, targetBranch, lineCount: persistedLines.length, quantitySent: persistedLines.reduce((sum, line) => sum + line.quantity, 0) };
  });
}

/** Adds an in-transit transfer to the destination only after explicit target-branch approval. */
export async function receiveBranchInventoryTransfer(userId: number, transferId: number, receivedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensurePrimaryBranchForUser(userId);
  return db.transaction(async (tx) => {
    const transferRows = await tx.select().from(branchInventoryTransfers).where(and(eq(branchInventoryTransfers.id, transferId), eq(branchInventoryTransfers.userId, userId))).limit(1);
    const transfer = transferRows[0];
    if (!transfer) throw new Error("Inventory transfer not found");
    const managerAssignment = await tx.select().from(branchManagerAssignments).where(and(eq(branchManagerAssignments.merchantUserId, userId), eq(branchManagerAssignments.branchId, transfer.targetBranchId), eq(branchManagerAssignments.managerUserId, receivedBy))).limit(1);
    if (!managerAssignment[0]) throw new Error("Only the assigned target-branch manager may approve this receipt");
    if (!canReceiveBranchTransfer(transfer.status)) throw new Error("This transfer is not awaiting target receipt");
    const targetBranch = await getOwnedBranch(tx, userId, transfer.targetBranchId);
    if (!targetBranch) throw new Error("Destination branch was not found");
    const lines = await tx.select().from(branchInventoryTransferLines).where(eq(branchInventoryTransferLines.transferId, transfer.id));
    if (!lines.length) throw new Error("Transfer has no stock lines");
    const receivedAt = new Date();
    for (const line of lines) {
      await tx.insert(inventoryBalances).values({ userId, branchId: targetBranch.id, productKey: line.productKey, productName: line.productName, productSku: line.productSku, quantity: line.quantity, updatedAt: receivedAt }).onDuplicateKeyUpdate({
        set: { quantity: sql`${inventoryBalances.quantity} + ${line.quantity}`, productName: line.productName, productSku: line.productSku, updatedAt: receivedAt },
      });
    }
    const movements: InsertBranchInventoryTransferMovement[] = lines.map((line) => ({ userId, transferId: transfer.id, transferLineId: line.id, branchId: targetBranch.id, productKey: line.productKey, quantityChange: line.quantity, direction: "received", actorId: receivedBy }));
    await tx.insert(branchInventoryTransferMovements).values(movements);
    const updateResult = await tx.update(branchInventoryTransfers).set({ status: "received", receivedAt, receivedBy, updatedAt: receivedAt }).where(and(eq(branchInventoryTransfers.id, transfer.id), eq(branchInventoryTransfers.status, "in_transit")));
    if (affectedRowsOf(updateResult) !== 1) throw new Error("Transfer receipt was already approved");
    return { transferId: transfer.id, targetBranch, lineCount: lines.length, quantityReceived: lines.reduce((sum, line) => sum + line.quantity, 0), receivedAt };
  });
}

/** Returns stock to the source branch only while the target branch has not approved receipt. */
export async function cancelBranchInventoryTransfer(userId: number, transferId: number, canceledBy: number, rawCancellationReason: unknown) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const cancellationReason = normalizeBranchTransferCancellationReason(rawCancellationReason);
  if (!cancellationReason) throw new Error("A cancellation reason between 3 and 500 characters is required");
  await ensurePrimaryBranchForUser(userId);
  return db.transaction(async (tx) => {
    const transferRows = await tx.select().from(branchInventoryTransfers).where(and(eq(branchInventoryTransfers.id, transferId), eq(branchInventoryTransfers.userId, userId))).limit(1);
    const transfer = transferRows[0];
    if (!transfer) throw new Error("Inventory transfer not found");
    if (!canCancelBranchTransfer(transfer.status)) throw new Error("Only an in-transit transfer may be canceled");
    const [sourceBranch, targetBranch] = await Promise.all([getOwnedBranch(tx, userId, transfer.sourceBranchId), getOwnedBranch(tx, userId, transfer.targetBranchId)]);
    if (!sourceBranch || !targetBranch) throw new Error("Source or target branch was not found");
    const canceledAt = new Date();
    const statusResult = await tx.update(branchInventoryTransfers).set({ status: "canceled", cancellationReason, canceledAt, canceledBy, updatedAt: canceledAt }).where(and(eq(branchInventoryTransfers.id, transfer.id), eq(branchInventoryTransfers.status, "in_transit")));
    if (affectedRowsOf(statusResult) !== 1) throw new Error("Transfer receipt was already approved or canceled");
    const lines = await tx.select().from(branchInventoryTransferLines).where(eq(branchInventoryTransferLines.transferId, transfer.id));
    if (!lines.length) throw new Error("Transfer has no stock lines");
    for (const line of lines) {
      await tx.insert(inventoryBalances).values({ userId, branchId: sourceBranch.id, productKey: line.productKey, productName: line.productName, productSku: line.productSku, quantity: line.quantity, updatedAt: canceledAt }).onDuplicateKeyUpdate({
        set: { quantity: sql`${inventoryBalances.quantity} + ${line.quantity}`, productName: line.productName, productSku: line.productSku, updatedAt: canceledAt },
      });
    }
    const movements: InsertBranchInventoryTransferMovement[] = lines.map((line) => ({ userId, transferId: transfer.id, transferLineId: line.id, branchId: sourceBranch.id, productKey: line.productKey, quantityChange: line.quantity, direction: "reversed", actorId: canceledBy }));
    await tx.insert(branchInventoryTransferMovements).values(movements);
    const managerRows = await tx.select().from(branchManagerAssignments).where(and(eq(branchManagerAssignments.merchantUserId, userId), eq(branchManagerAssignments.branchId, targetBranch.id))).limit(1);
    const targetManager = managerRows[0];
    let managerNotification: { id: number; managerUserId: number; title: string; body: string } | undefined;
    if (targetManager) {
      const copy = branchTransferCancellationNotificationCopy({ transferId: transfer.id, branchName: targetBranch.name, cancellationReason });
      const notificationResult = await tx.insert(branchTransferNotifications).values({ managerUserId: targetManager.managerUserId, merchantUserId: userId, branchId: targetBranch.id, transferId: transfer.id, type: "transfer_canceled", ...copy });
      managerNotification = { id: Number(notificationResult[0].insertId), managerUserId: targetManager.managerUserId, ...copy };
    }
    return { transferId: transfer.id, sourceBranch, targetBranch, lineCount: lines.length, quantityReturned: lines.reduce((sum, line) => sum + line.quantity, 0), cancellationReason, canceledAt, managerNotification };
  });
}

export async function listInventoryReorderRulesByUserId(userId: number, branchId?: number) {
  const db = await getDb();
  if (!db) return [];
  await ensurePrimaryBranchForUser(userId);
  const rules = await db.select().from(inventoryReorderRules).where(branchId ? and(eq(inventoryReorderRules.userId, userId), eq(inventoryReorderRules.branchId, branchId)) : eq(inventoryReorderRules.userId, userId)).orderBy(desc(inventoryReorderRules.updatedAt));
  if (!rules.length) return [];
  const balances = await db.select().from(inventoryBalances).where(and(eq(inventoryBalances.userId, userId), inArray(inventoryBalances.branchId, [...new Set(rules.map((rule) => rule.branchId))]), inArray(inventoryBalances.productKey, [...new Set(rules.map((rule) => rule.productKey))])));
  const balanceByKey = new Map(balances.map((balance) => [`${balance.branchId}:${balance.productKey}`, balance]));
  return rules.map((rule) => ({ ...rule, currentQuantity: balanceByKey.get(`${rule.branchId}:${rule.productKey}`)?.quantity ?? 0 }));
}

export async function upsertInventoryReorderRule(data: InsertInventoryReorderRule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalized = normalizeReorderRule(data);
  if (!normalized) throw new Error("Target quantity must be greater than minimum quantity");
  await ensurePrimaryBranchForUser(data.userId);
  const branch = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, data.branchId), eq(branches.userId, data.userId))).limit(1);
  if (!branch[0]) throw new Error("Branch not found");
  await db.insert(inventoryReorderRules).values({ ...data, ...normalized }).onDuplicateKeyUpdate({ set: { ...normalized, productName: data.productName, productSku: data.productSku ?? null, isActive: data.isActive ?? true, updatedAt: new Date() } });
  const rows = await db.select().from(inventoryReorderRules).where(and(eq(inventoryReorderRules.userId, data.userId), eq(inventoryReorderRules.branchId, data.branchId), eq(inventoryReorderRules.productKey, data.productKey))).limit(1);
  return rows[0];
}

export type InventoryReplenishmentNotificationTarget = {
  recipientUserId: number;
  merchantUserId: number;
  branchId: number;
  replenishmentRequestId: number;
  title: string;
  body: string;
};

export async function syncInventoryReplenishmentRequests(userId: number, branchId?: number) {
  const db = await getDb();
  if (!db) return { requests: [], notifications: [] as InventoryReplenishmentNotificationTarget[] };
  const rules = await listInventoryReorderRulesByUserId(userId, branchId);
  if (!rules.length) return { requests: [], notifications: [] as InventoryReplenishmentNotificationTarget[] };
  const created: typeof inventoryReplenishmentRequests.$inferSelect[] = [];
  const notifications: InventoryReplenishmentNotificationTarget[] = [];
  const branchRows = await db.select({ id: branches.id, name: branches.name }).from(branches).where(and(eq(branches.userId, userId), inArray(branches.id, [...new Set(rules.map((rule) => rule.branchId))])));
  const branchNames = new Map(branchRows.map((branch) => [branch.id, branch.name]));
  for (const rule of rules) {
    if (!rule.isActive || !shouldCreateReplenishment(rule.currentQuantity, rule.minimumQuantity, rule.targetQuantity)) continue;
    const active = await db.select().from(inventoryReplenishmentRequests).where(and(eq(inventoryReplenishmentRequests.userId, userId), eq(inventoryReplenishmentRequests.branchId, rule.branchId), eq(inventoryReplenishmentRequests.productKey, rule.productKey), inArray(inventoryReplenishmentRequests.status, ["suggested", "approved", "ordered"]))).orderBy(desc(inventoryReplenishmentRequests.createdAt)).limit(1);
    if (active[0]) {
      await db.update(inventoryReplenishmentRequests).set({ currentQuantity: rule.currentQuantity, suggestedQuantity: suggestedReplenishmentQuantity(rule.currentQuantity, rule.targetQuantity), minimumQuantity: rule.minimumQuantity, updatedAt: new Date() }).where(eq(inventoryReplenishmentRequests.id, active[0].id));
      created.push({ ...active[0], currentQuantity: rule.currentQuantity, suggestedQuantity: suggestedReplenishmentQuantity(rule.currentQuantity, rule.targetQuantity), minimumQuantity: rule.minimumQuantity });
      continue;
    }
    const result = await db.insert(inventoryReplenishmentRequests).values({ userId, branchId: rule.branchId, productKey: rule.productKey, productName: rule.productName, productSku: rule.productSku, currentQuantity: rule.currentQuantity, minimumQuantity: rule.minimumQuantity, suggestedQuantity: suggestedReplenishmentQuantity(rule.currentQuantity, rule.targetQuantity), status: "suggested", createdBy: userId });
    const rows = await db.select().from(inventoryReplenishmentRequests).where(eq(inventoryReplenishmentRequests.id, Number(result[0].insertId))).limit(1);
    if (rows[0]) {
      created.push(rows[0]);
      const copy = inventoryReplenishmentNotificationCopy({ productName: rule.productName, branchName: branchNames.get(rule.branchId) ?? "الفرع", currentQuantity: rule.currentQuantity, minimumQuantity: rule.minimumQuantity, suggestedQuantity: rows[0].suggestedQuantity });
      const manager = await getBranchManagerAssignmentByBranch(userId, rule.branchId);
      const recipientIds = [...new Set([userId, manager?.managerUserId].filter((recipientId): recipientId is number => typeof recipientId === "number"))];
      for (const recipientUserId of recipientIds) {
        await db.insert(inventoryReplenishmentNotifications).values({ recipientUserId, merchantUserId: userId, branchId: rule.branchId, replenishmentRequestId: rows[0].id, type: "replenishment_suggested", ...copy }).onDuplicateKeyUpdate({ set: { title: copy.title, body: copy.body } });
        notifications.push({ recipientUserId, merchantUserId: userId, branchId: rule.branchId, replenishmentRequestId: rows[0].id, ...copy });
      }
    }
  }
  return { requests: created, notifications };
}

export async function listInventoryReplenishmentRequestsByUserId(userId: number, branchId?: number) {
  const db = await getDb();
  if (!db) return [];
  await syncInventoryReplenishmentRequests(userId, branchId);
  return db.select().from(inventoryReplenishmentRequests).where(branchId ? and(eq(inventoryReplenishmentRequests.userId, userId), eq(inventoryReplenishmentRequests.branchId, branchId)) : eq(inventoryReplenishmentRequests.userId, userId)).orderBy(desc(inventoryReplenishmentRequests.updatedAt));
}

export async function syncAndListInventoryReplenishmentRequests(userId: number, branchId?: number) {
  const db = await getDb();
  if (!db) return { requests: [], notifications: [] as InventoryReplenishmentNotificationTarget[] };
  const sync = await syncInventoryReplenishmentRequests(userId, branchId);
  const requests = await db.select().from(inventoryReplenishmentRequests).where(branchId ? and(eq(inventoryReplenishmentRequests.userId, userId), eq(inventoryReplenishmentRequests.branchId, branchId)) : eq(inventoryReplenishmentRequests.userId, userId)).orderBy(desc(inventoryReplenishmentRequests.updatedAt));
  return { requests, notifications: sync.notifications };
}

export async function getInventoryReplenishmentRequestById(requestId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(inventoryReplenishmentRequests).where(eq(inventoryReplenishmentRequests.id, requestId)).limit(1);
  return rows[0];
}

export async function listInventoryReplenishmentRequestsForManager(assignments: { merchantUserId: number; branchId: number }[]) {
  const db = await getDb();
  if (!db || !assignments.length) return [];
  const scoped = await Promise.all(assignments.map(async (assignment) => {
    const [requests, branchRows] = await Promise.all([
      db.select().from(inventoryReplenishmentRequests).where(and(eq(inventoryReplenishmentRequests.userId, assignment.merchantUserId), eq(inventoryReplenishmentRequests.branchId, assignment.branchId))).orderBy(desc(inventoryReplenishmentRequests.updatedAt)),
      db.select({ name: branches.name }).from(branches).where(and(eq(branches.id, assignment.branchId), eq(branches.userId, assignment.merchantUserId))).limit(1),
    ]);
    return requests.map((request) => ({ ...request, branchName: branchRows[0]?.name ?? "الفرع" }));
  }));
  return scoped.flat().sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

export async function listInventoryReplenishmentNotificationsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventoryReplenishmentNotifications).where(eq(inventoryReplenishmentNotifications.recipientUserId, userId)).orderBy(desc(inventoryReplenishmentNotifications.createdAt));
}

export async function markInventoryReplenishmentNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(inventoryReplenishmentNotifications).set({ readAt: new Date() }).where(and(eq(inventoryReplenishmentNotifications.id, notificationId), eq(inventoryReplenishmentNotifications.recipientUserId, userId), isNull(inventoryReplenishmentNotifications.readAt)));
}

export async function listInventoryReplenishmentAudits(userId: number, branchId?: number, requestId?: number) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(inventoryReplenishmentAudits.userId, userId)];
  if (branchId) filters.push(eq(inventoryReplenishmentAudits.branchId, branchId));
  if (requestId) filters.push(eq(inventoryReplenishmentAudits.requestId, requestId));
  const audits = await db.select().from(inventoryReplenishmentAudits).where(and(...filters)).orderBy(desc(inventoryReplenishmentAudits.createdAt));
  if (!audits.length) return [];
  const requestIds = [...new Set(audits.map((audit) => audit.requestId))];
  const branchIds = [...new Set(audits.map((audit) => audit.branchId))];
  const actorIds = [...new Set(audits.map((audit) => audit.actorUserId))];
  const [requests, branchRows, actorRows] = await Promise.all([
    db.select({ id: inventoryReplenishmentRequests.id, productName: inventoryReplenishmentRequests.productName, productSku: inventoryReplenishmentRequests.productSku, requestedQuantity: inventoryReplenishmentRequests.suggestedQuantity, receivedQuantity: inventoryReplenishmentRequests.receivedQuantity, currentQuantity: inventoryReplenishmentRequests.currentQuantity, minimumQuantity: inventoryReplenishmentRequests.minimumQuantity }).from(inventoryReplenishmentRequests).where(inArray(inventoryReplenishmentRequests.id, requestIds)),
    db.select({ id: branches.id, name: branches.name }).from(branches).where(and(eq(branches.userId, userId), inArray(branches.id, branchIds))),
    db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, actorIds)),
  ]);
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const branchById = new Map(branchRows.map((branch) => [branch.id, branch]));
  const actorById = new Map(actorRows.map((actor) => [actor.id, actor]));
  return audits.map((audit) => ({
    ...audit,
    productName: requestById.get(audit.requestId)?.productName ?? "منتج",
    productSku: requestById.get(audit.requestId)?.productSku ?? null,
    requestedQuantity: requestById.get(audit.requestId)?.requestedQuantity ?? 0,
    receivedQuantity: requestById.get(audit.requestId)?.receivedQuantity ?? 0,
    currentQuantity: requestById.get(audit.requestId)?.currentQuantity ?? 0,
    minimumQuantity: requestById.get(audit.requestId)?.minimumQuantity ?? 0,
    branchName: branchById.get(audit.branchId)?.name ?? "الفرع",
    actorName: actorById.get(audit.actorUserId)?.name ?? actorById.get(audit.actorUserId)?.email ?? `#${audit.actorUserId}`,
  }));
}

export async function transitionInventoryReplenishmentRequest(userId: number, requestId: number, nextStatus: ReplenishmentStatus, reviewedBy: number, receivedQuantity?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(inventoryReplenishmentRequests).where(and(eq(inventoryReplenishmentRequests.id, requestId), eq(inventoryReplenishmentRequests.userId, userId))).limit(1);
    const request = rows[0];
    if (!request) throw new Error("Replenishment request not found");
    if (!canTransitionReplenishment(request.status, nextStatus)) throw new Error("This replenishment transition is not allowed");
    const now = new Date();
    const nextReceivedQuantity = receivedQuantity ?? request.receivedQuantity;
    if (!Number.isInteger(nextReceivedQuantity) || nextReceivedQuantity < 0 || nextReceivedQuantity > 1_000_000) throw new Error("Received quantity must be a valid non-negative number");
    const result = await tx.update(inventoryReplenishmentRequests).set({ status: nextStatus, receivedQuantity: nextReceivedQuantity, reviewedBy, reviewedAt: now, updatedAt: now }).where(and(eq(inventoryReplenishmentRequests.id, requestId), eq(inventoryReplenishmentRequests.userId, userId), eq(inventoryReplenishmentRequests.status, request.status)));
    if (affectedRowsOf(result) !== 1) throw new Error("The replenishment request was already updated");
    const updatedRows = await tx.select().from(inventoryReplenishmentRequests).where(eq(inventoryReplenishmentRequests.id, requestId)).limit(1);
    const updated = updatedRows[0];
    if (!updated) throw new Error("Replenishment request disappeared after update");
    const audit = replenishmentAuditTransition(request.status, nextStatus);
    if (!audit) throw new Error("This replenishment transition is not auditable");
    await tx.insert(inventoryReplenishmentAudits).values({ userId, branchId: request.branchId, requestId: request.id, ...audit, actorUserId: reviewedBy, createdAt: now });
    if (nextStatus !== "approved" && nextStatus !== "closed") return { request: updated, notification: undefined };
    const branchRows = await tx.select({ name: branches.name }).from(branches).where(and(eq(branches.id, request.branchId), eq(branches.userId, userId))).limit(1);
    const copy = inventoryReplenishmentStatusNotificationCopy({ productName: request.productName, branchName: branchRows[0]?.name ?? "الفرع", status: nextStatus, requestedQuantity: request.suggestedQuantity, receivedQuantity: nextReceivedQuantity });
    const type = nextStatus === "approved" ? "replenishment_approved" : "replenishment_closed";
    await tx.insert(inventoryReplenishmentNotifications).values({ recipientUserId: userId, merchantUserId: userId, branchId: request.branchId, replenishmentRequestId: request.id, type, ...copy }).onDuplicateKeyUpdate({ set: { title: copy.title, body: copy.body } });
    return { request: updated, notification: { recipientUserId: userId, merchantUserId: userId, branchId: request.branchId, replenishmentRequestId: request.id, ...copy } };
  });
}

export async function createInventoryCountSession(userId: number, branchId: number, rawLines: unknown, note: string | undefined, createdBy: number, submit: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const requestedLines = normalizeCountLines(rawLines);
  if (!requestedLines) throw new Error("Valid unique count lines are required");
  await ensurePrimaryBranchForUser(userId);
  return db.transaction(async (tx) => {
    const branch = await getOwnedBranch(tx, userId, branchId);
    if (!branch) throw new Error("Branch not found");
    const balances = await tx.select().from(inventoryBalances).where(and(eq(inventoryBalances.userId, userId), eq(inventoryBalances.branchId, branchId), inArray(inventoryBalances.productKey, requestedLines.map((line) => line.productKey))));
    const balancesByKey = new Map(balances.map((balance) => [balance.productKey, balance]));
    const lines = requestedLines.map((line) => {
      const balance = balancesByKey.get(line.productKey);
      if (!balance) throw new Error(`Product is not registered in this branch: ${line.productKey}`);
      return { ...line, productName: balance.productName, productSku: balance.productSku, systemQuantity: balance.quantity, varianceQuantity: varianceForCount(balance.quantity, line.countedQuantity) };
    });
    const now = new Date();
    const sessionResult = await tx.insert(inventoryCountSessions).values({ userId, branchId, status: submit ? "submitted" : "draft", note, createdBy, submittedAt: submit ? now : null });
    const sessionId = Number(sessionResult[0].insertId);
    await tx.insert(inventoryCountLines).values(lines.map((line) => ({ ...line, sessionId })));
    return { sessionId, branch, status: submit ? "submitted" as const : "draft" as const, lineCount: lines.length, varianceUnits: lines.reduce((sum, line) => sum + Math.abs(line.varianceQuantity), 0), createdAt: now };
  });
}

export async function listInventoryCountSessionsByUserId(userId: number, branchId?: number) {
  const db = await getDb();
  if (!db) return [];
  const sessions = await db.select().from(inventoryCountSessions).where(branchId ? and(eq(inventoryCountSessions.userId, userId), eq(inventoryCountSessions.branchId, branchId)) : eq(inventoryCountSessions.userId, userId)).orderBy(desc(inventoryCountSessions.updatedAt));
  if (!sessions.length) return [];
  const lines = await db.select().from(inventoryCountLines).where(inArray(inventoryCountLines.sessionId, sessions.map((session) => session.id))).orderBy(inventoryCountLines.id);
  const branchRows = await db.select().from(branches).where(and(eq(branches.userId, userId), inArray(branches.id, [...new Set(sessions.map((session) => session.branchId))])));
  const branchById = new Map(branchRows.map((branch) => [branch.id, branch]));
  return sessions.map((session) => ({ ...session, branch: branchById.get(session.branchId), lines: lines.filter((line) => line.sessionId === session.id) }));
}

export async function submitInventoryCountSession(userId: number, sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(inventoryCountSessions).set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() }).where(and(eq(inventoryCountSessions.id, sessionId), eq(inventoryCountSessions.userId, userId), eq(inventoryCountSessions.status, "draft")));
  if (affectedRowsOf(result) !== 1) throw new Error("Only a draft stock count can be submitted");
  const rows = await db.select().from(inventoryCountSessions).where(eq(inventoryCountSessions.id, sessionId)).limit(1);
  return rows[0];
}

export async function approveInventoryCountSession(userId: number, sessionId: number, approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensurePrimaryBranchForUser(userId);
  return db.transaction(async (tx) => {
    const sessions = await tx.select().from(inventoryCountSessions).where(and(eq(inventoryCountSessions.id, sessionId), eq(inventoryCountSessions.userId, userId))).limit(1);
    const session = sessions[0];
    if (!session) throw new Error("Stock count session not found");
    if (!canApproveInventoryCount(session.status, true)) throw new Error("Only a submitted stock count can be approved by the merchant owner");
    const lines = await tx.select().from(inventoryCountLines).where(eq(inventoryCountLines.sessionId, sessionId));
    if (!lines.length) throw new Error("Stock count has no lines");
    const approvedAt = new Date();
    const statusResult = await tx.update(inventoryCountSessions).set({ status: "approved", approvedBy, approvedAt, updatedAt: approvedAt }).where(and(eq(inventoryCountSessions.id, sessionId), eq(inventoryCountSessions.status, "submitted")));
    if (affectedRowsOf(statusResult) !== 1) throw new Error("Stock count was already reviewed");
    for (const line of lines) {
      await tx.insert(inventoryBalances).values({ userId, branchId: session.branchId, productKey: line.productKey, productName: line.productName, productSku: line.productSku, quantity: line.countedQuantity, updatedAt: approvedAt }).onDuplicateKeyUpdate({ set: { quantity: line.countedQuantity, productName: line.productName, productSku: line.productSku, updatedAt: approvedAt } });
    }
    const adjustments: InsertInventoryCountAdjustment[] = lines.map((line) => ({ userId, branchId: session.branchId, sessionId, lineId: line.id, productKey: line.productKey, quantityChange: line.varianceQuantity, approvedBy }));
    await tx.insert(inventoryCountAdjustments).values(adjustments);
    return { sessionId, branchId: session.branchId, lineCount: lines.length, varianceUnits: lines.reduce((sum, line) => sum + Math.abs(line.varianceQuantity), 0), approvedAt };
  });
}

function affectedRowsOf(result: unknown) {
  if (!Array.isArray(result) || !result[0] || typeof result[0] !== "object") return 0;
  const affectedRows = (result[0] as { affectedRows?: unknown }).affectedRows;
  return typeof affectedRows === "number" ? affectedRows : 0;
}

function safelyParseJson(value: string) {
  try { return JSON.parse(value) as unknown; } catch { return undefined; }
}

export async function upsertSubscription(data: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet = { ...data, updatedAt: new Date() };
  await db.insert(subscriptions).values(data).onDuplicateKeyUpdate({ set: updateSet });
  return getSubscriptionByUserId(data.userId);
}

export async function setSubscriptionCancelAtPeriodEnd(userId: number, cancelAtPeriodEnd: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(subscriptions).set({ cancelAtPeriodEnd, updatedAt: new Date() }).where(eq(subscriptions.userId, userId));
  return getSubscriptionByUserId(userId);
}

export async function upsertInvoice(data: InsertInvoice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet = { ...data, updatedAt: new Date() };
  await db.insert(invoices).values(data).onDuplicateKeyUpdate({ set: updateSet });
}

export async function listInvoicesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
}

export async function createManualPayment(data: InsertManualPayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(manualPayments).values(data);
  return Number(result[0].insertId);
}

export async function listManualPaymentsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(manualPayments).where(eq(manualPayments.userId, userId)).orderBy(desc(manualPayments.createdAt));
}

export async function listPendingManualPayments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(manualPayments).where(eq(manualPayments.status, "pending")).orderBy(desc(manualPayments.createdAt));
}

export async function reviewManualPayment(id: number, reviewerId: number, approved: boolean, reviewNote?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(manualPayments).where(eq(manualPayments.id, id)).limit(1);
  const payment = rows[0];
  if (!payment) throw new Error("Manual payment not found");

  await db.update(manualPayments).set({
    status: approved ? "approved" : "rejected",
    reviewNote: reviewNote ?? null,
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(manualPayments.id, id));

  const currentPeriodEnd = new Date();
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
  await upsertSubscription({
    userId: payment.userId,
    provider: "instapay",
    status: approved ? "active" : "manual_rejected",
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    currentPeriodEnd: approved ? currentPeriodEnd : null,
  });
}

export async function hasProcessedPaymentEvent(providerEventId: string) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: paymentEvents.id }).from(paymentEvents).where(eq(paymentEvents.providerEventId, providerEventId)).limit(1);
  return rows.length > 0;
}

export async function recordPaymentEvent(provider: "stripe" | "paytabs" | "paypal", providerEventId: string, eventType: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(paymentEvents).values({ provider, providerEventId, eventType });
}
