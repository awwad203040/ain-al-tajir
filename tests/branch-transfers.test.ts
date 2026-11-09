import { describe, expect, it } from "vitest";

import { canCancelBranchTransfer, canReceiveBranchTransfer, canSendFromBalance, normalizeBranchTransferCancellationReason, normalizeBranchTransferLines } from "../shared/branch-transfers";

describe("branch inventory transfers", () => {
  it("permits target receipt only while the transfer is in transit", () => {
    expect(canReceiveBranchTransfer("in_transit")).toBe(true);
    expect(canReceiveBranchTransfer("received")).toBe(false);
    expect(canReceiveBranchTransfer("canceled")).toBe(false);
  });

  it("permits owner cancellation only while the transfer is in transit", () => {
    expect(canCancelBranchTransfer("in_transit")).toBe(true);
    expect(canCancelBranchTransfer("received")).toBe(false);
    expect(canCancelBranchTransfer("canceled")).toBe(false);
  });

  it("requires and normalizes a bounded cancellation reason", () => {
    expect(normalizeBranchTransferCancellationReason("  كميات   غير صحيحة  ")).toBe("كميات غير صحيحة");
    expect(normalizeBranchTransferCancellationReason("no")).toBeUndefined();
    expect(normalizeBranchTransferCancellationReason("x".repeat(501))).toBeUndefined();
  });

  it("normalizes only bounded, unique product transfer lines", () => {
    expect(normalizeBranchTransferLines([{ productKey: "SKU:COFFEE-250", quantity: 5 }])).toEqual([{ productKey: "sku:coffee-250", quantity: 5 }]);
    expect(normalizeBranchTransferLines([{ productKey: "sku:a", quantity: 1 }, { productKey: "sku:a", quantity: 2 }])).toBeUndefined();
    expect(normalizeBranchTransferLines([{ productKey: "sku:a", quantity: 0 }])).toBeUndefined();
  });

  it("does not allow a branch to send more than its confirmed balance", () => {
    expect(canSendFromBalance(8, 8)).toBe(true);
    expect(canSendFromBalance(8, 9)).toBe(false);
    expect(canSendFromBalance(8, 0)).toBe(false);
  });
});
