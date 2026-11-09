import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type InventoryReplenishmentPushRegistrationResult =
  | { status: "registered"; expoToken: string; platform: "android" | "ios" }
  | { status: "denied" | "unavailable"; reason: string };

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Requests native permission for owner replenishment alerts on a physical build. */
export async function registerForInventoryReplenishmentPushNotifications(): Promise<InventoryReplenishmentPushRegistrationResult> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return { status: "unavailable", reason: "Native mobile notifications are available in Android and iOS builds only." };
  }
  if (!Constants.isDevice) {
    return { status: "unavailable", reason: "Use a physical device to enable replenishment notifications." };
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("inventory-replenishment", {
      name: "إعادة تزويد المخزون",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: "#0F766E",
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") {
    return { status: "denied", reason: "Notification permission was not granted." };
  }
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    return { status: "unavailable", reason: "This app build is not configured for remote push notifications yet." };
  }
  try {
    const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!expoToken) return { status: "unavailable", reason: "A push token could not be created for this device." };
    return { status: "registered", expoToken, platform: Platform.OS };
  } catch (error) {
    return { status: "unavailable", reason: error instanceof Error ? error.message : "A push token could not be created." };
  }
}
