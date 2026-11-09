import { describe, expect, it } from "vitest";

import { ageInDays, buildProductSearchQuery, buildPublicSearchLinks, compareWithCurrentObservedPrices, compareWithObservedPrices, filterCurrentPriceObservations, getPriceFreshness, isPublicHttpsUrl, matchesPriceObservation, toPriceMinor } from "../shared/price-research";

const NOW = new Date("2026-09-17T12:00:00.000Z");

describe("price research", () => {
  it("normalizes Saudi riyal amounts, including Arabic numerals", () => {
    expect(toPriceMinor("199.50")).toBe(19950);
    expect(toPriceMinor("١٩٩٫٥٠")).toBe(19950);
    expect(toPriceMinor("0")).toBeUndefined();
  });

  it("accepts public HTTPS sources but rejects local or insecure targets", () => {
    expect(isPublicHttpsUrl("https://www.example.sa/product/1")).toBe(true);
    expect(isPublicHttpsUrl("http://www.example.sa/product/1")).toBe(false);
    expect(isPublicHttpsUrl("https://localhost/product/1")).toBe(false);
  });

  it("calculates comparison from recorded sources without inventing a price", () => {
    expect(compareWithObservedPrices(25000, [{ priceMinor: 23000 }, { priceMinor: 24000 }])).toEqual({ lowestPriceMinor: 23000, differenceMinor: 2000, percentDifference: 8.7 });
    expect(compareWithObservedPrices(undefined, [{ priceMinor: 23000 }])).toBeUndefined();
    expect(compareWithObservedPrices(25000, [])).toBeUndefined();
  });

  it("classifies price freshness and excludes old observations from the current benchmark", () => {
    expect(ageInDays("2026-09-14T12:00:00.000Z", NOW)).toBe(3);
    expect(getPriceFreshness("2026-09-11T12:00:00.000Z", NOW)).toBe("current");
    expect(getPriceFreshness("2026-09-05T12:00:00.000Z", NOW)).toBe("review");
    expect(getPriceFreshness("2026-08-10T12:00:00.000Z", NOW)).toBe("stale");
    const observations = [
      { priceMinor: 22000, observedAt: "2026-09-15T12:00:00.000Z" },
      { priceMinor: 18000, observedAt: "2026-08-10T12:00:00.000Z" },
    ];
    expect(filterCurrentPriceObservations(observations, NOW)).toEqual([observations[0]]);
    expect(compareWithCurrentObservedPrices(25000, observations, NOW)).toEqual({ lowestPriceMinor: 22000, differenceMinor: 3000, percentDifference: 13.6 });
  });

  it("builds a search phrase from a product name, SKU, and barcode", () => {
    expect(buildProductSearchQuery("سماعة لاسلكية", "SKU-1", "6280000000000")).toBe("سماعة لاسلكية SKU-1 6280000000000");
    expect(buildPublicSearchLinks("سماعة لاسلكية").google).toContain(encodeURIComponent("سماعة لاسلكية سعر السعودية"));
  });

  it("matches a product by a broad name or an exact SKU or barcode", () => {
    const observation = { productQuery: "سماعة لاسلكية X", productSku: "SPEAKER-001", productBarcode: "6280000000000" };
    expect(matchesPriceObservation({ productQuery: "سماعة لاسلكية" }, observation)).toBe(true);
    expect(matchesPriceObservation({ productSku: "speaker-001" }, observation)).toBe(true);
    expect(matchesPriceObservation({ productBarcode: "6280000000000" }, observation)).toBe(true);
    expect(matchesPriceObservation({ productBarcode: "6280000000099" }, observation)).toBe(false);
  });
});
