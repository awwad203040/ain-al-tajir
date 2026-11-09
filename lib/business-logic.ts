import type { Language } from "@/lib/app-context";
import type { InventoryItem } from "@/lib/demo-data";

export type AssistantResult = {
  text: string;
  label?: "actual" | "estimate" | "forecast";
};

export function getAssistantAnswer(question: string, language: Language): AssistantResult {
  const isRTL = language === "ar";
  const normalized = question.trim().toLowerCase();

  if (normalized.includes("خسر") || normalized.includes("losing") || normalized.includes("loss")) {
    return {
      label: "estimate",
      text: isRTL
        ? "أكبر خسارة محتملة الآن هي فرق مخزون فرع الرياض، بأثر تقديري 2,450 ر.س. استند التحليل إلى حركات المخزون والمبيعات خلال آخر 48 ساعة."
        : "The largest potential loss is a Riyadh branch stock variance, estimated at SAR 2,450. The analysis uses inventory movements and sales from the last 48 hours.",
    };
  }

  if (normalized.includes("تنفد") || normalized.includes("run out") || normalized.includes("stock")) {
    return {
      label: "forecast",
      text: isRTL
        ? "ثلاثة منتجات قد تنفد خلال 3–5 أيام، وأقربها القهوة العربية 250 جم. التوقع مبني على متوسط بيع 12 قطعة يوميًا ومخزون حالي 36 قطعة."
        : "Three products may run out within 3–5 days. Arabic Coffee 250g is the nearest: 12 units sold daily on average with 36 units on hand.",
    };
  }

  if (normalized.includes("اليوم") || normalized.includes("today")) {
    return {
      label: "actual",
      text: isRTL
        ? "ابدأ بمراجعة فرق مخزون الرياض، ثم اعتمد طلب إعادة 7 منتجات، وبعدها راجع ارتفاع تكلفة مورد المشروبات. رتبتها حسب الأثر والثقة والاستعجال."
        : "Start with the Riyadh stock variance, then approve the 7-product reorder, and review the beverage supplier cost increase. They are ranked by impact, confidence, and urgency.",
    };
  }

  if (normalized.includes("ربح") || normalized.includes("profit")) {
    return {
      label: "estimate",
      text: isRTL
        ? "الربح التقديري اليوم 11,340 ر.س، مقابل مبيعات فعلية قدرها 48,720 ر.س. يعتمد الربح على تكاليف الشراء المتاحة حاليًا."
        : "Estimated profit today is SAR 11,340, against actual sales of SAR 48,720. Profit depends on currently available purchase costs.",
    };
  }

  return {
    text: isRTL ? "لا توجد بيانات كافية لإعطاء نتيجة دقيقة." : "There is not enough data to give an accurate answer.",
  };
}

export function filterInventory(items: InventoryItem[], query: string, filter: "all" | InventoryItem["status"], language: Language) {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesFilter = filter === "all" || item.status === filter;
    const matchesQuery = !needle || item.sku.toLowerCase().includes(needle) || item.name[language].toLowerCase().includes(needle);
    return matchesFilter && matchesQuery;
  });
}
