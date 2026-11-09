import { ENV } from "../_core/env";
import type { PaymentProvider, ProviderAvailability } from "../../shared/payment";

export type CheckoutRequest = {
  userId: number;
  email?: string | null;
};

export type CheckoutResult = {
  provider: PaymentProvider;
  checkoutUrl: string;
  externalId: string;
};

export interface AutomaticPaymentProvider {
  name: PaymentProvider;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
}

export function getProviderAvailability(): ProviderAvailability[] {
  const stripeEnabled = Boolean(
    ENV.stripeSecretKey && ENV.stripeWebhookSecret && ENV.paymentReturnUrl,
  );

  return [
    {
      provider: "stripe",
      enabled: stripeEnabled,
      automatic: true,
      reason: stripeEnabled ? undefined : "Stripe test credentials are not configured",
    },
    {
      provider: "paytabs",
      enabled: false,
      automatic: true,
      reason: "PayTabs merchant credentials are required",
    },
    {
      provider: "paypal",
      enabled: false,
      automatic: true,
      reason: "PayPal merchant credentials are required",
    },
  ];
}
