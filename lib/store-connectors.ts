import * as XLSX from "xlsx";

export type StoreConnectorId = "extra" | "jarir" | "custom";
export type StoreDatasetType = "products" | "sales" | "inventory";
export type ConnectorStatus = "partner_required" | "ready" | "synced" | "sync_error";
export type ImportedStoreProduct = { sku: string; name: string; priceMinor: number; costMinor?: number };

export const STORE_CONNECTORS = [
  { id: "extra", name: { ar: "إكسترا", en: "eXtra" }, description: { ar: "يتطلب اتفاقية شريك أو ملفًا صادرًا من نظام البائع.", en: "Requires a partner agreement or seller-system export." }, status: "partner_required", color: "#C73737", icon: "devices" },
  { id: "jarir", name: { ar: "مكتبة جرير", en: "Jarir Bookstore" }, description: { ar: "يتطلب اتفاقية شريك أو تصديرًا من ERP أو نقاط البيع.", en: "Requires a partner agreement or ERP/POS export." }, status: "partner_required", color: "#D71920", icon: "menu-book" },
  { id: "custom", name: { ar: "متجر أو نظام آخر", en: "Other store or system" }, description: { ar: "استيراد موحد من CSV أو Excel للمنتجات والمبيعات والمخزون.", en: "Standard CSV or Excel import for products, sales, and inventory." }, status: "ready", color: "#0F766E", icon: "storefront" },
] as const;

type Column = { key: string; aliases: string[]; type: "string" | "number" | "date" };
const COLUMNS: Record<StoreDatasetType, Column[]> = {
  products: [{ key: "sku", aliases: ["sku", "product_sku", "رمز المنتج", "رمز_المنتج"], type: "string" }, { key: "name", aliases: ["name", "product_name", "اسم المنتج", "اسم_المنتج"], type: "string" }, { key: "price", aliases: ["price", "sale_price", "السعر", "سعر البيع", "سعر_البيع"], type: "number" }],
  sales: [{ key: "order_id", aliases: ["order_id", "invoice_id", "رقم الطلب", "رقم_الطلب"], type: "string" }, { key: "order_date", aliases: ["order_date", "date", "تاريخ الطلب", "تاريخ_الطلب"], type: "date" }, { key: "sku", aliases: ["sku", "product_sku", "رمز المنتج", "رمز_المنتج"], type: "string" }, { key: "quantity", aliases: ["quantity", "qty", "الكمية"], type: "number" }, { key: "unit_price", aliases: ["unit_price", "price", "سعر الوحدة", "سعر_الوحدة"], type: "number" }],
  inventory: [{ key: "sku", aliases: ["sku", "product_sku", "رمز المنتج", "رمز_المنتج"], type: "string" }, { key: "stock", aliases: ["stock", "quantity", "on_hand", "المخزون", "الكمية"], type: "number" }],
};
const PRODUCT_COST_ALIASES = ["cost", "cost_price", "unit_cost", "تكلفة", "تكلفة المنتج", "تكلفة_المنتج", "تكلفة الوحدة", "تكلفة_الوحدة"];

export type ImportResult = { valid: boolean; rowCount: number; missing: string[]; errors: string[] };
export type ProductCatalogImportResult = ImportResult & { products: ImportedStoreProduct[] };
const normal = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, "_");

function normalizeNumericValue(value: unknown) {
  return String(value).trim().replace(/[٬,]/g, "").replace(/٫/g, ".").replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function priceMinorFromValue(value: unknown) {
  const price = Number(normalizeNumericValue(value));
  if (!Number.isFinite(price) || price <= 0 || price > 10_000_000) return undefined;
  return Math.round(price * 100);
}

function getAliases(rows: Record<string, unknown>[], type: StoreDatasetType) {
  const headers = Object.keys(rows[0] ?? {}).map(normal);
  return Object.fromEntries(COLUMNS[type].map((column) => [column.key, column.aliases.map(normal).find((alias) => headers.includes(alias))]));
}

function getOptionalProductCostAlias(rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? {}).map(normal);
  return PRODUCT_COST_ALIASES.map(normal).find((alias) => headers.includes(alias));
}

function normalizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normal(key), value]));
}

export function validateStoreRows(rows: Record<string, unknown>[], type: StoreDatasetType): ImportResult {
  if (!rows.length) return { valid: false, rowCount: 0, missing: [], errors: ["No data rows found"] };
  if (rows.length > 5000) return { valid: false, rowCount: rows.length, missing: [], errors: ["Maximum 5,000 rows per import"] };
  const columns = COLUMNS[type];
  const aliases = getAliases(rows, type);
  const missing = columns.filter((column) => !aliases[column.key]).map((column) => column.key);
  if (missing.length) return { valid: false, rowCount: rows.length, missing, errors: [] };
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const input = normalizeRow(row);
    columns.forEach((column) => {
      const value = input[aliases[column.key]!];
      const invalid = value === undefined || value === null || value === "" || (column.type === "number" && !Number.isFinite(Number(normalizeNumericValue(value)))) || (column.type === "date" && Number.isNaN(Date.parse(String(value))));
      if (invalid && errors.length < 5) errors.push(`Row ${index + 2}: ${column.key}`);
    });
  });
  return { valid: errors.length === 0, rowCount: rows.length, missing: [], errors };
}

export function productsFromStoreRows(rows: Record<string, unknown>[]): ProductCatalogImportResult {
  const validation = validateStoreRows(rows, "products");
  if (!validation.valid) return { ...validation, products: [] };
  const aliases = getAliases(rows, "products") as Record<"sku" | "name" | "price", string>;
  const costAlias = getOptionalProductCostAlias(rows);
  const deduplicated = new Map<string, ImportedStoreProduct>();
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const input = normalizeRow(row);
    const sku = String(input[aliases.sku] ?? "").trim();
    const name = String(input[aliases.name] ?? "").trim();
    const priceMinor = priceMinorFromValue(input[aliases.price]);
    const rawCost = costAlias ? input[costAlias] : undefined;
    const costMinor = rawCost === undefined || rawCost === null || rawCost === "" ? undefined : priceMinorFromValue(rawCost);
    if (!sku || !name || !priceMinor || (costAlias && rawCost !== undefined && rawCost !== null && rawCost !== "" && !costMinor)) {
      if (errors.length < 5) errors.push(`Row ${index + 2}: products`);
      return;
    }
    deduplicated.set(sku.toLowerCase(), { sku, name, priceMinor, ...(costMinor ? { costMinor } : {}) });
  });
  return { valid: errors.length === 0, rowCount: rows.length, missing: [], errors, products: [...deduplicated.values()] };
}

function rowsFromWorkbook(data: ArrayBuffer) {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = workbook.SheetNames[0];
  if (!sheet) return { rows: [], error: "Workbook has no sheets" };
  return { rows: XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheet], { defval: "" }), error: undefined };
}

export function parseStoreWorkbook(data: ArrayBuffer, type: StoreDatasetType): ImportResult {
  const { rows, error } = rowsFromWorkbook(data);
  return error ? { valid: false, rowCount: 0, missing: [], errors: [error] } : validateStoreRows(rows, type);
}

export function parseStoreProductWorkbook(data: ArrayBuffer): ProductCatalogImportResult {
  const { rows, error } = rowsFromWorkbook(data);
  return error ? { valid: false, rowCount: 0, missing: [], errors: [error], products: [] } : productsFromStoreRows(rows);
}

export function requiredColumns(type: StoreDatasetType) { return COLUMNS[type].map((column) => column.key); }
