import { describe, expect, it } from "vitest";

import { buildAnnualStatement, buildAnnualStatementHtml, getSubscriptionNotice } from "../lib/billing-utils";

const now = new Date("2026-08-26T00:00:00.000Z");

describe("subscription renewal notices", () => {
  it("shows increasingly urgent renewal notices", () => {
    expect(getSubscriptionNotice("active", "2026-09-09T00:00:00.000Z", false, now)?.kind).toBe("renewal_info");
    expect(getSubscriptionNotice("active", "2026-09-02T00:00:00.000Z", false, now)?.kind).toBe("renewal_warning");
    expect(getSubscriptionNotice("active", "2026-08-29T00:00:00.000Z", false, now)?.kind).toBe("renewal_urgent");
    expect(getSubscriptionNotice("active", "2026-09-20T00:00:00.000Z", false, now)).toBeNull();
  });

  it("prioritizes ending, expired, and failed states", () => {
    expect(getSubscriptionNotice("active", "2026-09-20T00:00:00.000Z", true, now)?.kind).toBe("ending");
    expect(getSubscriptionNotice("past_due", "2026-08-25T00:00:00.000Z", false, now)?.kind).toBe("past_due");
    expect(getSubscriptionNotice("canceled", "2026-08-25T00:00:00.000Z", false, now)?.kind).toBe("expired");
  });
});

describe("annual invoice statement", () => {
  const invoices = [
    { id: 1, invoiceNumber: "INV-2026-01", status: "paid" as const, amountDueMinor: 10000, amountPaidMinor: 10000, currency: "SAR", paidAt: "2026-01-15T00:00:00.000Z", createdAt: "2026-01-14T00:00:00.000Z" },
    { id: 2, invoiceNumber: "INV-2026-02", status: "open" as const, amountDueMinor: 10000, amountPaidMinor: 0, currency: "SAR", createdAt: "2026-02-15T00:00:00.000Z" },
    { id: 3, invoiceNumber: "INV-2025-12", status: "paid" as const, amountDueMinor: 10000, amountPaidMinor: 10000, currency: "SAR", paidAt: "2025-12-15T00:00:00.000Z", createdAt: "2025-12-14T00:00:00.000Z" },
  ];

  it("filters by the selected year and totals actual invoice values", () => {
    const statement = buildAnnualStatement(invoices, 2026);
    expect(statement.invoices).toHaveLength(2);
    expect(statement.totalPaidMinor).toBe(10000);
    expect(statement.totalDueMinor).toBe(20000);
    expect(statement.currency).toBe("SAR");
  });

  it("renders a complete RTL PDF document without unrelated years", () => {
    const html = buildAnnualStatementHtml(buildAnnualStatement(invoices, 2026), "ar");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("كشف حساب الفواتير السنوي");
    expect(html).toContain("INV-2026-01");
    expect(html).not.toContain("INV-2025-12");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("returns an empty statement when the selected year has no invoices", () => {
    const statement = buildAnnualStatement(invoices, 2024);
    expect(statement.invoices).toEqual([]);
    expect(statement.totalPaidMinor).toBe(0);
    expect(statement.totalDueMinor).toBe(0);
  });
});
