import type { StoreConnectorId } from "@/lib/store-connectors";

export type PartnerConnectorId = Extract<StoreConnectorId, "extra" | "jarir">;
export type PartnerApiEnvironment = "sandbox" | "production";

export type PartnerApiSettings = {
  connectorId: PartnerConnectorId;
  partnerAccountId: string;
  baseUrl: string;
  environment: PartnerApiEnvironment;
  partnerAgreementConfirmed: boolean;
  updatedAt: string;
};

export const PARTNER_API_REQUIREMENTS: Record<PartnerConnectorId, { ar: string; en: string }> = {
  extra: { ar: "يتطلب الربط اتفاقية شريك من إكسترا ومعرّف حساب الشريك ورابط API الرسمي.", en: "This connection requires an eXtra partner agreement, partner account ID, and official API URL." },
  jarir: { ar: "يتطلب الربط اتفاقية شريك من جرير ومعرّف حساب الشريك ورابط API الرسمي.", en: "This connection requires a Jarir partner agreement, partner account ID, and official API URL." },
};

export function createEmptyPartnerApiSettings(connectorId: PartnerConnectorId): PartnerApiSettings {
  return { connectorId, partnerAccountId: "", baseUrl: "", environment: "production", partnerAgreementConfirmed: false, updatedAt: "" };
}

export function getPartnerApiReadiness(settings: PartnerApiSettings): "needs_agreement" | "draft" | "ready_for_secure_activation" {
  if (!settings.partnerAgreementConfirmed) return "needs_agreement";
  if (!settings.partnerAccountId.trim() || !isHttpsApiUrl(settings.baseUrl)) return "draft";
  return "ready_for_secure_activation";
}

export function isHttpsApiUrl(value: string) {
  try { return new URL(value.trim()).protocol === "https:"; } catch { return false; }
}
