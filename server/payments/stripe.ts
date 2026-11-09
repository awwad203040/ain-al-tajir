import Stripe from "stripe";

import { ENV } from "../_core/env";
import type { SubscriptionStatus } from "../../shared/payment";
import type { CheckoutRequest, CheckoutResult } from "./providers";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!ENV.stripeSecretKey) throw new Error("Stripe is not configured");
  if (!stripeClient) stripeClient = new Stripe(ENV.stripeSecretKey);
  return stripeClient;
}

export async function createStripeCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  if (!ENV.paymentReturnUrl) throw new Error("Stripe Checkout configuration is incomplete");
  const stripe = getStripeClient();
  const baseUrl = ENV.paymentReturnUrl.replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "sar",
        unit_amount: 10000,
        recurring: { interval: "month" },
        product_data: { name: "Ain Al-Tajir Merchant Plan", description: "Monthly merchant analytics subscription" },
      },
    }],
    success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/subscription/cancel`,
    client_reference_id: String(request.userId),
    customer_email: request.email ?? undefined,
    allow_promotion_codes: false,
    billing_address_collection: "auto",
    metadata: { userId: String(request.userId), planCode: "merchant_monthly" },
    subscription_data: {
      metadata: { userId: String(request.userId), planCode: "merchant_monthly" },
    },
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return { provider: "stripe", checkoutUrl: session.url, externalId: session.id };
}

export function constructStripeEvent(payload: Buffer, signature: string) {
  if (!ENV.stripeWebhookSecret) throw new Error("Stripe webhook secret is not configured");
  return getStripeClient().webhooks.constructEvent(payload, signature, ENV.stripeWebhookSecret);
}

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid" || status === "paused") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "checkout_pending";
}

export async function scheduleStripeCancellation(providerSubscriptionId: string) {
  return getStripeClient().subscriptions.update(providerSubscriptionId, { cancel_at_period_end: true });
}

export async function createStripeCustomerPortal(providerCustomerId: string) {
  if (!ENV.paymentReturnUrl) throw new Error("Stripe Customer Portal configuration is incomplete");
  const baseUrl = ENV.paymentReturnUrl.replace(/\/$/, "");
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: providerCustomerId,
    return_url: `${baseUrl}/module/subscription`,
    locale: "auto",
  });
  return { portalUrl: session.url, externalId: session.id };
}
