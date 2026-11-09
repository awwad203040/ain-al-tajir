import { describe, expect, it } from "vitest";

import { canApproveBranchReceipt } from "../shared/branch-manager-access";

describe("branch manager receipt authorization", () => {
  it("allows receipt approval only for the assigned target manager while stock is in transit", () => {
    expect(canApproveBranchReceipt({ isAssignedTargetManager: true, transferStatus: "in_transit" })).toBe(true);
  });

  it("denies an unassigned user even when the transfer is in transit", () => {
    expect(canApproveBranchReceipt({ isAssignedTargetManager: false, transferStatus: "in_transit" })).toBe(false);
  });

  it("denies repeated or canceled receipt approval for the assigned manager", () => {
    expect(canApproveBranchReceipt({ isAssignedTargetManager: true, transferStatus: "received" })).toBe(false);
    expect(canApproveBranchReceipt({ isAssignedTargetManager: true, transferStatus: "canceled" })).toBe(false);
  });
});
