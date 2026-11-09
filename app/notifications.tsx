import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader, StatusPill } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";

type Notification = { id: string; title: { ar: string; en: string }; detail: { ar: string; en: string }; time: { ar: string; en: string }; tone: "error" | "warning" | "success"; icon: keyof typeof MaterialIcons.glyphMap; route: string; unread: boolean };

const NOTIFICATIONS: Notification[] = [
  { id: "stock", title: { ar: "مخزون القهوة العربية منخفض", en: "Arabic coffee stock is low" }, detail: { ar: "التغطية المتوقعة 3 أيام. راجع اقتراح إعادة التزويد.", en: "Expected coverage is 3 days. Review the replenishment suggestion." }, time: { ar: "منذ 12 دقيقة", en: "12 min ago" }, tone: "error", icon: "inventory-2", route: "/inventory-operations", unread: true },
  { id: "receipt", title: { ar: "فرق استلام يحتاج اعتمادًا", en: "Receipt discrepancy needs approval" }, detail: { ar: "الكمية المستلمة أقل من 80% من المطلوب.", en: "Received quantity is below 80% of the requested amount." }, time: { ar: "منذ 34 دقيقة", en: "34 min ago" }, tone: "warning", icon: "fact-check", route: "/replenishment-history", unread: true },
  { id: "branch", title: { ar: "أداء فرع الدمام تراجع", en: "Dammam branch performance declined" }, detail: { ar: "راجع المبيعات مقارنة بالفترة السابقة.", en: "Review sales compared with the previous period." }, time: { ar: "منذ ساعة", en: "1 hour ago" }, tone: "warning", icon: "trending-down", route: "/smart-analytics", unread: true },
  { id: "sync", title: { ar: "تمت مزامنة بيانات المتجر", en: "Store data synced" }, detail: { ar: "آخر تحديث للبيانات اكتمل بنجاح.", en: "The latest data update completed successfully." }, time: { ar: "اليوم", en: "Today" }, tone: "success", icon: "sync", route: "/(tabs)/dashboard", unread: false },
];

