import { describe, expect, it } from "vitest";

import {
  canApproveInventoryCount,
  canSubmitInventoryCount,
  canTransitionReplenishment,
  normalizeCountLines,
  normalizeReorderRule,
  replenishmentAuditTransition,
  shouldCreateReplenishment,
  suggestedReplenishmentQuantity,
  varianceForCount,
} from "../shared/inventory-operations";

describe("periodic inventory count rules", () => {
  it("calculates physical variance and normalizes unique lines", () => {
    expect(varianceForCount(12, 9)).toBe(-3);
    expect(normalizeCountLines([
      { productKey: "sku-1", productName: "Coffee", systemQuantity: 12, countedQuantity: 9 },
    ])).toEqual([{ productKey: "sku-1", productName: "Coffee", productSku: null, systemQuantity: 12, countedQuantity: 9, note: null }]);
  });

  it("rejects duplicate or invalid count lines", () => {
    expect(normalizeCountLines([
      { productKey: "sku-1", productName: "Coffee", systemQuantity: 1, countedQuantity: 2 },
      { productKey: "sku-1", productName: "Coffee", systemQuantity: 1, countedQuantity: 2 },
    ])).toBeUndefined();
    expect(normalizeCountLines([{ productKey: "sku-2", productName: "Tea", systemQuantity: -1, countedQuantity: 2 }])).toBeUndefined();
  });

  it("requires submitted counts and owner approval", () => {
    expect(canSubmitInventoryCount("draft")).toBe(true);
    expect(canSubmitInventoryCount("submitted")).toBe(false);
    expect(canApproveInventoryCount("submitted", true)).toBe(true);
    expect(canApproveInventoryCount("submitted", false)).toBe(false);
    expect(canApproveInventoryCount("approved", true)).toBe(false);
  });
});

describe("automatic replenishment rules", () => {
  it("creates a suggestion at or below minimum and fills to target", () => {
    expect(normalizeReorderRule({ minimumQuantity: 5, targetQuantity: 20 })).toEqual({ minimumQuantity: 5, targetQuantity: 20 });
    expect(shouldCreateReplenishment(5, 5, 20)).toBe(true);
    expect(shouldCreateReplenishment(6, 5, 20)).toBe(false);
    expect(suggestedReplenishmentQuantity(5, 20)).toBe(15);
  });

  it("rejects an unsafe target and enforces review transitions", () => {
    expect(normalizeReorderRule({ minimumQuantity: 20, targetQuantity: 20 })).toBeUndefined();
    expect(canTransitionReplenishment("suggested", "approved")).toBe(true);
    expect(canTransitionReplenishment("approved", "ordered")).toBe(true);
    expect(canTransitionReplenishment("ordered", "closed")).toBe(true);
    expect(canTransitionReplenishment("closed", "approved")).toBe(false);
  });

  it("records only valid immutable audit transitions", () => {
    expect(replenishmentAuditTransition("suggested", "approved")).toEqual({ fromStatus: "suggested", toStatus: "approved" });
    expect(replenishmentAuditTransition("ordered", "closed")).toEqual({ fromStatus: "ordered", toStatus: "closed" });
    expect(replenishmentAuditTransition("closed", "approved")).toBeUndefined();
  });
});
