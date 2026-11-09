export const INVENTORY_COUNT_STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
export type InventoryCountStatus = (typeof INVENTORY_COUNT_STATUSES)[number];

export const REPLENISHMENT_STATUSES = ["suggested", "approved", "ordered", "closed", "dismissed"] as const;
export type ReplenishmentStatus = (typeof REPLENISHMENT_STATUSES)[number];

export type CountLineInput = {
  productKey: string;
  productName: string;
  productSku?: string | null;
  systemQuantity: number;
  countedQuantity: number;
  note?: string | null;
};

export function normalizeNonNegativeInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000) return value;
  return undefined;
}

export function normalizeCountLines(raw: unknown): CountLineInput[] | undefined {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 500) return undefined;
  const seen = new Set<string>();
  const lines: CountLineInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return undefined;
    const line = item as Record<string, unknown>;
    const productKey = typeof line.productKey === "string" ? line.productKey.trim().slice(0, 191) : "";
    const productName = typeof line.productName === "string" ? line.productName.trim().slice(0, 191) : "";
    const systemQuantity = normalizeNonNegativeInteger(line.systemQuantity);
    const countedQuantity = normalizeNonNegativeInteger(line.countedQuantity);
    if (!productKey || !productName || systemQuantity === undefined || countedQuantity === undefined || seen.has(productKey)) return undefined;
    seen.add(productKey);
    lines.push({
      productKey,
      productName,
      productSku: typeof line.productSku === "string" ? line.productSku.trim().slice(0, 128) || null : null,
      systemQuantity,
      countedQuantity,
      note: typeof line.note === "string" ? line.note.trim().slice(0, 300) || null : null,
    });
  }
  return lines;
}

export function varianceForCount(systemQuantity: number, countedQuantity: number) {
  return countedQuantity - systemQuantity;
}

export function canSubmitInventoryCount(status: InventoryCountStatus) {
  return status === "draft";
}

export function canApproveInventoryCount(status: InventoryCountStatus, isMerchantOwner: boolean) {
  return isMerchantOwner && status === "submitted";
}

export function normalizeReorderRule(input: { minimumQuantity: number; targetQuantity: number }) {
  const minimumQuantity = normalizeNonNegativeInteger(input.minimumQuantity);
  const targetQuantity = normalizeNonNegativeInteger(input.targetQuantity);
  if (minimumQuantity === undefined || targetQuantity === undefined || targetQuantity <= minimumQuantity) return undefined;
  return { minimumQuantity, targetQuantity };
}

export function shouldCreateReplenishment(currentQuantity: number, minimumQuantity: number, targetQuantity: number) {
  return currentQuantity <= minimumQuantity && targetQuantity > currentQuantity;
}

export function suggestedReplenishmentQuantity(currentQuantity: number, targetQuantity: number) {
  return Math.max(0, targetQuantity - currentQuantity);
}

export function canTransitionReplenishment(status: ReplenishmentStatus, next: ReplenishmentStatus) {
  if (status === "suggested") return next === "approved" || next === "dismissed";
  if (status === "approved") return next === "ordered" || next === "dismissed";
  if (status === "ordered") return next === "closed";
  return false;
}

export function replenishmentAuditTransition(fromStatus: ReplenishmentStatus, toStatus: ReplenishmentStatus) {
  return canTransitionReplenishment(fromStatus, toStatus) ? { fromStatus, toStatus } : undefined;
}
