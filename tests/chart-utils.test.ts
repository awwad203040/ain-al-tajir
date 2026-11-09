import { describe, expect, it } from "vitest";

import { trendData } from "../lib/chart-data";
import { buildAreaPath, buildSmoothLinePath, calculatePerformanceChange, formatCompactNumber, nearestPointIndex, scaleSeries } from "../lib/chart-utils";

const padding = { top: 20, right: 10, bottom: 30, left: 10 };

describe("interactive chart utilities", () => {
  it("scales every value inside the drawable chart area", () => {
    const points = scaleSeries([10, 20, 15, 30], 300, 200, padding);
    expect(points).toHaveLength(4);
    expect(points[0].x).toBe(10);
    expect(points[3].x).toBe(290);
    expect(points.every((point) => point.y >= 20 && point.y <= 170)).toBe(true);
  });

  it("builds smooth line and closed area paths", () => {
    const points = scaleSeries([10, 20, 15], 240, 160, padding);
    expect(buildSmoothLinePath(points)).toMatch(/^M /);
    expect(buildSmoothLinePath(points)).toContain(" C ");
    expect(buildAreaPath(points, 130)).toMatch(/ Z$/);
  });

  it("selects the nearest visible point during drag interaction", () => {
    const points = scaleSeries([10, 20, 30], 220, 160, padding);
    expect(nearestPointIndex(12, points)).toBe(0);
    expect(nearestPointIndex(110, points)).toBe(1);
    expect(nearestPointIndex(209, points)).toBe(2);
  });

  it("formats compact currency values for Arabic and English", () => {
    expect(formatCompactNumber(48_720, "ar")).toContain("ألف");
    expect(formatCompactNumber(327_450, "en")).toBe("327K");
  });

  it("calculates growth, decline, and flat performance correctly", () => {
    const growth = calculatePerformanceChange(120, 100);
    const decline = calculatePerformanceChange(80, 100);
    const flat = calculatePerformanceChange(100, 100);
    expect(growth).toMatchObject({ amount: 20, percent: 20, direction: "up" });
    expect(decline).toMatchObject({ amount: -20, percent: -20, direction: "down" });
    expect(flat).toMatchObject({ amount: 0, percent: 0, direction: "flat" });
  });

  it("uses one shared domain when comparing current and previous series", () => {
    const current = scaleSeries([100, 200], 220, 160, padding, { min: 50, max: 250 });
    const previous = scaleSeries([50, 250], 220, 160, padding, { min: 50, max: 250 });
    expect(previous[0].y).toBeGreaterThan(current[0].y);
    expect(previous[1].y).toBeLessThan(current[1].y);
  });

  it("keeps sales, profit, and labels aligned for every time range", () => {
    Object.values(trendData).forEach((range) => {
      expect(range.sales).toHaveLength(range.profit.length);
      expect(range.sales).toHaveLength(range.previousSales.length);
      expect(range.profit).toHaveLength(range.previousProfit.length);
      expect(range.sales).toHaveLength(range.labels.ar.length);
      expect(range.sales).toHaveLength(range.labels.en.length);
    });
  });
});
