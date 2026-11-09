import { calculateGrossMargin, calculateTotalUnitCostMinor } from "../shared/price-research";

export type PricingDecisionAction = "accepted" | "customized" | "dismissed";
export type PricingDecisionGoal = "fast_sale" | "balanced" | "higher_margin";

export type PricingDecisionHistoryRecord = {
  id: number;
  productQuery: string;
  productSku?: string | null;
  productBarcode?: string | null;
  goal: PricingDecisionGoal;
  action: PricingDecisionAction;
  ownPriceMinor: number;
  costPriceMinor?: number | null;
  additionalCostMinor?: number | null;
  targetPriceMinor: number;
  selectedPriceMinor?: number | null;
  sourceCount: number;
  note?: string | null;
  createdAt: Date | string;
};

export type PricingDecisionSummary = {
  total: number;
  accepted: number;
  customized: number;
  dismissed: number;
};

export function filterPricingDecisionHistory(records: PricingDecisionHistoryRecord[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return records;
  return records.filter((record) => [record.productQuery, record.productSku, record.productBarcode].some((value) => value?.toLocaleLowerCase().includes(query)));
}

export function summarizePricingDecisions(records: PricingDecisionHistoryRecord[]): PricingDecisionSummary {
  return records.reduce<PricingDecisionSummary>((summary, record) => ({
    total: summary.total + 1,
    accepted: summary.accepted + Number(record.action === "accepted"),
    customized: summary.customized + Number(record.action === "customized"),
    dismissed: summary.dismissed + Number(record.action === "dismissed"),
  }), { total: 0, accepted: 0, customized: 0, dismissed: 0 });
}

export function resolvedDecisionPriceMinor(record: PricingDecisionHistoryRecord) {
  if (record.action === "dismissed") return undefined;
  return record.selectedPriceMinor ?? record.targetPriceMinor;
}

export function decisionTotalCostMinor(record: PricingDecisionHistoryRecord) {
  return calculateTotalUnitCostMinor(record.costPriceMinor, record.additionalCostMinor);
}

export function decisionGrossMargin(record: PricingDecisionHistoryRecord) {
  return calculateGrossMargin(resolvedDecisionPriceMinor(record), decisionTotalCostMinor(record));
}

export function pricingDecisionActionLabel(action: PricingDecisionAction, language: "ar" | "en") {
  const labels = {
    accepted: { ar: "اعتماد المقترح", en: "Accepted target" },
    customized: { ar: "سعر مختار", en: "Selected price" },
    dismissed: { ar: "لم يعتمد التوصية", en: "Not used" },
  } as const;
  return labels[action][language];
}

export function pricingDecisionGoalLabel(goal: PricingDecisionGoal, language: "ar" | "en") {
  const labels = {
    fast_sale: { ar: "بيع أسرع", en: "Sell faster" },
    balanced: { ar: "سعر متوازن", en: "Balanced" },
    higher_margin: { ar: "هامش أعلى", en: "Higher margin" },
  } as const;
  return labels[goal][language];
}

export function formatSar(minor: number, language: "ar" | "en") {
  return `${new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100)} SAR`;
}

export function formatPercent(value: number, language: "ar" | "en") {
  return `${new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-SA", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value)}%`;
}

export function formatDecisionDate(value: Date | string, language: "ar" | "en") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return language === "ar" ? "تاريخ غير معروف" : "Unknown date";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function buildPricingDecisionHistoryHtml(records: PricingDecisionHistoryRecord[], language: "ar" | "en", generatedAt = new Date()) {
  const isArabic = language === "ar";
  const summary = summarizePricingDecisions(records);
  const copy = isArabic ? {
    title: "سجل قرارات التسعير",
    subtitle: "سجل مراجعة لقرارات التاجر. لا يثبت هذا السجل تعديلًا تلقائيًا لسعر المنتج.",
    generated: "تاريخ التصدير",
    total: "إجمالي القرارات",
    accepted: "اعتماد المقترح",
    customized: "سعر مختار",
    dismissed: "لم يعتمد",
    product: "المنتج",
    decision: "القرار",
    goal: "الهدف",
    ownPrice: "سعر المتجر",
    totalCost: "التكلفة الكلية/وحدة",
    productCost: "تكلفة المنتج",
    additionalCost: "إضافات/وحدة",
    targetPrice: "السعر المستهدف",
    selectedPrice: "السعر المسجل",
    grossMargin: "الهامش الإجمالي",
    evidence: "مصادر حديثة",
    date: "تاريخ القرار",
    noRecords: "لا توجد قرارات تسعير ضمن هذا التصدير.",
    notRecorded: "—",
    sku: "SKU",
    barcode: "باركود",
    beforeFees: "قبل الرسوم",
  } : {
    title: "Pricing decision history",
    subtitle: "A merchant review log. This record does not prove that any product price was changed automatically.",
    generated: "Exported",
    total: "Total decisions",
    accepted: "Accepted target",
    customized: "Selected price",
    dismissed: "Not used",
    product: "Product",
    decision: "Decision",
    goal: "Goal",
    ownPrice: "Store price",
    totalCost: "All-in cost / unit",
    productCost: "Product cost",
    additionalCost: "Add-ons / unit",
    targetPrice: "Target price",
    selectedPrice: "Recorded price",
    grossMargin: "Gross margin",
    evidence: "Current sources",
    date: "Decision date",
    noRecords: "No pricing decisions are included in this export.",
    notRecorded: "—",
    sku: "SKU",
    barcode: "Barcode",
    beforeFees: "before fees",
  };

  const rows = records.map((record) => {
    const identifiers = [record.productSku ? `${copy.sku}: ${escapeHtml(record.productSku)}` : "", record.productBarcode ? `${copy.barcode}: ${escapeHtml(record.productBarcode)}` : ""].filter(Boolean).join(" · ");
    const selectedPrice = resolvedDecisionPriceMinor(record);
    const totalCost = decisionTotalCostMinor(record);
    const margin = decisionGrossMargin(record);
    const marginText = margin ? `${formatPercent(margin.grossMarginPercent, language)} · ${formatSar(margin.grossProfitMinor, language)} ${copy.beforeFees}` : copy.notRecorded;
    const costBreakdown = [record.costPriceMinor ? `${copy.productCost}: ${formatSar(record.costPriceMinor, language)}` : "", record.additionalCostMinor ? `${copy.additionalCost}: ${formatSar(record.additionalCostMinor, language)}` : ""].filter(Boolean).join(" · ");
    return `<tr>
      <td><strong>${escapeHtml(record.productQuery)}</strong>${identifiers ? `<small>${identifiers}</small>` : ""}</td>
      <td>${escapeHtml(pricingDecisionActionLabel(record.action, language))}</td>
      <td>${escapeHtml(pricingDecisionGoalLabel(record.goal, language))}</td>
      <td>${formatSar(record.ownPriceMinor, language)}</td>
      <td>${totalCost ? `${formatSar(totalCost, language)}${costBreakdown ? `<small>${costBreakdown}</small>` : ""}` : copy.notRecorded}</td>
      <td>${formatSar(record.targetPriceMinor, language)}</td>
      <td>${selectedPrice ? formatSar(selectedPrice, language) : copy.notRecorded}</td>
      <td>${marginText}</td>
      <td>${record.sourceCount}</td>
      <td>${formatDecisionDate(record.createdAt, language)}</td>
    </tr>`;
  }).join("");

  return `<!doctype html>
<html lang="${language}" dir="${isArabic ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${copy.title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, "Noto Sans Arabic", sans-serif; color: #14201f; margin: 0; padding: 24px; direction: ${isArabic ? "rtl" : "ltr"}; }
  h1 { color: #0b3b3a; font-size: 24px; margin: 0; }
  p { color: #58706a; font-size: 12px; line-height: 1.65; margin: 8px 0 0; }
  .head { border-bottom: 2px solid #0f766e; padding-bottom: 16px; }
  .meta { color: #55706a; font-size: 11px; margin-top: 10px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 18px 0; }
  .metric { background: #f2f8f6; border: 1px solid #c9e4dc; border-radius: 8px; padding: 10px; }
  .metric b { color: #0f766e; display: block; font-size: 18px; margin-top: 3px; }
  .metric span { color: #58706a; font-size: 10px; }
  table { border-collapse: collapse; font-size: 9px; margin-top: 14px; width: 100%; }
  th { background: #0b3b3a; color: #fff; font-size: 8px; font-weight: 700; }
  td, th { border: 1px solid #d9e5e2; padding: 6px; text-align: ${isArabic ? "right" : "left"}; vertical-align: top; }
  td { color: #2c403c; }
  tr:nth-child(even) { background: #f8fbfa; }
  small { color: #6c827d; display: block; font-size: 8px; margin-top: 3px; }
  .empty { background: #f8fbfa; border: 1px dashed #9fcac2; color: #58706a; margin-top: 18px; padding: 24px; text-align: center; }
</style>
</head>
<body>
  <section class="head"><h1>${copy.title}</h1><p>${copy.subtitle}</p><div class="meta">${copy.generated}: ${formatDecisionDate(generatedAt, language)}</div></section>
  <section class="summary">
    <div class="metric"><span>${copy.total}</span><b>${summary.total}</b></div>
    <div class="metric"><span>${copy.accepted}</span><b>${summary.accepted}</b></div>
    <div class="metric"><span>${copy.customized}</span><b>${summary.customized}</b></div>
    <div class="metric"><span>${copy.dismissed}</span><b>${summary.dismissed}</b></div>
  </section>
  ${records.length ? `<table><thead><tr><th>${copy.product}</th><th>${copy.decision}</th><th>${copy.goal}</th><th>${copy.ownPrice}</th><th>${copy.totalCost}</th><th>${copy.targetPrice}</th><th>${copy.selectedPrice}</th><th>${copy.grossMargin}</th><th>${copy.evidence}</th><th>${copy.date}</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty">${copy.noRecords}</div>`}
</body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character] ?? character);
}
