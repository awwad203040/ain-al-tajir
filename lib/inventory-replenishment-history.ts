export type InventoryReplenishmentAuditRecord = {
  id: number;
  userId: number;
  branchId: number;
  requestId: number;
  fromStatus: "suggested" | "approved" | "ordered" | "closed" | "dismissed";
  toStatus: "suggested" | "approved" | "ordered" | "closed" | "dismissed";
  actorUserId: number;
  createdAt: Date | string;
  productName: string;
  productSku?: string | null;
  branchName: string;
  actorName: string;
  requestedQuantity: number;
  receivedQuantity: number;
  currentQuantity: number;
  minimumQuantity: number;
};

export type ReplenishmentAuditFilterStatus = "all" | InventoryReplenishmentAuditRecord["toStatus"];

export function filterReplenishmentAudit(records: InventoryReplenishmentAuditRecord[], search: string, status: ReplenishmentAuditFilterStatus = "all", days?: number, branchId?: number, actorUserId?: number, now = new Date()) {
  const query = search.trim().toLocaleLowerCase();
  const cutoff = days ? now.getTime() - days * 24 * 60 * 60 * 1000 : undefined;
  return records.filter((record) => {
    const matchesSearch = !query || [record.productName, record.productSku, record.branchName, record.actorName, String(record.requestId), `#${record.requestId}`].some((value) => value?.toLocaleLowerCase().includes(query));
    const matchesStatus = status === "all" || record.toStatus === status;
    const matchesBranch = branchId === undefined || record.branchId === branchId;
    const matchesActor = actorUserId === undefined || record.actorUserId === actorUserId;
    const createdAt = new Date(record.createdAt).getTime();
    const matchesDate = cutoff === undefined || (Number.isFinite(createdAt) && createdAt >= cutoff);
    return matchesSearch && matchesStatus && matchesDate && matchesBranch && matchesActor;
  });
}

export function replenishmentQuantityDifference(requestedQuantity: number, receivedQuantity: number) {
  return receivedQuantity - requestedQuantity;
}

export function replenishmentStatusLabel(status: InventoryReplenishmentAuditRecord["fromStatus"], language: "ar" | "en") {
  const labels = {
    suggested: { ar: "مقترح", en: "Suggested" },
    approved: { ar: "معتمد", en: "Approved" },
    ordered: { ar: "مطلوب", en: "Ordered" },
    closed: { ar: "مغلق", en: "Closed" },
    dismissed: { ar: "مرفوض", en: "Dismissed" },
  } as const;
  return labels[status][language];
}

export function formatReplenishmentAuditDate(value: Date | string, language: "ar" | "en") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return language === "ar" ? "تاريخ غير معروف" : "Unknown date";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function buildReplenishmentAuditHtml(records: InventoryReplenishmentAuditRecord[], language: "ar" | "en", generatedAt = new Date()) {
  const ar = language === "ar";
  const copy = ar ? {
    title: "سجل قرارات إعادة التزويد",
    subtitle: "سجل تدقيقي للحالات التي اعتمدها أو أغلقها المستخدمون. لا يغير هذا التصدير أرصدة المخزون.",
    generated: "تاريخ التصدير",
    product: "المنتج",
    branch: "الفرع",
    request: "رقم الطلب",
    transition: "الانتقال",
    actor: "المنفذ",
    date: "التاريخ",
    empty: "لا توجد قرارات ضمن هذا التصدير.",
  } : {
    title: "Replenishment decision history",
    subtitle: "An audit log of reviewed replenishment status changes. This export never changes inventory balances.",
    generated: "Exported",
    product: "Product",
    branch: "Branch",
    request: "Request",
    transition: "Transition",
    actor: "Actor",
    date: "Date",
    empty: "No decisions are included in this export.",
  };
  const rows = records.map((record) => `<tr><td><strong>${escapeHtml(record.productName)}</strong>${record.productSku ? `<small>${escapeHtml(record.productSku)}</small>` : ""}</td><td>${escapeHtml(record.branchName)}</td><td>#${record.requestId}</td><td>${escapeHtml(replenishmentStatusLabel(record.fromStatus, language))} ${ar ? "←" : "→"} ${escapeHtml(replenishmentStatusLabel(record.toStatus, language))}</td><td>${escapeHtml(record.actorName)}</td><td>${formatReplenishmentAuditDate(record.createdAt, language)}</td></tr>`).join("");
  return `<!doctype html><html lang="${language}" dir="${ar ? "rtl" : "ltr"}><head><meta charset="utf-8"/><title>${copy.title}</title><style>*{box-sizing:border-box}body{font-family:Arial,"Noto Sans Arabic",sans-serif;color:#14201f;margin:0;padding:24px;direction:${ar ? "rtl" : "ltr"}}h1{color:#0b3b3a;font-size:24px;margin:0}p{color:#58706a;font-size:12px;line-height:1.65;margin:8px 0}.head{border-bottom:2px solid #0f766e;padding-bottom:16px}.meta{color:#55706a;font-size:11px;margin-top:10px}table{border-collapse:collapse;font-size:10px;margin-top:18px;width:100%}th{background:#0b3b3a;color:#fff;font-size:9px}td,th{border:1px solid #d9e5e2;padding:7px;text-align:${ar ? "right" : "left"};vertical-align:top}tr:nth-child(even){background:#f8fbfa}small{color:#6c827d;display:block;font-size:8px;margin-top:3px}.empty{background:#f8fbfa;border:1px dashed #9fcac2;color:#58706a;margin-top:18px;padding:24px;text-align:center}</style></head><body><section class="head"><h1>${copy.title}</h1><p>${copy.subtitle}</p><div class="meta">${copy.generated}: ${formatReplenishmentAuditDate(generatedAt, language)}</div></section>${records.length ? `<table><thead><tr><th>${copy.product}</th><th>${copy.branch}</th><th>${copy.request}</th><th>${copy.transition}</th><th>${copy.actor}</th><th>${copy.date}</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty">${copy.empty}</div>`}</body></html>`;
}

