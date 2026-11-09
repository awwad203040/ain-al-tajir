import { describe, expect, it } from "vitest";

describe("Stripe test credentials", () => {
  const secret = process.env.AIN_STRIPE_SECRET_KEY;

  it.skipIf(!secret)("authenticates against the Stripe account endpoint when Stripe is enabled", async () => {
    expect(secret?.startsWith("sk_test_"), "Use a Stripe test secret, not a live key").toBe(true);

    const response = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    expect(response.status, await response.text()).toBe(200);
  });
});
