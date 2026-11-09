export type PriceObservationInput = {
  productQuery: string;
  productSku?: string;
  productBarcode?: string;
  sourceName: string;
  sourceUrl: string;
  priceMinor: number;
  currency?: string;
};

export type PriceFreshness = "current" | "review" | "stale" | "unknown";
export type PricingGoal = "fast_sale" | "balanced" | "higher_margin";
export type SmartMarketSourceId = "amazon_sa" | "noon" | "carrefour_sa" | "panda" | "danube";
export type SmartMarketSource = { id: SmartMarketSourceId; name: { ar: string; en: string }; domain: string };

export type GrossMargin = {
  grossProfitMinor: number;
  grossMarginPercent: number;
};

type TimestampLike = Date | string | number | null | undefined;
type PricedObservation = { priceMinor: number; observedAt?: TimestampLike };
export type PriceResearchFilters = { productQuery?: string; productSku?: string; productBarcode?: string };
export type PriceObservationIdentity = { productQuery: string; productSku?: string | null; productBarcode?: string | null };
export type CurrentPriceObservation = PricedObservation & { currency?: string | null };

/** A merchant should re-check retail prices after one week; older records remain visible but are not used as current benchmarks. */
export const PRICE_FRESHNESS_DAYS = { current: 7, review: 30 } as const;
export const SMART_MARKET_SOURCES: readonly SmartMarketSource[] = [
  { id: "amazon_sa", name: { ar: "Amazon السعودية", en: "Amazon Saudi" }, domain: "amazon.sa" },
  { id: "noon", name: { ar: "نون السعودية", en: "noon Saudi" }, domain: "noon.com" },
  { id: "carrefour_sa", name: { ar: "كارفور السعودية", en: "Carrefour Saudi" }, domain: "carrefourksa.com" },
  { id: "panda", name: { ar: "بنده", en: "Panda" }, domain: "panda.sa" },
  { id: "danube", name: { ar: "الدانوب", en: "Danube" }, domain: "danube.sa" },
] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !host.includes(".")) return false;
    return !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host) && !host.endsWith(".local") && !host.startsWith("10.") && !host.startsWith("192.168.") && !host.startsWith("172.16.");
  } catch { return false; }
}

export function toPriceMinor(value: string) {
  const normalized = value.trim().replace(/[٬,]/g, "").replace(/٫/g, ".").replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return undefined;
  return Math.round(amount * 100);
}

export function calculateGrossMargin(priceMinor: number | undefined, costPriceMinor: number | undefined): GrossMargin | undefined {
  if (!priceMinor || !costPriceMinor || priceMinor <= 0 || costPriceMinor <= 0) return undefined;
  const grossProfitMinor = priceMinor - costPriceMinor;
  return { grossProfitMinor, grossMarginPercent: Number(((grossProfitMinor / priceMinor) * 100).toFixed(1)) };
}

/** Adds only merchant-entered per-unit costs; an absent value is not interpreted as zero-cost proof. */
export function calculateTotalUnitCostMinor(productCostMinor?: number | null, additionalCostMinor?: number | null) {
  const amounts = [productCostMinor, additionalCostMinor].filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value > 0);
  if (!amounts.length) return undefined;
  const total = amounts.reduce((sum, value) => sum + value, 0);
  return Number.isSafeInteger(total) && total <= 1_000_000_000 ? total : undefined;
}

export function buildProductSearchQuery(productQuery?: string, productSku?: string, productBarcode?: string) {
  return [productQuery, productSku, productBarcode].map((value) => value?.trim()).filter((value): value is string => Boolean(value)).join(" ");
}

