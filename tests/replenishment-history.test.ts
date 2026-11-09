import { describe, expect, it } from "vitest";

import { buildReplenishmentAuditHtml, buildReplenishmentRequestHtml, filterReplenishmentAudit, replenishmentQuantityDifference, replenishmentStatusLabel, type InventoryReplenishmentAuditRecord } from "../lib/inventory-replenishment-history";

const records: InventoryReplenishmentAuditRecord[] = [
  { id: 1, userId: 7, branchId: 2, requestId: 11, fromStatus: "suggested", toStatus: "approved", actorUserId: 7, createdAt: "2026-10-07T10:00:00Z", productName: "قهوة عربية", productSku: "COF-1", branchName: "فرع الرياض", actorName: "أحمد", requestedQuantity: 12, receivedQuantity: 0, currentQuantity: 2, minimumQuantity: 5 },
  { id: 2, userId: 7, branchId: 3, requestId: 12, fromStatus: "ordered", toStatus: "closed", actorUserId: 9, createdAt: "2026-10-07T11:00:00Z", productName: "شاي", productSku: null, branchName: "فرع جدة", actorName: "مدير جدة", requestedQuantity: 20, receivedQuantity: 18, currentQuantity: 1, minimumQuantity: 4 },
];

describe("replenishment audit history", () => {
  it("filters by product, branch, actor, or request", () => {
    expect(filterReplenishmentAudit(records, "جدة")).toHaveLength(1);
    expect(filterReplenishmentAudit(records, "#11")).toHaveLength(1);
    expect(filterReplenishmentAudit(records, "COF-1")).toHaveLength(1);
    expect(filterReplenishmentAudit(records, "", "all", undefined, 3)).toHaveLength(1);
    expect(filterReplenishmentAudit(records, "", "all", undefined, undefined, 9)).toHaveLength(1);
  });

  it("filters by resulting status and recent period", () => {
    expect(filterReplenishmentAudit(records, "", "closed")).toHaveLength(1);
    expect(filterReplenishmentAudit(records, "", "approved")).toHaveLength(1);
    expect(filterReplenishmentAudit(records, "", "all", 7, undefined, undefined, new Date("2026-10-08T12:00:00Z"))).toHaveLength(2);
    expect(replenishmentQuantityDifference(20, 18)).toBe(-2);
  });

  it("localizes transition labels and escapes exported content", () => {
    expect(replenishmentStatusLabel("approved", "ar")).toBe("معتمد");
    expect(replenishmentStatusLabel("closed", "en")).toBe("Closed");
    const html = buildReplenishmentAuditHtml([{ ...records[0], productName: "A&B <test>" }], "ar");
    expect(html).toContain("A&amp;B &lt;test&gt;");
    expect(html).toContain("سجل قرارات إعادة التزويد");
    expect(html).toContain("فرع الرياض");
    const detailHtml = buildReplenishmentRequestHtml([records[1]], "ar");
    expect(detailHtml).toContain("تفاصيل طلب إعادة التزويد #12");
    expect(detailHtml).toContain("الكمية المطلوبة");
    expect(detailHtml).toContain("-2");
  });
});