export default function NotificationsScreen() {
  const { isRTL, language } = useApp();
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [read, setRead] = useState<string[]>([]);
  const unreadCount = NOTIFICATIONS.filter((item) => item.unread && !read.includes(item.id)).length;
  const items = useMemo(() => filter === "unread" ? NOTIFICATIONS.filter((item) => item.unread && !read.includes(item.id)) : NOTIFICATIONS, [filter, read]);
  const toneColor = (tone: Notification["tone"]) => tone === "error" ? "#C73737" : tone === "warning" ? "#D97706" : "#16855B";

  const open = (item: Notification) => { setRead((current) => current.includes(item.id) ? current : [...current, item.id]); router.push(item.route as never); };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4">
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.backButton}><MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" /></Pressable>
      <AppHeader title={isRTL ? "مركز الإشعارات" : "Notification center"} subtitle={isRTL ? "تنبيهات فورية للمهام والتحديثات التي تؤثر على متجرك." : "Instant alerts for tasks and updates that affect your store."} />
      <View style={styles.liveBanner}><MaterialIcons name="bolt" size={19} color="#0F766E" /><Text style={[styles.liveText, isRTL && styles.right]}>{isRTL ? "المركز محدث تلقائيًا عند وصول تنبيه جديد" : "The center updates automatically when a new alert arrives"}</Text></View>
      <View style={[styles.summary, isRTL && styles.rowReverse]}><View><Text style={[styles.summaryValue, isRTL && styles.right]}>{unreadCount}</Text><Text style={[styles.summaryLabel, isRTL && styles.right]}>{isRTL ? "غير مقروءة" : "Unread"}</Text></View><View style={styles.summaryDivider} /><View><Text style={[styles.summaryValue, isRTL && styles.right]}>{NOTIFICATIONS.length}</Text><Text style={[styles.summaryLabel, isRTL && styles.right]}>{isRTL ? "كل التنبيهات" : "All alerts"}</Text></View></View>
      <View style={[styles.tabs, isRTL && styles.rowReverse]}>{(["unread", "all"] as const).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.tab, filter === item && styles.tabActive]}><Text style={[styles.tabText, filter === item && styles.tabTextActive]}>{item === "unread" ? (isRTL ? "غير مقروءة" : "Unread") : (isRTL ? "الكل" : "All")}</Text></Pressable>)}</View>
      <View style={styles.list}>{items.map((item) => <Pressable key={item.id} onPress={() => open(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={[styles.icon, { backgroundColor: `${toneColor(item.tone)}18` }]}><MaterialIcons name={item.icon} size={21} color={toneColor(item.tone)} /></View><View style={styles.flex}><View style={[styles.cardHeader, isRTL && styles.rowReverse]}><Text style={[styles.title, isRTL && styles.right]}>{item.title[language]}</Text>{item.unread && !read.includes(item.id) ? <StatusPill label={isRTL ? "جديد" : "New"} tone={item.tone} /> : null}</View><Text style={[styles.detail, isRTL && styles.right]}>{item.detail[language]}</Text><Text style={[styles.time, isRTL && styles.right]}>{item.time[language]}</Text></View><MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={21} color="#8AA09C" /></Pressable>)}</View>
      {!items.length ? <View style={styles.empty}><MaterialIcons name="notifications-off" size={28} color="#0F766E" /><Text style={styles.emptyTitle}>{isRTL ? "لا توجد إشعارات جديدة" : "No new notifications"}</Text><Text style={styles.emptyDetail}>{isRTL ? "سنعرض هنا أي تحديث يحتاج انتباهك." : "Updates that need your attention will appear here."}</Text></View> : null}
    </ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 28, paddingTop: 12 }, backButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 20, width: 44 }, liveBanner: { alignItems: "center", backgroundColor: "#EAF4F2", borderColor: "#B8DAD6", borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 8, marginBottom: 14, padding: 12 }, liveText: { color: "#176458", flex: 1, fontSize: 11, fontWeight: "700" }, summary: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 19, borderWidth: 1, flexDirection: "row", justifyContent: "space-around", marginBottom: 14, padding: 15 }, summaryValue: { color: "#14201F", fontSize: 22, fontWeight: "800" }, summaryLabel: { color: "#63847D", fontSize: 11, marginTop: 2 }, summaryDivider: { backgroundColor: "#DDE7E4", height: 36, width: 1 }, tabs: { backgroundColor: "#F0F5F3", borderRadius: 13, flexDirection: "row", gap: 4, marginBottom: 14, padding: 4 }, tab: { alignItems: "center", borderRadius: 10, flex: 1, minHeight: 36, justifyContent: "center" }, tabActive: { backgroundColor: "#0F766E" }, tabText: { color: "#63847D", fontSize: 12, fontWeight: "700" }, tabTextActive: { color: "#FFFFFF" }, list: { gap: 10 }, card: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 19, borderWidth: 1, flexDirection: "row", gap: 11, padding: 14 }, icon: { alignItems: "center", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, flex: { flex: 1 }, cardHeader: { alignItems: "flex-start", flexDirection: "row", gap: 6, justifyContent: "space-between" }, title: { color: "#14201F", flex: 1, fontSize: 13, fontWeight: "800", lineHeight: 20 }, detail: { color: "#63847D", fontSize: 11, lineHeight: 18, marginTop: 3 }, time: { color: "#8AA09C", fontSize: 10, marginTop: 5 }, rowReverse: { flexDirection: "row-reverse" }, right: { textAlign: "right" }, empty: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 20, borderWidth: 1, padding: 28 }, emptyTitle: { color: "#14201F", fontSize: 15, fontWeight: "800", marginTop: 10 }, emptyDetail: { color: "#63847D", fontSize: 12, marginTop: 5, textAlign: "center" }, pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] }, });
