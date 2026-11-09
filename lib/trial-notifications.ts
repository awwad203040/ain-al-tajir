import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const STORAGE_KEY = "ain-altajir-trial-reminder-schedule";
export const TRIAL_REMINDERS_ENABLED_KEY = "ain-altajir-trial-reminders-enabled";
const DAY_MS = 24 * 60 * 60 * 1000;

type StoredSchedule = { trialEndsAt: string; notificationIds: string[] };

export async function getTrialReminderPreference() {
  return (await AsyncStorage.getItem(TRIAL_REMINDERS_ENABLED_KEY)) !== "0";
}

export async function setTrialReminderPreference(enabled: boolean) {
  await AsyncStorage.setItem(TRIAL_REMINDERS_ENABLED_KEY, enabled ? "1" : "0");
  if (!enabled) await clearTrialReminderSchedule();
}

export async function clearTrialReminderSchedule() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const stored = JSON.parse(raw) as StoredSchedule;
      await Promise.all(stored.notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
    } catch {
      // Ignore an invalid local schedule and replace it below.
    }
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function scheduleTrialReminders(trialEndsAt: Date | string, language: "ar" | "en") {
  if (Platform.OS === "web") return;
  if (!(await getTrialReminderPreference())) return;
  const end = new Date(trialEndsAt);
  if (!Number.isFinite(end.getTime())) return;
  const endKey = end.toISOString();
  const existingRaw = await AsyncStorage.getItem(STORAGE_KEY);
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw) as StoredSchedule;
      if (existing.trialEndsAt === endKey) return;
    } catch {
      // Rebuild a malformed local schedule.
    }
  }
  await clearTrialReminderSchedule();
  const permissions = await Notifications.getPermissionsAsync();
  const status = permissions.granted ? permissions.status : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("trial-reminders", {
      name: language === "ar" ? "تذكيرات التجربة" : "Trial reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const notificationIds: string[] = [];
  for (const daysBefore of [3, 1]) {
    const triggerDate = new Date(end.getTime() - daysBefore * DAY_MS);
    if (triggerDate.getTime() <= Date.now()) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: language === "ar" ? "اقترب انتهاء تجربة عين التاجر" : "Your Ain Al-Tajir trial is ending",
        body: language === "ar" ? `باقي ${daysBefore} ${daysBefore === 1 ? "يوم" : "أيام"}. اختر باقة التاجر لاستمرار الوصول.` : `${daysBefore} day${daysBefore === 1 ? "" : "s"} remaining. Choose the Merchant plan to keep access.`,
        data: { route: "/module/subscription", kind: "trial-expiry" },
        ...(Platform.OS === "android" ? { channelId: "trial-reminders" } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
    });
    notificationIds.push(id);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ trialEndsAt: endKey, notificationIds } satisfies StoredSchedule));
}
