import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { buildAnnualStatementHtml, type AnnualStatement } from "@/lib/billing-utils";

export type AnnualStatementExportResult = {
  method: "share" | "print";
  uri?: string;
};

export async function exportAnnualStatementPdf(
  statement: AnnualStatement,
  language: "ar" | "en",
): Promise<AnnualStatementExportResult> {
  const html = buildAnnualStatementHtml(statement, language);

  if (Platform.OS === "web") {
    if (typeof window === "undefined") throw new Error("Web print window is unavailable");
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) throw new Error("Allow pop-ups to export the annual statement");
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
    return { method: "print" };
  }

  const { uri } = await Print.printToFileAsync({
    html,
    margins: { top: 28, right: 28, bottom: 28, left: 28 },
  });
  const shareAvailable = await Sharing.isAvailableAsync();
  if (shareAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: ".pdf",
      dialogTitle: language === "ar" ? `كشف فواتير ${statement.year}` : `Invoice statement ${statement.year}`,
    });
  }
  return { method: "share", uri };
}
