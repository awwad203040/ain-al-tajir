export const PURCHASE_ORDER_STATUSES = ["draft", "submitted", "approved", "partially_received", "received", "canceled"] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export type PurchaseOrderLineProgress = {
  orderedQuantity: number;
  receivedQuantity: number;
  rejectedQuantity: number;
};

const transitionMap: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ["submitted", "canceled"],
  submitted: ["approved", "canceled"],
  approved: [],
  partially_received: [],
  received: [],
  canceled: [],
};

/** Explicit workflow transitions; receipt states are calculated from confirmed line quantities only. */
export function canTransitionPurchaseOrder(current: PurchaseOrderStatus, next: PurchaseOrderStatus) {
  return transitionMap[current].includes(next);
}

export function outstandingPurchaseQuantity(line: PurchaseOrderLineProgress) {
  return Math.max(0, line.orderedQuantity - line.receivedQuantity - line.rejectedQuantity);
}

/** Returns the status after a merchant-confirmed receipt without changing inventory. */
export function statusAfterReceipt(lines: PurchaseOrderLineProgress[]): Extract<PurchaseOrderStatus, "partially_received" | "received"> {
  return lines.every((line) => outstandingPurchaseQuantity(line) === 0) ? "received" : "partially_received";
}

export function totalPurchaseOrderMinor(lines: { orderedQuantity: number; unitCostMinor: number }[]) {
  const total = lines.reduce((sum, line) => sum + line.orderedQuantity * line.unitCostMinor, 0);
  return Number.isSafeInteger(total) && total > 0 && total <= 1_000_000_000 ? total : undefined;
}

export type ReceiptSnapshotLine = { lineId: number; receivedQuantity: number; rejectedQuantity: number };

/** Parses stored receipt data defensively before it can affect a stock balance. */
export function parseReceiptSnapshot(value: unknown): ReceiptSnapshotLine[] | undefined {
  if (!Array.isArray(value) || !value.length || value.length > 100) return undefined;
  const parsed: ReceiptSnapshotLine[] = [];
  const ids = new Set<number>();
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const line = item as Partial<ReceiptSnapshotLine>;
    if (!Number.isSafeInteger(line.lineId) || !Number.isSafeInteger(line.receivedQuantity) || !Number.isSafeInteger(line.rejectedQuantity)) return undefined;
    const lineId = line.lineId as number;
    const receivedQuantity = line.receivedQuantity as number;
    const rejectedQuantity = line.rejectedQuantity as number;
    if (!lineId || receivedQuantity < 0 || rejectedQuantity < 0 || receivedQuantity + rejectedQuantity <= 0 || ids.has(lineId)) return undefined;
    ids.add(lineId);
    parsed.push({ lineId, receivedQuantity, rejectedQuantity });
  }
  return parsed;
}

export function inventoryProductKey(productName: string, productSku?: string | null) {
  const sku = productSku?.trim().toLocaleLowerCase();
  if (sku) return `sku:${sku}`;
  const name = productName.trim().toLocaleLowerCase();
  return name ? `name:${name}` : undefined;
}
