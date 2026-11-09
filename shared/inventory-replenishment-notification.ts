export type InventoryReplenishmentNotificationInput = {
  productName: string;
  branchName: string;
  currentQuantity: number;
  minimumQuantity: number;
  suggestedQuantity: number;
};

export type InventoryReplenishmentStatusNotificationInput = {
  productName: string;
  branchName: string;
  status: "approved" | "closed";
  actorName?: string;
  requestedQuantity?: number;
  receivedQuantity?: number;
};

export function inventoryReplenishmentNotificationCopy(input: InventoryReplenishmentNotificationInput) {
  const productName = input.productName.trim().slice(0, 120);
  const branchName = input.branchName.trim().slice(0, 120);
  return {
    title: `اقتراح إعادة تزويد · ${branchName}`,
    body: `انخفض ${productName} إلى ${input.currentQuantity}، والحد الأدنى ${input.minimumQuantity}. الكمية المقترحة: ${input.suggestedQuantity}. راجع الطلب واعتمده.`,
  };
}

export function inventoryReplenishmentStatusNotificationCopy(input: InventoryReplenishmentStatusNotificationInput) {
  const productName = input.productName.trim().slice(0, 120);
  const branchName = input.branchName.trim().slice(0, 120);
  const actor = input.actorName?.trim().slice(0, 100);
  if (input.status === "approved") {
    return {
      title: `تم اعتماد إعادة التزويد · ${branchName}`,
      body: `اعتمد مدير الفرع طلب إعادة تزويد المنتج ${productName}${actor ? ` (${actor})` : ""}. راجع الطلب لمتابعة التوريد.`,
    };
  }
  const hasDiscrepancy = input.requestedQuantity !== undefined && input.receivedQuantity !== undefined && input.requestedQuantity > 0 && input.receivedQuantity < input.requestedQuantity * 0.8;
  if (hasDiscrepancy) {
    return {
      title: `تنبيه فرق استلام كبير · ${branchName}`,
      body: `استلم الفرع ${input.receivedQuantity} من أصل ${input.requestedQuantity} للمنتج ${productName}${actor ? ` (${actor})` : ""}، أي أقل من 80٪ من المطلوب. يرجى المراجعة واتخاذ الإجراء المناسب.`,
    };
  }
  return {
    title: `تم إغلاق إعادة التزويد · ${branchName}`,
    body: `أغلق مدير الفرع طلب إعادة تزويد المنتج ${productName}${actor ? ` (${actor})` : ""} بعد التوريد.`,
  };
}
