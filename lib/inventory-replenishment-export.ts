import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { buildReplenishmentAuditHtml, buildReplenishmentRequestHtml, type InventoryReplenishmentAuditRecord } from "@/lib/inventory-replenishment-history";

export async function exportInventoryReplenishmentAuditPdf(records: InventoryReplenishmentAuditRecord[], language: "ar" | "en") {
  const html = buildReplenishmentAuditHtml(records, language);
  const title = language === "ar" ? "سجل قرارات إعادة التزويد" : "Replenishment decision history";
  if (Platform.OS === "web") {
    if (typeof window === "undefined") throw new Error("Web print window is unavailable");
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) throw new Error("Allow pop-ups to export the replenishment history");
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
    return { method: "print" as const };
  }
  const { uri } = await Print.printToFileAsync({ html, margins: { top: 28, right: 28, bottom: 28, left: 28 } });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: ".pdf", dialogTitle: title });
  return { method: "share" as const, uri };
}

export async function exportInventoryReplenishmentRequestPdf(records: InventoryReplenishmentAuditRecord[], language: "ar" | "en") {
  const html = buildReplenishmentRequestHtml(records, language);
  const title = language === "ar" ? "تفاصيل طلب إعادة التزويد" : "Replenishment request details";
  if (Platform.OS === "web") {
    if (typeof window === "undefined") throw new Error("Web print window is unavailable");
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) throw new Error("Allow pop-ups to export request details");
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
    return { method: "print" as const };
  }
  const { uri } = await Print.printToFileAsync({ html, margins: { top: 28, right: 28, bottom: 28, left: 28 } });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: ".pdf", dialogTitle: title });
  return { method: "share" as const, uri };
}
