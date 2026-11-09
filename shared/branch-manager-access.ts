export type BranchReceiptAccess = {
  isAssignedTargetManager: boolean;
  transferStatus: "in_transit" | "received" | "canceled";
};

/** Only the manager assigned to the target branch can approve an in-transit receipt. */
export function canApproveBranchReceipt(access: BranchReceiptAccess) {
  return access.isAssignedTargetManager && access.transferStatus === "in_transit";
}
