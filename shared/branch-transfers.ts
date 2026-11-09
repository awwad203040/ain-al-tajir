export const BRANCH_TRANSFER_STATUSES = ["in_transit", "received", "canceled"] as const;
export type BranchTransferStatus = (typeof BRANCH_TRANSFER_STATUSES)[number];

export type BranchTransferLineInput = {
  productKey: string;
  quantity: number;
};

/** A target branch may acknowledge only stock already sent by the source branch. */
export function canReceiveBranchTransfer(status: BranchTransferStatus) {
  return status === "in_transit";
}

/** The merchant may reverse an in-transit transfer only before target receipt is approved. */
export function canCancelBranchTransfer(status: BranchTransferStatus) {
  return status === "in_transit";
}

/** Keeps the owner's audit reason concise, non-empty, and safe for persistence and notifications. */
export function normalizeBranchTransferCancellationReason(value: unknown) {
  if (typeof value !== "string") return undefined;
  const reason = value.trim().replace(/\s+/g, " ");
  return reason.length >= 3 && reason.length <= 500 ? reason : undefined;
}

/** Validates a bounded, duplicate-free transfer request before stock is deducted. */
export function normalizeBranchTransferLines(value: unknown): BranchTransferLineInput[] | undefined {
  if (!Array.isArray(value) || !value.length || value.length > 100) return undefined;
  const productKeys = new Set<string>();
  const lines: BranchTransferLineInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const line = item as Partial<BranchTransferLineInput>;
    if (typeof line.productKey !== "string" || !line.productKey.trim() || line.productKey.trim().length > 191 || !Number.isSafeInteger(line.quantity) || !line.quantity || line.quantity < 1 || line.quantity > 1_000_000) return undefined;
    const productKey = line.productKey.trim().toLocaleLowerCase();
    if (productKeys.has(productKey)) return undefined;
    productKeys.add(productKey);
    lines.push({ productKey, quantity: line.quantity });
  }
  return lines;
}

export function canSendFromBalance(availableQuantity: number, transferQuantity: number) {
  return Number.isSafeInteger(availableQuantity) && Number.isSafeInteger(transferQuantity) && transferQuantity > 0 && availableQuantity >= transferQuantity;
}
