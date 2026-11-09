import { describe, expect, it } from "vitest";

import { feeProfileForChannel, normalizeSalesChannelFeeProfiles } from "../lib/sales-channel-fees";

describe("sales channel fee profiles", () => {
  it("keeps only positive merchant-entered fees for recognized sales channels", () => {
    const profiles = normalizeSalesChannelFeeProfiles([
      { channelId: "marketplace", feeMinor: 1250, updatedAt: "2026-09-26T08:00:00.000Z" },
      { channelId: "storefront", feeMinor: 700, updatedAt: "2026-09-26T08:00:00.000Z" },
      { channelId: "other", feeMinor: 0, updatedAt: "2026-09-26T08:00:00.000Z" },
      { channelId: "unknown", feeMinor: 500, updatedAt: "2026-09-26T08:00:00.000Z" },
    ]);
    expect(profiles).toEqual([
      { channelId: "storefront", feeMinor: 700, updatedAt: "2026-09-26T08:00:00.000Z" },
      { channelId: "marketplace", feeMinor: 1250, updatedAt: "2026-09-26T08:00:00.000Z" },
    ]);
  });

  it("uses the latest profile when a local storage value contains duplicates", () => {
    const profiles = normalizeSalesChannelFeeProfiles([
      { channelId: "social", feeMinor: 400, updatedAt: "2026-09-20T08:00:00.000Z" },
      { channelId: "social", feeMinor: 650, updatedAt: "2026-09-26T08:00:00.000Z" },
    ]);
    expect(feeProfileForChannel(profiles, "social")).toEqual({ channelId: "social", feeMinor: 650, updatedAt: "2026-09-26T08:00:00.000Z" });
    expect(feeProfileForChannel(profiles, "physical")).toBeUndefined();
  });

  it("never creates a fee profile without a merchant-entered amount", () => {
    expect(normalizeSalesChannelFeeProfiles(undefined)).toEqual([]);
    expect(normalizeSalesChannelFeeProfiles([{ channelId: "storefront", feeMinor: -1, updatedAt: "2026-09-26T08:00:00.000Z" }])).toEqual([]);
  });
});