export function buildReplenishmentRequestHtml(records: InventoryReplenishmentAuditRecord[], language: "ar" | "en", generatedAt = new Date()) {
  const ar = language === "ar";
  const first = records[0];
  const title = ar ? "تفاصيل طلب إعادة التزويد" : "Replenishment request details";
  const requested = first?.requestedQuantity ?? 0;
  const received = first?.receivedQuantity ?? 0;
  const difference = replenishmentQuantityDifference(requested, received);
  const labels = ar ? { request: "رقم الطلب", product: "المنتج", branch: "الفرع", requested: "الكمية المطلوبة", received: "الكمية المستلمة", difference: "فرق الاستلام", timeline: "الخط الزمني", actor: "المنفذ", date: "التاريخ", generated: "تاريخ التصدير", empty: "لا توجد تفاصيل لهذا الطلب." } : { request: "Request", product: "Product", branch: "Branch", requested: "Requested quantity", received: "Received quantity", difference: "Receipt difference", timeline: "Timeline", actor: "Actor", date: "Date", generated: "Exported", empty: "No details are available for this request." };
  const timeline = records.slice().reverse().map((record) => `<tr><td>${escapeHtml(replenishmentStatusLabel(record.fromStatus, language))} ${ar ? "←" : "→"} ${escapeHtml(replenishmentStatusLabel(record.toStatus, language))}</td><td>${escapeHtml(record.actorName)}</td><td>${formatReplenishmentAuditDate(record.createdAt, language)}</td></tr>`).join("");
  if (!first) return `<!doctype html><html lang="${language}" dir="${ar ? "rtl" : "ltr"}><head><meta charset="utf-8"/><title>${title}</title></head><body><p>${labels.empty}</p></body></html>`;
  return `<!doctype html><html lang="${language}" dir="${ar ? "rtl" : "ltr"}><head><meta charset="utf-8"/><title>${title} #${first.requestId}</title><style>*{box-sizing:border-box}body{font-family:Arial,"Noto Sans Arabic",sans-serif;color:#14201f;margin:0;padding:24px;direction:${ar ? "rtl" : "ltr"}}h1{color:#0b3b3a;font-size:24px;margin:0}h2{color:#0b3b3a;font-size:16px;margin:22px 0 8px}p{color:#58706a;font-size:12px;line-height:1.65;margin:8px 0}.head{border-bottom:2px solid #0f766e;padding-bottom:16px}.meta{color:#55706a;font-size:11px;margin-top:10px}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:18px}.fact{background:#f8fbfa;border:1px solid #d9e5e2;border-radius:8px;padding:10px}.label{color:#58706a;font-size:9px}.value{color:#0f766e;font-size:16px;font-weight:bold;margin-top:5px}table{border-collapse:collapse;font-size:10px;margin-top:8px;width:100%}th{background:#0b3b3a;color:#fff;font-size:9px}td,th{border:1px solid #d9e5e2;padding:7px;text-align:${ar ? "right" : "left"};vertical-align:top}tr:nth-child(even){background:#f8fbfa}.difference{color:${difference < 0 ? "#a85e00" : "#176458"};font-weight:bold}</style></head><body><section class="head"><h1>${title} #${first.requestId}</h1><p>${escapeHtml(labels.product)}: ${escapeHtml(first.productName)}${first.productSku ? ` · ${escapeHtml(first.productSku)}` : ""}<br/>${escapeHtml(labels.branch)}: ${escapeHtml(first.branchName)}</p><div class="meta">${labels.generated}: ${formatReplenishmentAuditDate(generatedAt, language)}</div></section><div class="facts"><div class="fact"><div class="label">${labels.requested}</div><div class="value">${requested}</div></div><div class="fact"><div class="label">${labels.received}</div><div class="value">${received}</div></div><div class="fact"><div class="label">${labels.difference}</div><div class="value difference">${difference > 0 ? "+" : ""}${difference}</div></div></div><h2>${labels.timeline}</h2><table><thead><tr><th>${ar ? "الانتقال" : "Transition"}</th><th>${labels.actor}</th><th>${labels.date}</th></tr></thead><tbody>${timeline}</tbody></table></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character] ?? character);
}
