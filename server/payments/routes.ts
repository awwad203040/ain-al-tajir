import express, { type Express } from "express";
import type Stripe from "stripe";

import * as db from "../db";
import { constructStripeEvent, getStripeClient, mapStripeSubscriptionStatus } from "./stripe";

function valueId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) return String((value as { id: unknown }).id);
  return undefined;
}

async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const userId = Number(subscription.metadata?.userId);
  if (!Number.isInteger(userId) || userId <= 0) return;
  const periodEndSeconds = (subscription as unknown as { current_period_end?: number }).current_period_end
    ?? (subscription as unknown as { items?: { data?: Array<{ current_period_end?: number }> } }).items?.data?.[0]?.current_period_end;

  await db.upsertSubscription({
    userId,
    provider: "stripe",
    status: mapStripeSubscriptionStatus(subscription.status),
    amountMinor: 10000,
    currency: "SAR",
    providerCustomerId: valueId(subscription.customer),
    providerSubscriptionId: subscription.id,
    currentPeriodEnd: periodEndSeconds ? new Date(periodEndSeconds * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

async function syncStripeInvoice(invoice: Stripe.Invoice) {
  const raw = invoice as unknown as {
    parent?: { subscription_details?: { metadata?: Record<string, string>; subscription?: unknown } };
    subscription?: unknown;
    subscription_details?: { metadata?: Record<string, string> };
    period_start?: number;
    period_end?: number;
    status_transitions?: { paid_at?: number | null };
  };
  const providerSubscriptionId = valueId(raw.parent?.subscription_details?.subscription ?? raw.subscription);
  let userId = Number(raw.parent?.subscription_details?.metadata?.userId ?? raw.subscription_details?.metadata?.userId);

  if ((!Number.isInteger(userId) || userId <= 0) && providerSubscriptionId) {
    const subscription = await getStripeClient().subscriptions.retrieve(providerSubscriptionId);
    userId = Number(subscription.metadata?.userId);
  }
  if (!Number.isInteger(userId) || userId <= 0) return;

  const localSubscription = await db.getSubscriptionByUserId(userId);
  let status: "draft" | "open" | "paid" | "void" | "uncollectible" = "open";
  if (invoice.status === "paid") status = "paid";
  else if (invoice.status === "void") status = "void";
  else if (invoice.status === "uncollectible") status = "uncollectible";
  else if (invoice.status === "draft") status = "draft";

  await db.upsertInvoice({
    userId,
    subscriptionId: localSubscription?.id,
    provider: "stripe",
    providerInvoiceId: invoice.id,
    invoiceNumber: invoice.number ?? null,
    status,
    amountDueMinor: invoice.amount_due,
    amountPaidMinor: invoice.amount_paid,
    currency: invoice.currency.toUpperCase(),
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
    periodStart: raw.period_start ? new Date(raw.period_start * 1000) : null,
    periodEnd: raw.period_end ? new Date(raw.period_end * 1000) : null,
    paidAt: raw.status_transitions?.paid_at ? new Date(raw.status_transitions.paid_at * 1000) : null,
  });
}

async function handleStripeEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = Number(session.client_reference_id ?? session.metadata?.userId);
    if (Number.isInteger(userId) && userId > 0) {
      await db.upsertSubscription({
        userId,
        provider: "stripe",
        status: session.payment_status === "paid" ? "active" : "checkout_pending",
        amountMinor: 10000,
        currency: "SAR",
        providerCustomerId: valueId(session.customer),
        providerSubscriptionId: valueId(session.subscription),
      });
    }
    return;
  }

  if (
    event.type === "customer.subscription.created"
    || event.type === "customer.subscription.updated"
    || event.type === "customer.subscription.deleted"
  ) {
    await syncStripeSubscription(event.data.object as Stripe.Subscription);
    return;
  }

  if (
    event.type === "invoice.created"
    || event.type === "invoice.finalized"
    || event.type === "invoice.paid"
    || event.type === "invoice.payment_failed"
    || event.type === "invoice.voided"
  ) {
    await syncStripeInvoice(event.data.object as Stripe.Invoice);
  }
}

export function registerPaymentWebhookRoutes(app: Express) {
  app.post(
    "/api/payments/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      try {
        const signature = req.header("stripe-signature");
        if (!signature) return res.status(400).json({ error: "Missing Stripe signature" });
        const event = constructStripeEvent(req.body as Buffer, signature);
        if (await db.hasProcessedPaymentEvent(event.id)) return res.json({ received: true, duplicate: true });
        await handleStripeEvent(event);
        await db.recordPaymentEvent("stripe", event.id, event.type);
        return res.json({ received: true });
      } catch (error) {
        console.error("[Stripe webhook] rejected", error);
        return res.status(400).json({ error: "Invalid webhook" });
      }
    },
  );
}
