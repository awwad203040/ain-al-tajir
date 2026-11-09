import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import * as XLSX from "xlsx";

import { buildReplenishmentVarianceHtml, monthLabel, type ReplenishmentVarianceRow } from "./replenishment-variance-report";

function workbookBase64(rows: ReplenishmentVarianceRow[], selectedMonth: string, language: "ar" | "en") {
  const ar = language === "ar";
  const total = rows.reduce((sum, row) => ({
    requests: sum.requests + row.requests,
    requested: sum.requested + row.requestedQuantity,
    received: sum.received + row.receivedQuantity,
    difference: sum.difference + row.difference,
    shortage: sum.shortage + row.shortageQuantity,
    surplus: sum.surplus + row.surplusQuantity,
  }), { requests: 0, requested: 0, received: 0, difference: 0, shortage: 0, surplus: 0 });
  const headers = ar ? ["الفرع", "الطلبات", "المطلوب", "المستلم", "نسبة الاستلام", "الفارق", "النقص", "الزيادة"] : ["Branch", "Requests", "Requested", "Received", "Receipt rate", "Difference", "Shortage", "Surplus"];
  const data = rows.map((row) => [row.branchName, row.requests, row.requestedQuantity, row.receivedQuantity, `${row.receivedRate}%`, row.difference, row.shortageQuantity, row.surplusQuantity]);
  const sheet = XLSX.utils.aoa_to_sheet([
    [ar ? "تقرير فروقات إعادة التزويد الشهري" : "Monthly replenishment variance report"],
    [ar ? "الشهر" : "Month", monthLabel(selectedMonth, language)],
    [],
    headers,
    ...data,
    [],
    [ar ? "الإجمالي" : "Total", total.requests, total.requested, total.received, total.requested ? `${Math.round((total.received / total.requested) * 100)}%` : "0%", total.difference, total.shortage, total.surplus],
  ]);
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
  sheet["!cols"] = [{ wch: 24 }, ...Array.from({ length: 7 }, () => ({ wch: 14 }))];
  sheet["!freeze"] = { xSplit: 0, ySplit: 4 };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, ar ? "التقرير" : "Report");
  return XLSX.write(workbook, { bookType: "xlsx", type: "base64" });
}

export async function exportReplenishmentVarianceXlsx(rows: ReplenishmentVarianceRow[], selectedMonth: string, language: "ar" | "en") {
  const base64 = workbookBase64(rows, selectedMonth, language);
  const filename = `replenishment-variance-${selectedMonth}.xlsx`;
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof document === "undefined") throw new Error("Web download is unavailable");
    const binary = globalThis.atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { method: "download" as const, filename };
  }
  const uri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", UTI: "com.microsoft.excel.xlsx", dialogTitle: language === "ar" ? "تقرير فروقات التزويد" : "Replenishment variance report" });
  return { method: "share" as const, uri };
}

export async function exportReplenishmentVariancePdf(rows: ReplenishmentVarianceRow[], selectedMonth: string, language: "ar" | "en") {
  const html = buildReplenishmentVarianceHtml(rows, selectedMonth, language);
  const title = language === "ar" ? "تقرير فروقات إعادة التزويد" : "Replenishment variance report";
  if (Platform.OS === "web") {
    if (typeof window === "undefined") throw new Error("Web print window is unavailable");
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) throw new Error("Allow pop-ups to export the variance report");
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
