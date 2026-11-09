import type { SubscriptionStatus } from "./payment";

export const TRIAL_DURATION_DAYS = 7;
export type AccountAccessKind = "setup" | "trial" | "paid" | "subscription" | "branch_manager";

export function trialEndsAtFrom(startedAt: Date) {
  return new Date(startedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

export function getTrialDaysRemaining(trialEndsAt?: Date | string | null, now = new Date()) {
  if (!trialEndsAt) return 0;
  const milliseconds = new Date(trialEndsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(milliseconds / (24 * 60 * 60 * 1000)));
}

export function resolveAccountAccess(input: {
  subscriptionStatus?: SubscriptionStatus | null;
  hasMerchantProfile: boolean;
  trialEndsAt?: Date | string | null;
}, now = new Date()): { kind: AccountAccessKind; hasAccess: boolean; trialDaysRemaining: number } {
  if (input.subscriptionStatus === "active") return { kind: "paid", hasAccess: true, trialDaysRemaining: 0 };
  if (!input.hasMerchantProfile) return { kind: "setup", hasAccess: false, trialDaysRemaining: 0 };
  const trialDaysRemaining = getTrialDaysRemaining(input.trialEndsAt, now);
  if (trialDaysRemaining > 0) return { kind: "trial", hasAccess: true, trialDaysRemaining };
  return { kind: "subscription", hasAccess: false, trialDaysRemaining: 0 };
}
