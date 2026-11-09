import { describe, expect, it } from "vitest";

import { buildReplenishmentVarianceHtml, buildReplenishmentVarianceReport, monthKey, monthLabel, recentMonthKeys } from "../lib/replenishment-variance-report";
import type { InventoryReplenishmentAuditRecord } from "../lib/inventory-replenishment-history";

const records: InventoryReplenishmentAuditRecord[] = [
  { id: 1, userId: 1, branchId: 10, requestId: 100, fromStatus: "ordered", toStatus: "closed", actorUserId: 7, createdAt: "2026-10-02T10:00:00Z", productName: "قهوة", productSku: "C-1", branchName: "الرياض", actorName: "مدير الرياض", requestedQuantity: 20, receivedQuantity: 17, currentQuantity: 2, minimumQuantity: 5 },
  { id: 2, userId: 1, branchId: 10, requestId: 101, fromStatus: "ordered", toStatus: "closed", actorUserId: 7, createdAt: "2026-10-03T10:00:00Z", productName: "شاي", productSku: "T-1", branchName: "الرياض", actorName: "مدير الرياض", requestedQuantity: 10, receivedQuantity: 12, currentQuantity: 1, minimumQuantity: 3 },
  { id: 3, userId: 1, branchId: 11, requestId: 102, fromStatus: "ordered", toStatus: "closed", actorUserId: 8, createdAt: "2026-09-03T10:00:00Z", productName: "سكر", productSku: null, branchName: "جدة", actorName: "مدير جدة", requestedQuantity: 8, receivedQuantity: 8, currentQuantity: 2, minimumQuantity: 4 },
  { id: 4, userId: 1, branchId: 10, requestId: 100, fromStatus: "approved", toStatus: "ordered", actorUserId: 1, createdAt: "2026-10-01T10:00:00Z", productName: "قهوة", productSku: "C-1", branchName: "الرياض", actorName: "مالك", requestedQuantity: 20, receivedQuantity: 0, currentQuantity: 2, minimumQuantity: 5 },
];

describe("replenishment variance report", () => {
  it("groups only closed requests by month and branch without double counting", () => {
    expect(monthKey("2026-10-03T10:00:00Z")).toBe("2026-10");
    const rows = buildReplenishmentVarianceReport(records, "2026-10");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ branchId: 10, requests: 2, requestedQuantity: 30, receivedQuantity: 29, receivedRate: 97, difference: -1, shortageQuantity: 3, surplusQuantity: 2 });
  });
  it("filters closed requests to one branch when requested", () => {
    const rows = buildReplenishmentVarianceReport(records, "2026-10", 11);
    expect(rows).toEqual([]);
    expect(buildReplenishmentVarianceReport(records, "2026-09", 11)).toMatchObject([{ branchId: 11, requests: 1 }]);
  });
  it("provides localized month labels and recent choices", () => {
    expect(recentMonthKeys(3, new Date("2026-10-10T00:00:00Z"))).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(monthLabel("2026-10", "ar")).toContain("٢٠٢٦");
  });
  it("exports safe bilingual report HTML", () => {
    const html = buildReplenishmentVarianceHtml(buildReplenishmentVarianceReport(records, "2026-10"), "2026-10", "ar");
    expect(html).toContain("تقرير فروقات إعادة التزويد الشهري");
    expect(html).toContain("النقص");
    expect(html).toContain("نسبة الاستلام");
    expect(html).toContain("الرياض");
    expect(html).toContain("-1");
  });
});
