import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { AppHeader, PrimaryButton, StatusPill } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { SubscriptionPanel } from "@/components/subscription-panel";
import { StoreIntegrationsPanel } from "@/components/store-integrations-panel";
import { useApp } from "@/lib/app-context";
import { branchPerformance, moduleContent, type ModuleSlug } from "@/lib/demo-data";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { clearTrialReminderSchedule, getTrialReminderPreference, scheduleTrialReminders, setTrialReminderPreference } from "@/lib/trial-notifications";

const ACTIVITY: Record<ModuleSlug, { ar: string; en: string; metaAr: string; metaEn: string; status: "success" | "warning" | "error" | "primary" }[]> = {
  purchases: [
    { ar: "طلب شراء #PO-1042", en: "Purchase order #PO-1042", metaAr: "12 منتجًا • بانتظار الاعتماد", metaEn: "12 products • Awaiting approval", status: "warning" },
    { ar: "طلب شراء #PO-1038", en: "Purchase order #PO-1038", metaAr: "تم الاستلام اليوم", metaEn: "Received today", status: "success" },
  ],
  suppliers: [
    { ar: "شركة إمداد الخليج", en: "Gulf Supply Co.", metaAr: "التزام 96% • توريد 3 أيام", metaEn: "96% reliability • 3-day lead time", status: "success" },
    { ar: "مورد المشروبات المتحدة", en: "United Beverages Supplier", metaAr: "ارتفعت الأسعار 9%", metaEn: "Prices increased 9%", status: "error" },
  ],
  branches: branchPerformance.map((branch) => ({ ar: branch.name.ar, en: branch.name.en, metaAr: `${branch.sales} ر.س • ${branch.delta}`, metaEn: `SAR ${branch.sales} • ${branch.delta}`, status: branch.delta.startsWith("-") ? "error" : "success" })),
  integrations: [
    { ar: "سلة", en: "Salla", metaAr: "متصل • تمت المزامنة قبل 8 دقائق", metaEn: "Connected • Synced 8 min ago", status: "success" },
    { ar: "ملف المخزون", en: "Inventory file", metaAr: "يحتاج إلى تحديث", metaEn: "Update required", status: "warning" },
    { ar: "زد", en: "Zid", metaAr: "غير متصل", metaEn: "Not connected", status: "primary" },
  ],
  notifications: [
    { ar: "مخزون القهوة العربية منخفض", en: "Arabic coffee stock is low", metaAr: "سينفد خلال 3 أيام", metaEn: "Expected to run out in 3 days", status: "error" },
    { ar: "فشلت مزامنة ملف المخزون", en: "Inventory file sync failed", metaAr: "نحتاج إلى إعادة الاتصال بالمصدر", metaEn: "The source needs to be reconnected", status: "warning" },
  ],
  tasks: [],
  reports: [
    { ar: "تقرير المبيعات الأسبوعي", en: "Weekly sales report", metaAr: "PDF • تم إنشاؤه اليوم", metaEn: "PDF • Created today", status: "success" },
    { ar: "تقرير مخزون الفروع", en: "Branch inventory report", metaAr: "Excel • آخر 30 يومًا", metaEn: "Excel • Last 30 days", status: "primary" },
  ],
  employees: [
    { ar: "خالد العتيبي", en: "Khalid Alotaibi", metaAr: "مالك المتجر • وصول كامل", metaEn: "Store owner • Full access", status: "success" },
    { ar: "نورة السالم", en: "Noura Alsalem", metaAr: "مديرة فرع الرياض", metaEn: "Riyadh branch manager", status: "primary" },
  ],
  settings: [],
  subscription: [
    { ar: "استخدام الذكاء الاصطناعي", en: "AI usage", metaAr: "680 من 1,000 تحليل", metaEn: "680 of 1,000 analyses", status: "warning" },
    { ar: "مصادر البيانات", en: "Data sources", metaAr: "2 من 5 تكاملات", metaEn: "2 of 5 integrations", status: "success" },
  ],
  admin: [
    { ar: "مزامنات تحتاج مراجعة", en: "Syncs needing review", metaAr: "11 خطأ خلال آخر 24 ساعة", metaEn: "11 errors in the last 24 hours", status: "error" },
    { ar: "استخدام الذكاء الاصطناعي", en: "AI usage", metaAr: "18,420 طلبًا هذا الشهر", metaEn: "18,420 requests this month", status: "primary" },
  ],
};

