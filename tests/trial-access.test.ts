import { describe, expect, it } from "vitest";

import { getTrialDaysRemaining, resolveAccountAccess, trialEndsAtFrom, TRIAL_DURATION_DAYS } from "../shared/trial";

describe("merchant free period access", () => {
  const startedAt = new Date("2026-09-01T09:00:00.000Z");

  it("creates a seven-day period from the profile completion timestamp", () => {
    expect(TRIAL_DURATION_DAYS).toBe(7);
    expect(trialEndsAtFrom(startedAt).toISOString()).toBe("2026-09-08T09:00:00.000Z");
  });

  it("allows a completed merchant profile throughout the active free period", () => {
    const access = resolveAccountAccess({ hasMerchantProfile: true, trialEndsAt: "2026-09-08T09:00:00.000Z", subscriptionStatus: "inactive" }, new Date("2026-09-04T09:00:00.000Z"));
    expect(access).toEqual({ kind: "trial", hasAccess: true, trialDaysRemaining: 4 });
  });

  it("routes a new account to store setup and an expired period to subscription", () => {
    expect(resolveAccountAccess({ hasMerchantProfile: false, subscriptionStatus: "inactive" }, new Date("2026-09-01T09:00:00.000Z"))).toEqual({ kind: "setup", hasAccess: false, trialDaysRemaining: 0 });
    expect(resolveAccountAccess({ hasMerchantProfile: true, trialEndsAt: "2026-09-08T09:00:00.000Z", subscriptionStatus: "inactive" }, new Date("2026-09-08T09:00:00.000Z"))).toEqual({ kind: "subscription", hasAccess: false, trialDaysRemaining: 0 });
  });

  it("keeps a paid account active regardless of its former trial dates", () => {
    expect(resolveAccountAccess({ hasMerchantProfile: true, trialEndsAt: "2026-09-01T09:00:00.000Z", subscriptionStatus: "active" }, new Date("2026-09-10T09:00:00.000Z"))).toEqual({ kind: "paid", hasAccess: true, trialDaysRemaining: 0 });
    expect(getTrialDaysRemaining("2026-09-08T10:00:00.000Z", new Date("2026-09-08T09:00:00.000Z"))).toBe(1);
  });
});
