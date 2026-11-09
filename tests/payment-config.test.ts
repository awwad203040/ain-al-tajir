import { afterEach, describe, expect, it, vi } from "vitest";

describe("payment provider configuration", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.AIN_STRIPE_SECRET_KEY;
    delete process.env.AIN_STRIPE_WEBHOOK_SECRET;
    delete process.env.PAYMENT_RETURN_URL;
  });

  it("keeps Stripe disabled until every server-side setting exists", async () => {
    process.env.AIN_STRIPE_SECRET_KEY = "sk_test_example";
    process.env.PAYMENT_RETURN_URL = "https://example.test";
    const { getProviderAvailability } = await import("../server/payments/providers");
    expect(getProviderAvailability().find((item) => item.provider === "stripe")?.enabled).toBe(false);
  });

  it("enables Stripe only with complete configuration and keeps future providers disabled", async () => {
    process.env.AIN_STRIPE_SECRET_KEY = "sk_test_example";
    process.env.AIN_STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.PAYMENT_RETURN_URL = "https://example.test";
    const { getProviderAvailability } = await import("../server/payments/providers");
    const providers = getProviderAvailability();
    expect(providers.find((item) => item.provider === "stripe")?.enabled).toBe(true);
    expect(providers.find((item) => item.provider === "instapay")).toBeUndefined();
    expect(providers.find((item) => item.provider === "paytabs")?.enabled).toBe(false);
    expect(providers.find((item) => item.provider === "paypal")?.enabled).toBe(false);
  });
});