/** User-initiated search links only; the server never fetches or extracts a competitor page. */
export function buildSmartMarketSearchUrl(source: SmartMarketSource, productQuery: string) {
  const query = `site:${source.domain} ${productQuery.trim()} سعر السعودية`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** Product-name matches are broad; an exact SKU or barcode match is intentionally accepted as the stronger identity signal. */
export function matchesPriceObservation(filters: PriceResearchFilters | undefined, observation: PriceObservationIdentity) {
  const productQuery = filters?.productQuery?.trim().toLowerCase();
  const productSku = filters?.productSku?.trim().toLowerCase();
  const productBarcode = filters?.productBarcode?.trim();
  if (!productQuery && !productSku && !productBarcode) return true;
  return (Boolean(productQuery) && observation.productQuery.toLowerCase().includes(productQuery!)) ||
    (Boolean(productSku) && observation.productSku?.toLowerCase() === productSku) ||
    (Boolean(productBarcode) && observation.productBarcode === productBarcode);
}

export function buildPublicSearchLinks(query: string) {
  const encoded = encodeURIComponent(`${query.trim()} سعر السعودية`);
  return {
    google: `https://www.google.com/search?q=${encoded}`,
    bing: `https://www.bing.com/search?q=${encoded}`,
  };
}

export function ageInDays(observedAt: TimestampLike, now = new Date()) {
  if (!observedAt) return undefined;
  const observed = new Date(observedAt);
  if (!Number.isFinite(observed.getTime()) || !Number.isFinite(now.getTime())) return undefined;
  return Math.max(0, Math.floor((now.getTime() - observed.getTime()) / DAY_MS));
}

export function getPriceFreshness(observedAt: TimestampLike, now = new Date()): PriceFreshness {
  const age = ageInDays(observedAt, now);
  if (age === undefined) return "unknown";
  if (age <= PRICE_FRESHNESS_DAYS.current) return "current";
  if (age <= PRICE_FRESHNESS_DAYS.review) return "review";
  return "stale";
}

export function filterCurrentPriceObservations<T extends PricedObservation>(observations: T[], now = new Date()) {
  return observations.filter((observation) => getPriceFreshness(observation.observedAt, now) === "current");
}

export function compareWithObservedPrices(ownPriceMinor: number | undefined, observed: { priceMinor: number }[]) {
  if (!ownPriceMinor || !observed.length) return undefined;
  const lowest = Math.min(...observed.map((item) => item.priceMinor));
  return { lowestPriceMinor: lowest, differenceMinor: ownPriceMinor - lowest, percentDifference: Number((((ownPriceMinor - lowest) / lowest) * 100).toFixed(1)) };
}

/** Uses only prices verified in the last seven days so older observations do not look like a live market benchmark. */
export function compareWithCurrentObservedPrices(ownPriceMinor: number | undefined, observed: PricedObservation[], now = new Date()) {
  return compareWithObservedPrices(ownPriceMinor, filterCurrentPriceObservations(observed, now));
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * Produces a reviewable target from current merchant-verified evidence. A supplied floor is applied as a hard lower boundary;
 * it represents the merchant's declared cost and does not include fees, tax, shipping, or other overhead unless the merchant included them.
 */
export function calculateSmartPriceRecommendation({ ownPriceMinor, goal, observations, floorPriceMinor, now = new Date() }: { ownPriceMinor: number; goal: PricingGoal; observations: CurrentPriceObservation[]; floorPriceMinor?: number; now?: Date }) {
  const current = filterCurrentPriceObservations(observations, now).filter((item) => (item.currency ?? "SAR") === "SAR" && item.priceMinor > 0);
  if (!current.length || ownPriceMinor <= 0) return undefined;
  const prices = current.map((item) => item.priceMinor).sort((a, b) => a - b);
  const lowestPriceMinor = prices[0];
  const medianPriceMinor = median(prices);
  const highestPriceMinor = prices[prices.length - 1];
  const rawTargetPriceMinor = goal === "fast_sale" ? lowestPriceMinor : goal === "higher_margin" ? Math.round((medianPriceMinor + highestPriceMinor) / 2) : medianPriceMinor;
  const normalizedFloor = floorPriceMinor && floorPriceMinor > 0 ? floorPriceMinor : undefined;
  const floorApplied = Boolean(normalizedFloor && normalizedFloor > rawTargetPriceMinor);
  const targetPriceMinor = normalizedFloor ? Math.max(rawTargetPriceMinor, normalizedFloor) : rawTargetPriceMinor;
  const rangeLowMinor = normalizedFloor ? Math.max(normalizedFloor, Math.round(targetPriceMinor * 0.98)) : Math.round(targetPriceMinor * 0.98);
  const rangeHighMinor = Math.round(targetPriceMinor * 1.02);
  const varianceMinor = ownPriceMinor - targetPriceMinor;
  const targetGrossMargin = calculateGrossMargin(targetPriceMinor, normalizedFloor);
  const ownGrossMargin = calculateGrossMargin(ownPriceMinor, normalizedFloor);
  return {
    sourceCount: current.length,
    preliminary: current.length === 1,
    lowestPriceMinor,
    medianPriceMinor,
    highestPriceMinor,
    rawTargetPriceMinor,
    floorPriceMinor: normalizedFloor,
    floorApplied,
    targetPriceMinor,
    rangeLowMinor,
    rangeHighMinor,
    varianceMinor,
    variancePercent: Number(((varianceMinor / targetPriceMinor) * 100).toFixed(1)),
    targetGrossMargin,
    ownGrossMargin,
  };
}
