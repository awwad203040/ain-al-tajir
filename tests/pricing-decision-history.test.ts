import { describe, expect, it } from "vitest";

import { buildPricingDecisionHistoryHtml, decisionGrossMargin, decisionTotalCostMinor, filterPricingDecisionHistory, resolvedDecisionPriceMinor, summarizePricingDecisions, type PricingDecisionHistoryRecord } from "../lib/pricing-decision-history";

const records: PricingDecisionHistoryRecord[] = [
  { id: 1, productQuery: "سماعة لاسلكية", productSku: "AUDIO-1", goal: "balanced", action: "accepted", ownPriceMinor: 22000, costPriceMinor: 16000, additionalCostMinor: 1500, targetPriceMinor: 21000, selectedPriceMinor: 21000, sourceCount: 3, createdAt: "2026-09-21T10:00:00.000Z" },
  { id: 2, productQuery: "Wireless mouse", productBarcode: "1234567890123", goal: "fast_sale", action: "customized", ownPriceMinor: 12000, costPriceMinor: 8000, additionalCostMinor: 750, targetPriceMinor: 11000, selectedPriceMinor: 11500, sourceCount: 2, createdAt: "2026-09-20T10:00:00.000Z" },
  { id: 3, productQuery: "<script>unsafe</script>", goal: "higher_margin", action: "dismissed", ownPriceMinor: 9000, targetPriceMinor: 9500, sourceCount: 1, createdAt: "2026-09-19T10:00:00.000Z" },
];

describe("pricing decision history", () => {
  it("filters by merchant product identity without changing the stored records", () => {
    expect(filterPricingDecisionHistory(records, "audio").map((item) => item.id)).toEqual([1]);
    expect(filterPricingDecisionHistory(records, "1234567890123").map((item) => item.id)).toEqual([2]);
    expect(filterPricingDecisionHistory(records, "")).toBe(records);
  });

  it("summarizes explicit merchant decisions and combines only recorded per-unit costs", () => {
    expect(summarizePricingDecisions(records)).toEqual({ total: 3, accepted: 1, customized: 1, dismissed: 1 });
    expect(resolvedDecisionPriceMinor(records[0])).toBe(21000);
    expect(resolvedDecisionPriceMinor(records[1])).toBe(11500);
    expect(resolvedDecisionPriceMinor(records[2])).toBeUndefined();
    expect(decisionTotalCostMinor(records[0])).toBe(17500);
    expect(decisionGrossMargin(records[0])).toEqual({ grossProfitMinor: 3500, grossMarginPercent: 16.7 });
    expect(decisionGrossMargin(records[2])).toBeUndefined();
  });

  it("builds an audit export with all-in cost and margin data without allowing product text to inject markup", () => {
    const html = buildPricingDecisionHistoryHtml(records, "ar", new Date("2026-09-22T10:00:00.000Z"));
    expect(html).toContain("سجل قرارات التسعير");
    expect(html).toContain("إجمالي القرارات");
    expect(html).toContain("التكلفة الكلية/وحدة");
    expect(html).toContain("تكلفة المنتج");
    expect(html).toContain("إضافات/وحدة");
    expect(html).toContain("الهامش الإجمالي");
    expect(html).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
    expect(html).not.toContain("<script>unsafe</script>");
    expect(html).toContain("٢١٠٫٠٠ SAR");
    expect(html).toContain("١٦٫٧%");
  });

  it("renders a clear empty export state", () => {
    const html = buildPricingDecisionHistoryHtml([], "en", new Date("2026-09-22T10:00:00.000Z"));
    expect(html).toContain("No pricing decisions are included in this export.");
    expect(html).toContain("Total decisions");
  });
});
