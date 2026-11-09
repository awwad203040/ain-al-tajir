import { describe, expect, it } from "vitest";

import { evaluateMarginTarget, normalizeMarginTargetPercent } from "../lib/margin-target";

describe("merchant margin target", () => {
  it("accepts only an explicit percentage within a safe range", () => {
    expect(normalizeMarginTargetPercent(22.25)).toBe(22.3);
    expect(normalizeMarginTargetPercent(undefined)).toBeUndefined();
    expect(normalizeMarginTargetPercent(0)).toBeUndefined();
    expect(normalizeMarginTargetPercent(100)).toBeUndefined();
    expect(normalizeMarginTargetPercent(Number.NaN)).toBeUndefined();
  });

  it("reports a shortfall without changing an actual margin or price", () => {
    expect(evaluateMarginTarget(14.8, 20)).toEqual({ targetPercent: 20, actualPercent: 14.8, gapPercent: -5.2, status: "below_target" });
    expect(evaluateMarginTarget(24.7, 20)).toEqual({ targetPercent: 20, actualPercent: 24.7, gapPercent: 4.7, status: "on_target" });
  });

  it("requires a computed cost-based margin before judging the target", () => {
    expect(evaluateMarginTarget(undefined, 18)).toEqual({ targetPercent: 18, status: "needs_cost" });
    expect(evaluateMarginTarget(16, undefined)).toBeUndefined();
  });
});
