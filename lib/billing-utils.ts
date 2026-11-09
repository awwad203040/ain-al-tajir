import type { SubscriptionStatus } from "@/shared/payment";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionNoticeKind = "renewal_info" | "renewal_warning" | "renewal_urgent" | "ending" | "expired" | "past_due";

export type SubscriptionNotice = {
  kind: SubscriptionNoticeKind;
  daysRemaining: number;
};

export function getSubscriptionNotice(
  status: SubscriptionStatus,
  currentPeriodEnd?: Date | string | null,
  cancelAtPeriodEnd = false,
  now = new Date(),
): SubscriptionNotice | null {
  const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const daysRemaining = periodEnd ? Math.ceil((periodEnd.getTime() - now.getTime()) / DAY_MS) : 0;

  if (status === "past_due") return { kind: "past_due", daysRemaining };
  if (status === "canceled" || (periodEnd && daysRemaining < 0)) return { kind: "expired", daysRemaining };
  if (status !== "active") return null;
  if (cancelAtPeriodEnd) return { kind: "ending", daysRemaining };
  if (!periodEnd) return null;
  if (daysRemaining <= 3) return { kind: "renewal_urgent", daysRemaining };
  if (daysRemaining <= 7) return { kind: "renewal_warning", daysRemaining };
  if (daysRemaining <= 14) return { kind: "renewal_info", daysRemaining };
  return null;
}

export type StatementInvoice = {
  id: number;
  invoiceNumber?: string | null;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  amountDueMinor: number;
  amountPaidMinor: number;
  currency: string;
  paidAt?: Date | string | null;
  createdAt: Date | string;
};

export type AnnualStatement = {
  year: number;
  invoices: StatementInvoice[];
  totalPaidMinor: number;
  totalDueMinor: number;
  currency: string;
};

export function buildAnnualStatement(invoices: StatementInvoice[], year: number): AnnualStatement {
  const selected = invoices
    .filter((invoice) => new Date(invoice.paidAt ?? invoice.createdAt).getFullYear() === year)
    .sort((left, right) => new Date(right.paidAt ?? right.createdAt).getTime() - new Date(left.paidAt ?? left.createdAt).getTime());

  return {
    year,
    invoices: selected,
    totalPaidMinor: selected.reduce((sum, invoice) => sum + invoice.amountPaidMinor, 0),
    totalDueMinor: selected.reduce((sum, invoice) => sum + invoice.amountDueMinor, 0),
    currency: selected[0]?.currency ?? "SAR",
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function buildAnnualStatementHtml(statement: AnnualStatement, language: "ar" | "en") {
  const isRTL = language === "ar";
  const locale = isRTL ? "ar-SA" : "en-US";
  const money = (minor: number) => `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100)} ${escapeHtml(statement.currency)}`;
  const date = (value: Date | string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
  const statusLabel: Record<StatementInvoice["status"], { ar: string; en: string }> = {
    paid: { ar: "مدفوعة", en: "Paid" },
    open: { ar: "مستحقة", en: "Open" },
    draft: { ar: "مسودة", en: "Draft" },
    void: { ar: "ملغاة", en: "Void" },
    uncollectible: { ar: "متعذرة", en: "Uncollectible" },
  };
  const rows = statement.invoices.map((invoice) => `
    <tr>
      <td>${escapeHtml(invoice.invoiceNumber ?? `#${invoice.id}`)}</td>
      <td>${date(invoice.paidAt ?? invoice.createdAt)}</td>
      <td>${escapeHtml(statusLabel[invoice.status][language])}</td>
      <td>${money(invoice.amountDueMinor)}</td>
      <td>${money(invoice.amountPaidMinor)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
  <html lang="${language}" dir="${isRTL ? "rtl" : "ltr"}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        @page { margin: 28px; }
        * { box-sizing: border-box; }
        body { color: #14201F; font-family: Tahoma, Arial, sans-serif; margin: 0; direction: ${isRTL ? "rtl" : "ltr"}; }
        .header { background: #0B3B3A; color: white; border-radius: 16px; padding: 24px; }
        .brand { font-size: 13px; opacity: .75; }
        h1 { font-size: 25px; margin: 8px 0 0; }
        .period { font-size: 13px; margin-top: 8px; opacity: .8; }
        .summary { display: flex; gap: 12px; margin: 18px 0; }
        .summary-card { background: #F4F7F6; border: 1px solid #DDE7E4; border-radius: 12px; flex: 1; padding: 14px; }
        .summary-label { color: #667A77; font-size: 11px; }
        .summary-value { font-size: 18px; font-weight: bold; margin-top: 5px; }
        table { border-collapse: collapse; font-size: 11px; width: 100%; }
        th { background: #E4F2F0; color: #0B3B3A; font-weight: bold; }
        th, td { border-bottom: 1px solid #DDE7E4; padding: 10px 8px; text-align: ${isRTL ? "right" : "left"}; }
        .footer { color: #667A77; font-size: 9px; margin-top: 22px; text-align: center; }
      </style>
    </head>
    <body>
      <section class="header">
        <div class="brand">${isRTL ? "عين التاجر" : "Ain Al-Tajir"}</div>
        <h1>${isRTL ? "كشف حساب الفواتير السنوي" : "Annual Invoice Statement"}</h1>
        <div class="period">${isRTL ? `السنة المالية ${statement.year}` : `Fiscal year ${statement.year}`}</div>
      </section>
      <section class="summary">
        <div class="summary-card"><div class="summary-label">${isRTL ? "عدد الفواتير" : "Invoice count"}</div><div class="summary-value">${statement.invoices.length}</div></div>
        <div class="summary-card"><div class="summary-label">${isRTL ? "إجمالي المدفوع" : "Total paid"}</div><div class="summary-value">${money(statement.totalPaidMinor)}</div></div>
        <div class="summary-card"><div class="summary-label">${isRTL ? "إجمالي المستحق" : "Total due"}</div><div class="summary-value">${money(statement.totalDueMinor)}</div></div>
      </section>
      <table>
        <thead><tr><th>${isRTL ? "الفاتورة" : "Invoice"}</th><th>${isRTL ? "التاريخ" : "Date"}</th><th>${isRTL ? "الحالة" : "Status"}</th><th>${isRTL ? "المستحق" : "Due"}</th><th>${isRTL ? "المدفوع" : "Paid"}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">${isRTL ? "تم إنشاء هذا الكشف من الفواتير المسجلة في حساب عين التاجر." : "This statement was generated from invoices recorded in your Ain Al-Tajir account."}</div>
    </body>
  </html>`;
}
