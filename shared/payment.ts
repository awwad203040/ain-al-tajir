export const MERCHANT_MONTHLY_PLAN = {
  code: "merchant_monthly",
  name: { ar: "باقة التاجر", en: "Merchant Plan" },
  amountMinor: 10000,
  currency: "SAR",
  interval: "month",
  features: {
    ar: ["لوحة المؤشرات والتحليلات", "مركز الخسائر", "توقعات المخزون", "مساعد عين التاجر", "تقارير الفروع"],
    en: ["Dashboard and analytics", "Loss Center", "Inventory forecasting", "Ain Al-Tajir Assistant", "Branch reports"],
  },
} as const;

export type PaymentProvider = "stripe" | "instapay" | "paytabs" | "paypal";
export type SubscriptionStatus =
  | "inactive"
  | "checkout_pending"
  | "manual_review"
  | "active"
  | "past_due"
  | "canceled"
  | "manual_rejected";

export type ProviderAvailability = {
  provider: PaymentProvider;
  enabled: boolean;
  automatic: boolean;
  reason?: string;
};

export function hasPaidAccess(status: SubscriptionStatus) {
  return status === "active";
}

export type DashboardAccessDestination = "login" | "subscription" | "dashboard";

export function getDashboardAccessDestination(
  isAuthenticated: boolean,
  status?: SubscriptionStatus | null,
): DashboardAccessDestination {
  if (!isAuthenticated) return "login";
  if (!status || !hasPaidAccess(status)) return "subscription";
  return "dashboard";
}

export function canScheduleSubscriptionCancellation(subscription?: {
  status: SubscriptionStatus;
  provider: PaymentProvider;
  providerSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
} | null) {
  return Boolean(
    subscription
      && subscription.status === "active"
      && subscription.provider === "stripe"
      && subscription.providerSubscriptionId
      && !subscription.cancelAtPeriodEnd,
  );
}

export function canOpenCustomerPortal(subscription?: {
  status: SubscriptionStatus;
  provider: PaymentProvider;
  providerCustomerId?: string | null;
} | null) {
  return Boolean(
    subscription
      && (subscription.status === "active" || subscription.status === "past_due")
      && subscription.provider === "stripe"
      && subscription.providerCustomerId,
  );
}
