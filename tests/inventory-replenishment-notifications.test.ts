import { describe, expect, it } from "vitest";

import { buildInventoryReplenishmentPushMessages } from "../server/inventory-replenishment-notifications";
import { inventoryReplenishmentNotificationCopy, inventoryReplenishmentStatusNotificationCopy } from "../shared/inventory-replenishment-notification";

describe("inventory replenishment notifications", () => {
  it("builds a concise recipient-safe alert", () => {
    const copy = inventoryReplenishmentNotificationCopy({
      productName: "حليب كامل الدسم",
      branchName: "فرع جدة",
      currentQuantity: 2,
      minimumQuantity: 5,
      suggestedQuantity: 18,
    });
    expect(copy.title).toContain("فرع جدة");
    expect(copy.body).toContain("حليب كامل الدسم");
    expect(copy.body).toContain("18");
  });

  it("deduplicates valid devices and routes taps to inventory operations", () => {
    const messages = buildInventoryReplenishmentPushMessages([
      "ExponentPushToken[abc_123-XYZ]",
      "ExponentPushToken[abc_123-XYZ]",
      "not-a-token",
    ], { title: "اقتراح إعادة تزويد", body: "راجع الطلب", replenishmentRequestId: 44 });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: "ExponentPushToken[abc_123-XYZ]",
      data: { route: "/inventory-operations", replenishmentRequestId: 44 },
      channelId: "inventory-replenishment",
    });
  });

  it("creates distinct owner copy for approval and closure", () => {
    const approved = inventoryReplenishmentStatusNotificationCopy({ productName: "قهوة عربية", branchName: "فرع الرياض", status: "approved" });
    const closed = inventoryReplenishmentStatusNotificationCopy({ productName: "قهوة عربية", branchName: "فرع الرياض", status: "closed", actorName: "مدير الفرع" });
    expect(approved.title).toContain("تم اعتماد");
    expect(approved.body).toContain("قهوة عربية");
    expect(closed.title).toContain("تم إغلاق");
    expect(closed.body).toContain("مدير الفرع");
  });

  it("flags a receipt below 80 percent of the requested quantity", () => {
    const alert = inventoryReplenishmentStatusNotificationCopy({ productName: "سكر", branchName: "فرع مكة", status: "closed", requestedQuantity: 100, receivedQuantity: 79 });
    expect(alert.title).toContain("فرق استلام كبير");
    expect(alert.body).toContain("79");
    expect(alert.body).toContain("80٪");
  });
});
