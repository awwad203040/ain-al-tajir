import { describe, expect, it } from "vitest";

import { buildSmartMarketSearchUrl, calculateGrossMargin, calculateSmartPriceRecommendation, calculateTotalUnitCostMinor, SMART_MARKET_SOURCES } from "../shared/price-research";

const NOW = new Date("2026-09-19T09:00:00.000Z");

const observations = [
  { priceMinor: 19900, currency: "SAR", observedAt: "2026-09-18T09:00:00.000Z" },
  { priceMinor: 20500, currency: "SAR", observedAt: "2026-09-17T09:00:00.000Z" },
  { priceMinor: 18000, currency: "SAR", observedAt: "2026-08-29T09:00:00.000Z" },
];

describe("smart market comparison", () => {
  it("offers five distinct user-initiated market searches", () => {
    expect(SMART_MARKET_SOURCES).toHaveLength(5);
    expect(new Set(SMART_MARKET_SOURCES.map((source) => source.domain)).size).toBe(5);
    const link = buildSmartMarketSearchUrl(SMART_MARKET_SOURCES[0], "سماعة لاسلكية SKU-1");
    expect(link).toContain("google.com/search?q=");
    expect(decodeURIComponent(link)).toContain("site:amazon.sa سماعة لاسلكية SKU-1 سعر السعودية");
  });

  it("uses only current SAR observations for its deterministic target", () => {
    const balanced = calculateSmartPriceRecommendation({ ownPriceMinor: 22000, goal: "balanced", observations, now: NOW });
    expect(balanced).toMatchObject({ sourceCount: 2, preliminary: false, lowestPriceMinor: 19900, medianPriceMinor: 20200, highestPriceMinor: 20500, rawTargetPriceMinor: 20200, targetPriceMinor: 20200, varianceMinor: 1800, variancePercent: 8.9, floorApplied: false });
  });

  it("adapts the target to the merchant's pricing objective", () => {
    expect(calculateSmartPriceRecommendation({ ownPriceMinor: 22000, goal: "fast_sale", observations, now: NOW })?.targetPriceMinor).toBe(19900);
    expect(calculateSmartPriceRecommendation({ ownPriceMinor: 22000, goal: "higher_margin", observations, now: NOW })?.targetPriceMinor).toBe(20350);
  });

  it("combines declared product cost and per-unit fees into one transparent floor", () => {
    const totalCost = calculateTotalUnitCostMinor(18500, 2000);
    expect(totalCost).toBe(20500);
    const floorBounded = calculateSmartPriceRecommendation({ ownPriceMinor: 23000, floorPriceMinor: totalCost, goal: "fast_sale", observations, now: NOW });
    expect(floorBounded).toMatchObject({ rawTargetPriceMinor: 19900, floorPriceMinor: 20500, floorApplied: true, targetPriceMinor: 20500, rangeLowMinor: 20500, rangeHighMinor: 20910 });
    expect(floorBounded?.targetGrossMargin).toEqual({ grossProfitMinor: 0, grossMarginPercent: 0 });
    expect(floorBounded?.ownGrossMargin).toEqual({ grossProfitMinor: 2500, grossMarginPercent: 10.9 });
  });

  it("keeps missing costs distinct from zero and rejects an unsafe combined amount", () => {
    expect(calculateTotalUnitCostMinor(undefined, undefined)).toBeUndefined();
    expect(calculateTotalUnitCostMinor(undefined, 1200)).toBe(1200);
    expect(calculateTotalUnitCostMinor(1_000_000_000, 1)).toBeUndefined();
  });

  it("calculates only an explicit gross margin, not a net-profit claim", () => {
    expect(calculateGrossMargin(22000, 16500)).toEqual({ grossProfitMinor: 5500, grossMarginPercent: 25 });
    expect(calculateGrossMargin(16000, 16500)).toEqual({ grossProfitMinor: -500, grossMarginPercent: -3.1 });
    expect(calculateGrossMargin(22000, undefined)).toBeUndefined();
  });

  it("refuses to make a recommendation without current evidence", () => {
    expect(calculateSmartPriceRecommendation({ ownPriceMinor: 22000, goal: "balanced", observations: [{ priceMinor: 19900, currency: "SAR", observedAt: "2026-08-01T09:00:00.000Z" }], now: NOW })).toBeUndefined();
  });
});
