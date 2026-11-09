import { isExpoPushToken } from "./branch-transfer-notifications";

export type InventoryReplenishmentPushPayload = {
  title: string;
  body: string;
  replenishmentRequestId: number;
};

type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: { route: "/inventory-operations"; replenishmentRequestId: number };
  channelId: "inventory-replenishment";
};

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const MAX_MESSAGES_PER_REQUEST = 100;

export function buildInventoryReplenishmentPushMessages(tokens: string[], payload: InventoryReplenishmentPushPayload): ExpoPushMessage[] {
  const uniqueTokens = [...new Set(tokens.map((token) => token.trim()).filter(isExpoPushToken))];
  return uniqueTokens.map((to) => ({
    to,
    sound: "default",
    title: payload.title.slice(0, 191),
    body: payload.body.slice(0, 500),
    data: { route: "/inventory-operations", replenishmentRequestId: payload.replenishmentRequestId },
    channelId: "inventory-replenishment",
  }));
}

/** Delivery is best-effort after the request and inbox rows are committed. */
export async function dispatchInventoryReplenishmentPushNotifications(tokens: string[], payload: InventoryReplenishmentPushPayload) {
  const messages = buildInventoryReplenishmentPushMessages(tokens, payload);
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
        console.warn(`[Replenishment notification] Expo push request failed (${response.status})`);
        continue;
      }
      const result = await response.json().catch(() => undefined) as { data?: { status?: string }[] } | undefined;
      accepted += result?.data?.filter((ticket) => ticket.status === "ok").length ?? 0;
    } catch (error) {
      console.warn("[Replenishment notification] Expo push request failed", error instanceof Error ? error.message : error);
    }
  }
  return { attempted: messages.length, accepted };
}
