import { describe, expect, it } from "vitest";

import { createEmptyPartnerApiSettings, getPartnerApiReadiness, isHttpsApiUrl } from "../lib/partner-api-settings";

describe("partner API settings", () => {
  it("creates a non-secret disabled draft for each partner connector", () => {
    const settings = createEmptyPartnerApiSettings("extra");
    expect(settings).toMatchObject({ connectorId: "extra", partnerAccountId: "", baseUrl: "", environment: "production", partnerAgreementConfirmed: false });
    expect(getPartnerApiReadiness(settings)).toBe("needs_agreement");
  });

  it("requires a partner agreement and a HTTPS endpoint before secure activation", () => {
    const settings = { ...createEmptyPartnerApiSettings("jarir"), partnerAgreementConfirmed: true, partnerAccountId: "partner-123", baseUrl: "https://partner.example.sa/api" };
    expect(getPartnerApiReadiness(settings)).toBe("ready_for_secure_activation");
    expect(getPartnerApiReadiness({ ...settings, baseUrl: "http://partner.example.sa/api" })).toBe("draft");
    expect(getPartnerApiReadiness({ ...settings, partnerAccountId: "" })).toBe("draft");
  });

  it("accepts only HTTPS URLs for partner API metadata", () => {
    expect(isHttpsApiUrl("https://api.partner.sa/v1")).toBe(true);
    expect(isHttpsApiUrl("http://api.partner.sa/v1")).toBe(false);
    expect(isHttpsApiUrl("not-a-url")).toBe(false);
  });
});
