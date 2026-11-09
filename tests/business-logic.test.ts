import { describe, expect, it } from "vitest";

import { filterInventory, getAssistantAnswer } from "../lib/business-logic";
import { inventoryItems, moduleContent, recommendedActions } from "../lib/demo-data";

describe("Ain Al-Tajir business logic", () => {
  it("classifies loss answers as estimates and keeps the financial figure explicit", () => {
    const result = getAssistantAnswer("أين أخسر؟", "ar");
    expect(result.label).toBe("estimate");
    expect(result.text).toContain("2,450");
    expect(result.text).toContain("تقديري");
  });

  it("classifies stockout answers as forecasts", () => {
    const result = getAssistantAnswer("Which products will run out?", "en");
    expect(result.label).toBe("forecast");
    expect(result.text).toContain("3–5 days");
  });

  it("refuses to invent data for unsupported questions", () => {
    const result = getAssistantAnswer("من هو أفضل موظف؟", "ar");
    expect(result.label).toBeUndefined();
    expect(result.text).toBe("لا توجد بيانات كافية لإعطاء نتيجة دقيقة.");
  });

  it("filters inventory by Arabic name and status", () => {
    const byName = filterInventory(inventoryItems, "قهوة", "all", "ar");
    const lowStock = filterInventory(inventoryItems, "", "low", "ar");
    expect(byName).toHaveLength(1);
    expect(byName[0].sku).toBe("CF-AR-250");
    expect(lowStock.every((item) => item.status === "low")).toBe(true);
  });

  it("keeps required modules and actionable recommendations available", () => {
    expect(Object.keys(moduleContent)).toEqual(expect.arrayContaining(["purchases", "suppliers", "branches", "integrations", "settings", "admin"]));
    expect(recommendedActions.every((item) => item.impact && item.confidence > 0)).toBe(true);
  });
});
