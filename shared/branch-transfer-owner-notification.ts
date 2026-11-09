export type OwnerReceiptNotificationCopy = {
  title: string;
  content: string;
};

/** Compact operational alert for the system owner after a receipt transaction has fully committed. */
export function branchTransferOwnerReceiptNotification(input: { transferId: number; targetBranchName: string; lineCount: number; quantityReceived: number }): OwnerReceiptNotificationCopy {
  const transferId = Math.max(1, Math.trunc(input.transferId));
  const branchName = input.targetBranchName.trim().slice(0, 120) || "الفرع المستهدف";
  const lineCount = Math.max(1, Math.min(100, Math.trunc(input.lineCount)));
  const quantityReceived = Math.max(1, Math.min(1_000_000, Math.trunc(input.quantityReceived)));
  return {
    title: `تم اعتماد استلام تحويل المخزون #${transferId}`,
    content: `تم اعتماد استلام التحويل في «${branchName}» بنجاح. شمل ${lineCount} ${lineCount === 1 ? "صنف" : "أصناف"} بإجمالي ${quantityReceived} وحدة، وتم تحديث رصيد الفرع المستهدف.`,
  };
}
