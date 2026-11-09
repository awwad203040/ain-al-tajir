import { describe, expect, it } from "vitest";

import { canTransitionPurchaseOrder, inventoryProductKey, outstandingPurchaseQuantity, parseReceiptSnapshot, statusAfterReceipt, totalPurchaseOrderMinor } from "../shared/procurement";

describe("procurement workflow", () => {
  it("allows only reviewed purchase-order transitions", () => {
    expect(canTransitionPurchaseOrder("draft", "submitted")).toBe(true);
    expect(canTransitionPurchaseOrder("submitted", "approved")).toBe(true);
    expect(canTransitionPurchaseOrder("draft", "approved")).toBe(false);
    expect(canTransitionPurchaseOrder("received", "submitted")).toBe(false);
  });

  it("keeps partial and rejected quantities within the ordered amount", () => {
    expect(outstandingPurchaseQuantity({ orderedQuantity: 10, receivedQuantity: 4, rejectedQuantity: 1 })).toBe(5);
    expect(outstandingPurchaseQuantity({ orderedQuantity: 10, receivedQuantity: 10, rejectedQuantity: 0 })).toBe(0);
    expect(outstandingPurchaseQuantity({ orderedQuantity: 10, receivedQuantity: 8, rejectedQuantity: 4 })).toBe(0);
  });

  it("uses receipt quantities to classify partial versus complete receiving", () => {
    expect(statusAfterReceipt([{ orderedQuantity: 10, receivedQuantity: 6, rejectedQuantity: 0 }])).toBe("partially_received");
    expect(statusAfterReceipt([{ orderedQuantity: 10, receivedQuantity: 8, rejectedQuantity: 2 }, { orderedQuantity: 4, receivedQuantity: 4, rejectedQuantity: 0 }])).toBe("received");
  });

  it("calculates only safe, explicit purchase order totals", () => {
    expect(totalPurchaseOrderMinor([{ orderedQuantity: 3, unitCostMinor: 1200 }, { orderedQuantity: 2, unitCostMinor: 500 }])).toBe(4600);
    expect(totalPurchaseOrderMinor([{ orderedQuantity: 0, unitCostMinor: 1200 }])).toBeUndefined();
    expect(totalPurchaseOrderMinor([{ orderedQuantity: 1_000_000, unitCostMinor: 1_000_001 }])).toBeUndefined();
  });

  it("accepts only valid unique receipt lines before inventory posting", () => {
    expect(parseReceiptSnapshot([{ lineId: 3, receivedQuantity: 4, rejectedQuantity: 0 }])).toEqual([{ lineId: 3, receivedQuantity: 4, rejectedQuantity: 0 }]);
    expect(parseReceiptSnapshot([{ lineId: 3, receivedQuantity: 4, rejectedQuantity: 0 }, { lineId: 3, receivedQuantity: 1, rejectedQuantity: 0 }])).toBeUndefined();
    expect(parseReceiptSnapshot([{ lineId: 3, receivedQuantity: 0, rejectedQuantity: 0 }])).toBeUndefined();
  });

  it("uses SKU before product name for stable inventory balances", () => {
    expect(inventoryProductKey("Arabic Coffee", "CF-AR-250")).toBe("sku:cf-ar-250");
    expect(inventoryProductKey("  Arabic Coffee  ")).toBe("name:arabic coffee");
    expect(inventoryProductKey("   ")).toBeUndefined();
  });
});
