import { describe, expect, it } from "vitest";

import { resolvePartnerApiTestConfig, testPartnerApiConnection } from "../server/partner-api";

describe("partner API connection test configuration", () => {
  it("does not expose or attempt a test before server-side enablement", async () => {
    expect(resolvePartnerApiTestConfig("extra", { EXTRA_API_TEST_URL: "https://partner.example.sa/health" })).toBeUndefined();
    await expect(testPartnerApiConnection("extra", {})).resolves.toEqual({ status: "not_configured" });
  });

  it("accepts only an explicitly enabled HTTPS endpoint with matching credential metadata", () => {
    const config = resolvePartnerApiTestConfig("jarir", {
      PARTNER_API_TESTING_ENABLED: "true",
      JARIR_API_TEST_URL: "https://partner.example.sa/health",
      JARIR_API_TEST_HEADER_NAME: "X-Partner-Key",
      JARIR_API_TEST_HEADER_VALUE: "server-only-secret",
    });
    expect(config).toEqual({ url: "https://partner.example.sa/health", headerName: "X-Partner-Key", headerValue: "server-only-secret" });
  });

  it("rejects insecure endpoints and restricted or incomplete header configuration", () => {
    expect(resolvePartnerApiTestConfig("extra", { PARTNER_API_TESTING_ENABLED: "true", EXTRA_API_TEST_URL: "http://partner.example.sa/health" })).toBeUndefined();
    expect(resolvePartnerApiTestConfig("extra", { PARTNER_API_TESTING_ENABLED: "true", EXTRA_API_TEST_URL: "https://partner.example.sa/health", EXTRA_API_TEST_HEADER_NAME: "Authorization" })).toBeUndefined();
    expect(resolvePartnerApiTestConfig("extra", { PARTNER_API_TESTING_ENABLED: "true", EXTRA_API_TEST_URL: "https://partner.example.sa/health", EXTRA_API_TEST_HEADER_NAME: "Host", EXTRA_API_TEST_HEADER_VALUE: "untrusted.example" })).toBeUndefined();
  });
});
