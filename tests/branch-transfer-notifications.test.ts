import { describe, expect, it } from "vitest";

import { buildBranchTransferPushMessages, isExpoPushToken } from "../server/branch-transfer-notifications";
import { branchTransferNotificationCopy } from "../shared/branch-transfer-notification";
import { branchTransferOwnerReceiptNotification } from "../shared/branch-transfer-owner-notification";
import { branchTransferCancellationNotificationCopy } from "../shared/branch-transfer-cancellation-notification";

describe("branch transfer notifications", () => {
  it("builds a concise manager notification without source branch or stock balance details", () => {
    const copy = branchTransferNotificationCopy({ branchName: "فرع جدة", lineCount: 2, quantitySent: 17 });
    expect(copy.title).toContain("فرع جدة");
    expect(copy.body).toContain("17");
    expect(copy.body).not.toContain("المصدر");
  });

  it("accepts only Expo tokens and deduplicates device deliveries", () => {
    expect(isExpoPushToken("ExponentPushToken[abc_123-XYZ]")).toBe(true);
    expect(isExpoPushToken("not-a-token")).toBe(false);
    const messages = buildBranchTransferPushMessages([
      "ExponentPushToken[abc_123-XYZ]",
      "ExponentPushToken[abc_123-XYZ]",
      "invalid-token",
    ], { title: "تحويل جديد", body: "راجع الاستلام", transferId: 42 });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: "ExponentPushToken[abc_123-XYZ]",
      data: { route: "/branch-transfers", transferId: 42 },
      channelId: "branch-transfers",
    });
  });

  it("creates a concise owner alert only after a receipt has a transfer and destination summary", () => {
    const notice = branchTransferOwnerReceiptNotification({
      transferId: 27,
      targetBranchName: "فرع الخبر",
      lineCount: 3,
      quantityReceived: 14,
    });
    expect(notice.title).toContain("#27");
    expect(notice.content).toContain("فرع الخبر");
    expect(notice.content).toContain("14");
    expect(notice.content).not.toContain("مدير");
  });

  it("notifies the target manager of cancellation with the recorded reason but no source balance", () => {
    const notice = branchTransferCancellationNotificationCopy({
      transferId: 31,
      branchName: "فرع الرياض",
      cancellationReason: "تم إدخال كميات غير صحيحة",
    });
    expect(notice.title).toContain("#31");
    expect(notice.body).toContain("فرع الرياض");
    expect(notice.body).toContain("كميات غير صحيحة");
    expect(notice.body).not.toContain("رصيد");
  });
});
