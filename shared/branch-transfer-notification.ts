export type BranchTransferNotificationCopy = {
  title: string;
  body: string;
};

/** Builds a concise manager alert without revealing source-branch balances or merchant data. */
export function branchTransferNotificationCopy(input: { branchName: string; lineCount: number; quantitySent: number }): BranchTransferNotificationCopy {
  const branchName = input.branchName.trim().slice(0, 120) || "فرعك";
  const lineCount = Math.max(1, Math.min(100, Math.trunc(input.lineCount)));
  const quantitySent = Math.max(1, Math.min(1_000_000, Math.trunc(input.quantitySent)));
  return {
    title: `تحويل مخزون جديد إلى ${branchName}`,
    body: `راجع واستلم تحويلًا يحتوي على ${lineCount} ${lineCount === 1 ? "صنف" : "أصناف"} بإجمالي ${quantitySent} وحدة.`,
  };
}
