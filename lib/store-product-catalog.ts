import AsyncStorage from "@react-native-async-storage/async-storage";

export type StoreCatalogProduct = {
  sku: string;
  name: string;
  priceMinor: number;
  costMinor?: number;
  importedAt: string;
};

const storageKey = (userId: string) => `ain-altajir-product-catalog:${userId}`;

export async function loadStoreCatalogProducts(userId: string): Promise<StoreCatalogProduct[]> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isCatalogProduct) : [];
  } catch {
    return [];
  }
}

export async function saveStoreCatalogProducts(userId: string, products: StoreCatalogProduct[]) {
  const deduplicated = new Map<string, StoreCatalogProduct>();
  products.forEach((product) => deduplicated.set(product.sku.trim().toLowerCase(), product));
  const next = [...deduplicated.values()].slice(0, 5000);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}

export function findStoreCatalogProduct(products: StoreCatalogProduct[], productQuery?: string, productSku?: string) {
  const normalizedSku = productSku?.trim().toLowerCase();
  if (normalizedSku) {
    const exactSku = products.find((product) => product.sku.trim().toLowerCase() === normalizedSku);
    if (exactSku) return exactSku;
  }
  const normalizedQuery = productQuery?.trim().toLowerCase();
  if (!normalizedQuery || normalizedQuery.length < 2) return undefined;
  return products.find((product) => {
    const name = product.name.trim().toLowerCase();
    return name === normalizedQuery || name.includes(normalizedQuery) || normalizedQuery.includes(name);
  });
}

function isPositiveMinor(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isCatalogProduct(value: unknown): value is StoreCatalogProduct {
  if (!value || typeof value !== "object") return false;
  const product = value as Partial<StoreCatalogProduct>;
  return typeof product.sku === "string" && typeof product.name === "string" && isPositiveMinor(product.priceMinor) && typeof product.importedAt === "string" && (product.costMinor === undefined || isPositiveMinor(product.costMinor));
}
