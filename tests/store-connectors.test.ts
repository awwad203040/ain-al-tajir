import { describe, expect, it } from "vitest";

import { findStoreCatalogProduct } from "../lib/store-product-catalog";
import { productsFromStoreRows, requiredColumns, validateStoreRows } from "../lib/store-connectors";

describe("store import validation", () => {
  it("accepts Arabic product headers with valid numeric prices", () => {
    const result = validateStoreRows([
      { "رمز المنتج": "SKU-100", "اسم المنتج": "قهوة عربية", السعر: "34.50" },
      { "رمز المنتج": "SKU-101", "اسم المنتج": "تمر خلاص", السعر: 22 },
    ], "products");
    expect(result).toEqual({ valid: true, rowCount: 2, missing: [], errors: [] });
  });

  it("turns a valid product import into a price catalog with Arabic numeral support", () => {
    const result = productsFromStoreRows([
      { "رمز المنتج": "SKU-100", "اسم المنتج": "قهوة عربية", السعر: "٣٤٫٥٠" },
      { "رمز المنتج": "sku-100", "اسم المنتج": "قهوة عربية – سعر أحدث", السعر: "35" },
      { "رمز المنتج": "SKU-101", "اسم المنتج": "تمر خلاص", السعر: "22" },
    ]);
    expect(result).toMatchObject({ valid: true, rowCount: 3, errors: [] });
    expect(result.products).toEqual([
      { sku: "sku-100", name: "قهوة عربية – سعر أحدث", priceMinor: 3500 },
      { sku: "SKU-101", name: "تمر خلاص", priceMinor: 2200 },
    ]);
  });

  it("imports optional cost data without making it a required product column", () => {
    const result = productsFromStoreRows([
      { sku: "COFFEE-1", name: "قهوة عربية", price: "34.50", "تكلفة المنتج": "٢١٫٧٥" },
      { sku: "DATES-1", name: "تمر خلاص", price: "22", "تكلفة المنتج": "" },
    ]);
    expect(result).toMatchObject({ valid: true, rowCount: 2, errors: [] });
    expect(result.products).toEqual([
      { sku: "COFFEE-1", name: "قهوة عربية", priceMinor: 3450, costMinor: 2175 },
      { sku: "DATES-1", name: "تمر خلاص", priceMinor: 2200 },
    ]);
    const invalidCost = productsFromStoreRows([{ sku: "BAD-1", name: "منتج", price: "20", cost: "0" }]);
    expect(invalidCost.valid).toBe(false);
  });

  it("prefers an exact imported SKU before a product-name lookup", () => {
    const catalog = [
      { sku: "COFFEE-1", name: "قهوة عربية 250 جم", priceMinor: 3450, costMinor: 2175, importedAt: "2026-09-20T10:00:00.000Z" },
      { sku: "DATES-1", name: "تمر خلاص", priceMinor: 2200, importedAt: "2026-09-20T10:00:00.000Z" },
    ];
    expect(findStoreCatalogProduct(catalog, "قهوة", "coffee-1")?.priceMinor).toBe(3450);
    expect(findStoreCatalogProduct(catalog, "قهوة", "coffee-1")?.costMinor).toBe(2175);
    expect(findStoreCatalogProduct(catalog, "تمر خلاص")?.sku).toBe("DATES-1");
    expect(findStoreCatalogProduct(catalog, "حليب")).toBeUndefined();
  });

  it("requires all sales columns and validates dates and quantities", () => {
    const missing = validateStoreRows([{ order_id: "O-1", sku: "SKU-1", quantity: 2 }], "sales");
    expect(missing.valid).toBe(false);
    expect(missing.missing).toEqual(expect.arrayContaining(["order_date", "unit_price"]));

    const invalid = validateStoreRows([{ order_id: "O-1", order_date: "not-a-date", sku: "SKU-1", quantity: "none", unit_price: "10" }], "sales");
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toEqual(expect.arrayContaining(["Row 2: order_date", "Row 2: quantity"]));
  });

  it("rejects imports larger than the local safety limit", () => {
    const oversized = Array.from({ length: 5001 }, (_, index) => ({ sku: `SKU-${index}`, stock: 1 }));
    const result = validateStoreRows(oversized, "inventory");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Maximum 5,000 rows per import");
  });

  it("documents the expected stable template columns", () => {
    expect(requiredColumns("products")).toEqual(["sku", "name", "price"]);
    expect(requiredColumns("inventory")).toEqual(["sku", "stock"]);
  });
});