export default function ModuleScreen() {
  const { slug: rawSlug } = useLocalSearchParams<{ slug: string }>();
  const slug = (rawSlug && rawSlug in moduleContent ? rawSlug : "notifications") as ModuleSlug;
  if (slug === "purchases") return <Redirect href="/procurement" />;
  if (slug === "suppliers") return <Redirect href="/procurement?tab=suppliers" />;
  if (slug === "branches") return <Redirect href="/branch-transfers" />;
  if (slug === "subscription") return <ModuleScreenContent slug={slug} />;
  return <SubscriptionGuard><ModuleScreenContent slug={slug} /></SubscriptionGuard>;
}

function ModuleScreenContent({ slug }: { slug: ModuleSlug }) {
  const { t, isRTL, language, setLanguage, tasks, toggleTask } = useApp();
  const { isAuthenticated } = useAuth();
  const account = trpc.access.status.useQuery(undefined, { enabled: slug === "settings" && isAuthenticated, retry: false, staleTime: 30_000 });
  const [trialRemindersEnabled, setTrialRemindersEnabled] = useState(true);
  const module = moduleContent[slug];
  const activities = ACTIVITY[slug];

  useEffect(() => {
    if (slug === "settings") void getTrialReminderPreference().then(setTrialRemindersEnabled);
  }, [slug]);

  const changeTrialReminderPreference = async (enabled: boolean) => {
    setTrialRemindersEnabled(enabled);
    await setTrialReminderPreference(enabled);
    if (enabled && account.data?.access.kind === "trial" && account.data.profile?.trialEndsAt) {
      await scheduleTrialReminders(account.data.profile.trialEndsAt, language);
    } else if (!enabled) {
      await clearTrialReminderSchedule();
    }
  };

  const showConfirm = (title: string) => {
    haptic.light();
    Alert.alert(title, isRTL ? "تم تسجيل الطلب للمراجعة. لن ينفذ أي إجراء حساس دون تأكيدك." : "The request is ready for review. No sensitive action will run without your confirmation.");
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" /></Pressable>
        <AppHeader title={module.title[language]} subtitle={module.subtitle[language]} />

        {slug !== "subscription" && module.stats.length ? (
          <View className="mb-6 flex-row flex-wrap justify-between gap-y-3">
            {module.stats.map((stat) => (
              <View key={stat.label.ar} style={styles.statCard}>
                <Text className={`text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{stat.label[language]}</Text>
                <Text className={`mt-2 text-xl font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{stat.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {slug === "settings" ? (
          <View className="gap-4">
            <View className="rounded-3xl border border-border bg-surface p-4">
              <Text className={`mb-3 text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{t("language")}</Text>
              <View className={`flex-row gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                {(["ar", "en"] as const).map((item) => (
                  <Pressable key={item} onPress={() => void setLanguage(item)} style={[styles.languageChoice, language === item && styles.languageChoiceActive]}>
                    <Text className={`text-sm font-bold ${language === item ? "text-white" : "text-foreground"}`}>{item === "ar" ? t("arabic") : t("english")}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View className="rounded-3xl border border-border bg-surface p-4">
              <View className={`flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                <MaterialIcons name="notifications-active" size={22} color="#0F766E" />
                <View className="flex-1">
                  <Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "تذكيرات انتهاء التجربة" : "Trial expiry reminders"}</Text>
                  <Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "تنبيه قبل 3 أيام وقبل يوم من انتهاء الفترة المجانية." : "Get reminders 3 days and 1 day before the free period ends."}</Text>
                </View>
                <Switch accessibilityLabel={isRTL ? "تفعيل تذكيرات انتهاء التجربة" : "Enable trial expiry reminders"} value={trialRemindersEnabled} onValueChange={(value) => void changeTrialReminderPreference(value)} trackColor={{ false: "#CBD8D5", true: "#9FCAC2" }} thumbColor={trialRemindersEnabled ? "#0F766E" : "#F4F7F6"} />
              </View>
            </View>
            {[
              { icon: "notifications-none", title: isRTL ? "إعدادات التنبيهات" : "Alert preferences" },
              { icon: "shield", title: isRTL ? "الأمان وتسجيل الدخول" : "Security and sign-in" },
              { icon: "currency-exchange", title: isRTL ? "العملة والضريبة" : "Currency and tax" },
            ].map((item) => (
              <Pressable key={item.title} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
                <View className={`flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}><MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={22} color="#0F766E" /><Text className={`flex-1 text-sm font-semibold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{item.title}</Text><MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={21} color="#8AA09C" /></View>
              </Pressable>
            ))}
          </View>
        ) : slug === "tasks" ? (
          <View className="gap-3">
            {tasks.map((task) => (
              <Pressable key={task.id} onPress={() => toggleTask(task.id)} style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]}>
                <View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <MaterialIcons name={task.completed ? "check-circle" : "radio-button-unchecked"} size={24} color={task.completed ? "#16855B" : "#D97706"} />
                  <View className="flex-1"><Text className={`text-sm font-bold leading-6 ${task.completed ? "text-muted line-through" : "text-foreground"} ${isRTL ? "text-right" : "text-left"}`}>{task.id === "task-1" ? (isRTL ? "مراجعة فرق المخزون في فرع الرياض" : "Review Riyadh branch stock variance") : task.id === "task-2" ? (isRTL ? "اعتماد طلب إعادة المخزون" : "Approve inventory replenishment order") : task.title}</Text><Text className={`mt-1 text-xs text-muted ${isRTL ? "text-right" : "text-left"}`}>{task.dueLabel}</Text></View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : slug === "subscription" ? (
          <SubscriptionPanel />
        ) : slug === "integrations" ? (
          <StoreIntegrationsPanel />
        ) : (
          <View className="gap-3">
            {activities.map((activity) => (
              <Pressable key={activity.ar} style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]}>
                <View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-background"><MaterialIcons name={module.icon} size={21} color="#0F766E" /></View>
                  <View className="flex-1"><Text className={`text-sm font-bold leading-6 text-foreground ${isRTL ? "text-right" : "text-left"}`}>{language === "ar" ? activity.ar : activity.en}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{language === "ar" ? activity.metaAr : activity.metaEn}</Text></View>
                  <StatusPill label={activity.status === "success" ? (isRTL ? "طبيعي" : "Normal") : activity.status === "error" ? t("high") : activity.status === "warning" ? t("medium") : t("open")} tone={activity.status} />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {slug === "purchases" ? <View className="mt-5"><PrimaryButton label={isRTL ? "إنشاء أمر شراء مقترح" : "Create suggested purchase order"} icon="add-shopping-cart" onPress={() => showConfirm(isRTL ? "أمر شراء مقترح" : "Suggested purchase order")} /></View> : null}
        {slug === "reports" ? <View className="mt-5"><PrimaryButton label={isRTL ? "طلب تصدير جديد" : "Request new export"} icon="download" onPress={() => showConfirm(isRTL ? "طلب تصدير" : "Export request")} /></View> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28, paddingTop: 12 },
  backButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 22, width: 44 },
  statCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 19, borderWidth: 1, minHeight: 102, padding: 14, width: "48.5%" },
  activityCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 20, borderWidth: 1, padding: 15 },
  settingRow: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 18, borderWidth: 1, padding: 16 },
  languageChoice: { alignItems: "center", backgroundColor: "#F4F7F6", borderRadius: 14, flex: 1, justifyContent: "center", minHeight: 46 },
  languageChoiceActive: { backgroundColor: "#0F766E" },
  pressed: { opacity: 0.72 },
});
