import type { InventoryReplenishmentAuditRecord } from "./inventory-replenishment-history";

export type ReplenishmentVarianceRow = {
  branchId: number;
  branchName: string;
  requests: number;
  requestedQuantity: number;
  receivedQuantity: number;
  receivedRate: number;
  difference: number;
  shortageQuantity: number;
  surplusQuantity: number;
};

export function monthKey(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string, language: "ar" | "en") {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function recentMonthKeys(count = 6, now = new Date()) {
  const result: string[] = [];
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let index = 0; index < count; index += 1) {
    result.push(monthKey(date));
    date.setUTCMonth(date.getUTCMonth() - 1);
  }
  return result;
}

export function buildReplenishmentVarianceReport(records: InventoryReplenishmentAuditRecord[], selectedMonth: string, branchId?: number): ReplenishmentVarianceRow[] {
  const closed = records.filter((record) => record.toStatus === "closed" && monthKey(record.createdAt) === selectedMonth && (branchId === undefined || record.branchId === branchId));
  const unique = [...new Map(closed.map((record) => [record.requestId, record])).values()];
  const grouped = new Map<number, ReplenishmentVarianceRow>();
  for (const record of unique) {
    const difference = record.receivedQuantity - record.requestedQuantity;
    const current = grouped.get(record.branchId) ?? { branchId: record.branchId, branchName: record.branchName, requests: 0, requestedQuantity: 0, receivedQuantity: 0, receivedRate: 0, difference: 0, shortageQuantity: 0, surplusQuantity: 0 };
    current.requests += 1;
    current.requestedQuantity += record.requestedQuantity;
    current.receivedQuantity += record.receivedQuantity;
    current.receivedRate = current.requestedQuantity ? Math.round((current.receivedQuantity / current.requestedQuantity) * 100) : 0;
    current.difference += difference;
    if (difference < 0) current.shortageQuantity += Math.abs(difference);
    if (difference > 0) current.surplusQuantity += difference;
    grouped.set(record.branchId, current);
  }
  return [...grouped.values()].sort((a, b) => a.branchName.localeCompare(b.branchName, "ar"));
}

export function buildReplenishmentVarianceHtml(rows: ReplenishmentVarianceRow[], selectedMonth: string, language: "ar" | "en", generatedAt = new Date()) {
  const ar = language === "ar";
  const title = ar ? "تقرير فروقات إعادة التزويد الشهري" : "Monthly replenishment variance report";
  const labels = ar ? { month: "الشهر", generated: "تاريخ التصدير", branch: "الفرع", requests: "الطلبات", requested: "المطلوب", received: "المستلم", rate: "نسبة الاستلام", difference: "الفارق", shortage: "النقص", surplus: "الزيادة", empty: "لا توجد طلبات مغلقة في هذا الشهر." } : { month: "Month", generated: "Exported", branch: "Branch", requests: "Requests", requested: "Requested", received: "Received", rate: "Receipt rate", difference: "Difference", shortage: "Shortage", surplus: "Surplus", empty: "No closed requests were recorded for this month." };
  const total = rows.reduce((sum, row) => ({ requests: sum.requests + row.requests, requested: sum.requested + row.requestedQuantity, received: sum.received + row.receivedQuantity, difference: sum.difference + row.difference, shortage: sum.shortage + row.shortageQuantity, surplus: sum.surplus + row.surplusQuantity }), { requests: 0, requested: 0, received: 0, difference: 0, shortage: 0, surplus: 0 });
  const cells = rows.map((row) => `<tr><td>${escapeHtml(row.branchName)}</td><td>${row.requests}</td><td>${row.requestedQuantity}</td><td>${row.receivedQuantity}</td><td>${row.receivedRate}%</td><td class="${row.difference < 0 ? "negative" : "positive"}">${row.difference > 0 ? "+" : ""}${row.difference}</td><td>${row.shortageQuantity}</td><td>${row.surplusQuantity}</td></tr>`).join("");
  return `<!doctype html><html lang="${language}" dir="${ar ? "rtl" : "ltr"}><head><meta charset="utf-8"/><title>${title}</title><style>*{box-sizing:border-box}body{font-family:Arial,"Noto Sans Arabic",sans-serif;color:#14201f;margin:0;padding:24px;direction:${ar ? "rtl" : "ltr"}}h1{color:#0b3b3a;font-size:24px;margin:0}p{color:#58706a;font-size:12px;line-height:1.6}.head{border-bottom:2px solid #0f766e;padding-bottom:15px}.meta{color:#58706a;font-size:11px;margin-top:8px}.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:18px}.total{background:#f8fbfa;border:1px solid #d9e5e2;border-radius:8px;padding:10px}.label{color:#58706a;font-size:9px}.value{color:#0f766e;font-size:16px;font-weight:bold;margin-top:4px}table{border-collapse:collapse;font-size:10px;margin-top:18px;width:100%}th{background:#0b3b3a;color:#fff;font-size:9px}td,th{border:1px solid #d9e5e2;padding:7px;text-align:${ar ? "right" : "left"}}tr:nth-child(even){background:#f8fbfa}.negative{color:#a85e00;font-weight:bold}.positive{color:#176458;font-weight:bold}.empty{background:#f8fbfa;border:1px dashed #9fcac2;color:#58706a;margin-top:18px;padding:24px;text-align:center}</style></head><body><section class="head"><h1>${title}</h1><p>${labels.month}: ${monthLabel(selectedMonth, language)}</p><div class="meta">${labels.generated}: ${new Intl.DateTimeFormat(ar ? "ar-SA" : "en-GB", { dateStyle: "medium" }).format(generatedAt)}</div></section><div class="totals"><div class="total"><div class="label">${labels.requests}</div><div class="value">${total.requests}</div></div><div class="total"><div class="label">${labels.requested}</div><div class="value">${total.requested}</div></div><div class="total"><div class="label">${labels.received}</div><div class="value">${total.received}</div></div></div>${rows.length ? `<table><thead><tr><th>${labels.branch}</th><th>${labels.requests}</th><th>${labels.requested}</th><th>${labels.received}</th><th>${labels.rate}</th><th>${labels.difference}</th><th>${labels.shortage}</th><th>${labels.surplus}</th></tr></thead><tbody>${cells}</tbody></table>` : `<div class="empty">${labels.empty}</div>`}</body></html>`;
}

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character] ?? character); }
