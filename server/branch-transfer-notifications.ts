export type BranchTransferPushPayload = {
  title: string;
  body: string;
  transferId: number;
};

type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: { route: "/branch-transfers"; transferId: number };
  channelId: "branch-transfers";
};

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const MAX_MESSAGES_PER_REQUEST = 100;

export function isExpoPushToken(value: string) {
  return /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(value.trim());
}

/** Creates a narrowly scoped, manager-safe Expo payload without stock or merchant data. */
export function buildBranchTransferPushMessages(tokens: string[], payload: BranchTransferPushPayload): ExpoPushMessage[] {
  const uniqueTokens = [...new Set(tokens.map((token) => token.trim()).filter(isExpoPushToken))];
  return uniqueTokens.map((to) => ({
    to,
    sound: "default",
    title: payload.title.slice(0, 191),
    body: payload.body.slice(0, 500),
    data: { route: "/branch-transfers", transferId: payload.transferId },
    channelId: "branch-transfers",
  }));
}

/** Sends device alerts after the in-app inbox record has been committed. Delivery failure never rolls back stock transfer creation. */
export async function dispatchBranchTransferPushNotifications(tokens: string[], payload: BranchTransferPushPayload) {
  const messages = buildBranchTransferPushMessages(tokens, payload);
  if (!messages.length) return { attempted: 0, accepted: 0 };
  let accepted = 0;
  for (let offset = 0; offset < messages.length; offset += MAX_MESSAGES_PER_REQUEST) {
    const batch = messages.slice(offset, offset + MAX_MESSAGES_PER_REQUEST);
    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        console.warn(`[Branch notification] Expo push request failed (${response.status})`);
        continue;
      }
      const result = await response.json().catch(() => undefined) as { data?: { status?: string }[] } | undefined;
      accepted += result?.data?.filter((ticket) => ticket.status === "ok").length ?? 0;
    } catch (error) {
      console.warn("[Branch notification] Expo push request failed", error instanceof Error ? error.message : error);
    }
  }
  return { attempted: messages.length, accepted };
}
