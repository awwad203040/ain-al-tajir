import { afterEach, describe, expect, it, vi } from "vitest";

import { MERCHANT_MONTHLY_PLAN, hasPaidAccess } from "../shared/payment";
import { mapStripeSubscriptionStatus } from "../server/payments/stripe";

describe("subscription safety", () => {
  afterEach(() => {
    delete process.env.AIN_STRIPE_SECRET_KEY;
    delete process.env.AIN_STRIPE_WEBHOOK_SECRET;
    delete process.env.PAYMENT_RETURN_URL;
    vi.resetModules();
  });

  it("keeps the merchant plan fixed at SAR 100 monthly", () => {
    expect(MERCHANT_MONTHLY_PLAN.amountMinor).toBe(10000);
    expect(MERCHANT_MONTHLY_PLAN.currency).toBe("SAR");
    expect(MERCHANT_MONTHLY_PLAN.interval).toBe("month");
  });

  it("does not grant paid access to pending, failed, or canceled states", () => {
    expect(hasPaidAccess("active")).toBe(true);
    expect(hasPaidAccess("checkout_pending")).toBe(false);
    expect(hasPaidAccess("past_due")).toBe(false);
    expect(hasPaidAccess("canceled")).toBe(false);
    expect(hasPaidAccess("manual_review")).toBe(false);
  });

  it("maps Stripe states to safe local access states", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("active");
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("canceled");
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("checkout_pending");
  });

  it("exposes only the approved automatic providers and keeps them disabled without credentials", async () => {
    const { getProviderAvailability } = await import("../server/payments/providers");
    const providers = getProviderAvailability();
    expect(providers.map((item) => item.provider)).toEqual(["stripe", "paytabs", "paypal"]);
    expect(providers.every((item) => item.enabled === false)).toBe(true);
  });
});
