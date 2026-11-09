export type PartnerApiTestConnectorId = "extra" | "jarir";
export type PartnerApiTestStatus = "not_configured" | "connected" | "authentication_failed" | "unreachable";

type PartnerApiTestConfig = { url: string; headerName?: string; headerValue?: string };
type Environment = Record<string, string | undefined>;

const FORBIDDEN_HEADERS = new Set(["host", "connection", "content-length", "transfer-encoding"]);

export function resolvePartnerApiTestConfig(connectorId: PartnerApiTestConnectorId, env: Environment = process.env): PartnerApiTestConfig | undefined {
  if (env.PARTNER_API_TESTING_ENABLED !== "true") return undefined;
  const prefix = connectorId === "extra" ? "EXTRA" : "JARIR";
  const url = env[`${prefix}_API_TEST_URL`]?.trim();
  const headerName = env[`${prefix}_API_TEST_HEADER_NAME`]?.trim();
  const headerValue = env[`${prefix}_API_TEST_HEADER_VALUE`];
  if (!url || !isHttpsUrl(url)) return undefined;
  if ((headerName && !headerValue) || (!headerName && headerValue) || (headerName && !isSafeHeaderName(headerName))) return undefined;
  return { url, headerName, headerValue };
}

export async function testPartnerApiConnection(connectorId: PartnerApiTestConnectorId, env: Environment = process.env): Promise<{ status: PartnerApiTestStatus; statusCode?: number }> {
  const config = resolvePartnerApiTestConfig(connectorId, env);
  if (!config) return { status: "not_configured" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.headerName && config.headerValue) headers[config.headerName] = config.headerValue;
    const response = await fetch(config.url, { method: "GET", headers, redirect: "error", signal: controller.signal });
    if (response.ok) return { status: "connected", statusCode: response.status };
    if (response.status === 401 || response.status === 403) return { status: "authentication_failed", statusCode: response.status };
    return { status: "unreachable", statusCode: response.status };
  } catch {
    return { status: "unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function isSafeHeaderName(value: string) {
  return /^[A-Za-z0-9-]+$/.test(value) && !FORBIDDEN_HEADERS.has(value.toLowerCase());
}
