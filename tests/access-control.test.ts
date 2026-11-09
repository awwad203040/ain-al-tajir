import { describe, expect, it } from "vitest";

import { canOpenCustomerPortal, canScheduleSubscriptionCancellation, getDashboardAccessDestination } from "../shared/payment";

describe("authentication and subscription access control", () => {
  it("sends unauthenticated users to login", () => {
    expect(getDashboardAccessDestination(false, null)).toBe("login");
  });

  it("sends authenticated users without active access to the subscription page", () => {
    expect(getDashboardAccessDestination(true, "inactive")).toBe("subscription");
    expect(getDashboardAccessDestination(true, "checkout_pending")).toBe("subscription");
    expect(getDashboardAccessDestination(true, "past_due")).toBe("subscription");
    expect(getDashboardAccessDestination(true, "canceled")).toBe("subscription");
  });

  it("opens the dashboard only for an active subscription", () => {
    expect(getDashboardAccessDestination(true, "active")).toBe("dashboard");
  });

  it("allows cancellation only for an active Stripe subscription not already scheduled", () => {
    expect(canScheduleSubscriptionCancellation({ status: "active", provider: "stripe", providerSubscriptionId: "sub_test", cancelAtPeriodEnd: false })).toBe(true);
    expect(canScheduleSubscriptionCancellation({ status: "active", provider: "stripe", providerSubscriptionId: "sub_test", cancelAtPeriodEnd: true })).toBe(false);
    expect(canScheduleSubscriptionCancellation({ status: "past_due", provider: "stripe", providerSubscriptionId: "sub_test" })).toBe(false);
    expect(canScheduleSubscriptionCancellation({ status: "active", provider: "paypal", providerSubscriptionId: "I-test" })).toBe(false);
    expect(canScheduleSubscriptionCancellation(null)).toBe(false);
  });

  it("opens the Stripe customer portal only for the owning eligible subscription", () => {
    expect(canOpenCustomerPortal({ status: "active", provider: "stripe", providerCustomerId: "cus_test" })).toBe(true);
    expect(canOpenCustomerPortal({ status: "past_due", provider: "stripe", providerCustomerId: "cus_test" })).toBe(true);
    expect(canOpenCustomerPortal({ status: "active", provider: "stripe" })).toBe(false);
    expect(canOpenCustomerPortal({ status: "active", provider: "paypal", providerCustomerId: "cus_test" })).toBe(false);
    expect(canOpenCustomerPortal({ status: "canceled", provider: "stripe", providerCustomerId: "cus_test" })).toBe(false);
    expect(canOpenCustomerPortal(null)).toBe(false);
  });
});
