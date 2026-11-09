export type BranchTransferCancellationNotificationInput = {
  transferId: number;
  branchName: string;
  cancellationReason: string;
};

/** Manager-safe copy: it identifies the canceled transfer and reason without exposing source balances. */
export function branchTransferCancellationNotificationCopy(input: BranchTransferCancellationNotificationInput) {
  const branchName = input.branchName.trim().slice(0, 191) || "الفرع المستهدف";
  const reason = input.cancellationReason.trim().replace(/\s+/g, " ").slice(0, 300);
  return {
    title: `تم إلغاء تحويل #${input.transferId}`,
    body: `ألغى مالك المتجر التحويل الموجّه إلى ${branchName}. السبب: ${reason}`.slice(0, 500),
  };
}
