import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppHeader, IconButton, SectionTitle, StatusPill, TrialBanner } from "@/components/app-ui";
import { InteractiveTrendChart } from "@/components/interactive-charts";
import { ScreenContainer } from "@/components/screen-container";
import { SubscriptionNotice } from "@/components/subscription-notice";
import { useApp } from "@/lib/app-context";
import type { ChartRange } from "@/lib/chart-data";
import { branchPerformance, dashboardMetrics, recommendedActions } from "@/lib/demo-data";
import { trpc } from "@/lib/trpc";

const TONE = {
  primary: { color: "#0F766E", background: "#E4F2F0" },
  success: { color: "#16855B", background: "#E4F3EB" },
  warning: { color: "#D97706", background: "#FFF1D9" },
  error: { color: "#C73737", background: "#FBE7E7" },
} as const;

const QUICK_ACTIONS = [
  { id: "sale", icon: "point-of-sale", route: "/(tabs)/sales", label: { ar: "تسجيل بيع", en: "Record sale" }, tone: "#E4F2F0" },
  { id: "stock", icon: "inventory-2", route: "/(tabs)/inventory", label: { ar: "مراجعة المخزون", en: "Review stock" }, tone: "#EAF4F2" },
  { id: "replenishment", icon: "add-shopping-cart", route: "/inventory-operations", label: { ar: "إعادة التزويد", en: "Replenishment" }, tone: "#FFF1D9" },
  { id: "price", icon: "travel-explore", route: "/price-scout", label: { ar: "مقارنة الأسعار", en: "Compare prices" }, tone: "#F1E9FA" },
  { id: "analytics", icon: "insights", route: "/smart-analytics", label: { ar: "التحليلات الذكية", en: "Smart analytics" }, tone: "#E9EEFC" },
] as const;

export default function DashboardScreen() {
  const { t, isRTL, language } = useApp();
  const [period, setPeriod] = useState<ChartRange>("today");
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState<"all" | "products" | "branches" | "actions">("all");
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const inventoryBalances = trpc.inventory.balances.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const urgentCount = recommendedActions.filter((item) => item.priority === "high").length;
  useEffect(() => {
    void AsyncStorage.getItem("ain-altajir-welcome-seen").then((seen) => { if (!seen) setWelcomeVisible(true); });
  }, []);
  const dismissWelcome = async () => { setWelcomeVisible(false); await AsyncStorage.setItem("ain-altajir-welcome-seen", "1"); };
  const searchResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(language === "ar" ? "ar-SA" : "en-SA");
    if (!query) return [];
    return [
      ...(searchType === "all" || searchType === "products" ? (inventoryBalances.data ?? []).filter((item) => `${item.productName} ${item.productSku ?? ""}`.toLocaleLowerCase().includes(query)).map((item) => ({ id: `product-${item.id}`, label: item.productName, meta: item.productSku || (language === "ar" ? "منتج فعلي" : "Live product"), icon: "inventory-2" as const, route: "/(tabs)/inventory" })) : []),
      ...(searchType === "all" || searchType === "actions" ? QUICK_ACTIONS.filter((item) => item.label[language].toLocaleLowerCase().includes(query)).map((item) => ({ id: item.id, label: item.label[language], meta: language === "ar" ? "إجراء" : "Action", icon: item.icon, route: item.route })) : []),
      ...(searchType === "all" || searchType === "branches" ? branchPerformance.filter((branch) => branch.name[language].toLocaleLowerCase().includes(query)).map((branch) => ({ id: branch.id, label: branch.name[language], meta: language === "ar" ? "فرع" : "Branch", icon: "storefront" as const, route: "/module/branches" })) : []),
      ...(searchType === "all" || searchType === "actions" ? recommendedActions.filter((item) => item.title[language].toLocaleLowerCase().includes(query)).map((item) => ({ id: item.id, label: item.title[language], meta: language === "ar" ? "توصية" : "Recommendation", icon: item.icon, route: `/insight/${item.id}` })) : []),
    ].slice(0, 5);
  }, [inventoryBalances.data, language, search, searchType]);
  const periods = [
    { id: "today", label: t("today") },
    { id: "week", label: t("week") },
    { id: "month", label: t("month") },
  ] as { id: ChartRange; label: string }[];

  return (
    <ScreenContainer className="px-4">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader
          title={t("greeting")}
          subtitle={t("storeOverview")}
          trailing={<IconButton icon="notifications-none" label={t("notifications")} onPress={() => router.push("/notifications" as never)} />}
        />
        <TrialBanner compact />
        <SubscriptionNotice />

        <SectionTitle title={isRTL ? "إجراءات سريعة" : "Quick actions"} subtitle={isRTL ? "ابدأ المهمة الأكثر أهمية بأقل عدد من الخطوات." : "Start the most important task in fewer steps."} />
        <View style={[styles.quickGrid, isRTL && styles.quickGridReverse]}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable key={action.id} onPress={() => router.push(action.route as never)} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
              <View style={[styles.quickIcon, { backgroundColor: action.tone }]}><MaterialIcons name={action.icon} size={21} color="#0F766E" /></View>
              <Text className={`mt-2 text-xs font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{action.label[language]}</Text>
              <MaterialIcons name={isRTL ? "arrow-back" : "arrow-forward"} size={16} color="#8AA09C" style={[styles.quickArrow, isRTL && styles.quickArrowRTL]} />
            </Pressable>
          ))}
        </View>

        <View style={styles.searchCard}>
          <View style={[styles.searchRow, isRTL && styles.rowReverse]}>
            <MaterialIcons name="search" size={21} color="#0F766E" />
            <TextInput value={search} onChangeText={setSearch} placeholder={isRTL ? "ابحث عن منتج أو فرع أو إجراء…" : "Search a product, branch, or action…"} placeholderTextColor="#8AA09C" returnKeyType="search" style={[styles.searchInput, isRTL && styles.searchInputRTL]} accessibilityLabel={isRTL ? "البحث السريع" : "Quick search"} />
            {search ? <Pressable onPress={() => setSearch("")} accessibilityLabel={isRTL ? "مسح البحث" : "Clear search"}><MaterialIcons name="close" size={19} color="#63847D" /></Pressable> : null}
          </View>
          <View style={[styles.searchFilters, isRTL && styles.rowReverse]}>{(["all", "products", "branches", "actions"] as const).map((type) => <Pressable key={type} onPress={() => setSearchType(type)} style={[styles.searchFilter, searchType === type && styles.searchFilterActive]}><Text style={[styles.searchFilterText, searchType === type && styles.searchFilterTextActive]}>{type === "all" ? (isRTL ? "الكل" : "All") : type === "products" ? (isRTL ? "المنتجات" : "Products") : type === "branches" ? (isRTL ? "الفروع" : "Branches") : (isRTL ? "الإجراءات" : "Actions")}</Text></Pressable>)}</View>
          {search ? <View style={styles.searchResults}>{searchResults.length ? searchResults.map((result) => <Pressable key={`${result.id}-${result.route}`} onPress={() => { setSearch(""); router.push(result.route as never); }} style={({ pressed }) => [styles.searchResult, pressed && styles.pressed]}><MaterialIcons name={result.icon as keyof typeof MaterialIcons.glyphMap} size={18} color="#0F766E" /><View style={styles.flex}><Text numberOfLines={1} style={[styles.searchResultText, isRTL && styles.right]}>{result.label}</Text><Text style={[styles.searchResultMeta, isRTL && styles.right]}>{result.meta}</Text></View><MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={18} color="#8AA09C" /></Pressable>) : <Text style={[styles.noResults, isRTL && styles.right]}>{inventoryBalances.isLoading ? (isRTL ? "جارٍ تحميل المنتجات…" : "Loading products…") : (isRTL ? "لا توجد نتائج مطابقة" : "No matching results")}</Text>}</View> : null}
        </View>

        <Pressable onPress={() => urgentCount > 0 && router.push(`/insight/${recommendedActions.find((item) => item.priority === "high")?.id}` as never)} style={({ pressed }) => [styles.urgentCard, pressed && styles.pressed]}>
          <View style={styles.urgentIcon}><MaterialIcons name="priority-high" size={20} color="#C73737" /></View>
          <View style={styles.flex}><Text style={[styles.urgentTitle, isRTL && styles.right]}>{isRTL ? `${urgentCount} مهام عاجلة تحتاج مراجعة` : `${urgentCount} urgent tasks need review`}</Text><Text style={[styles.urgentDetail, isRTL && styles.right]}>{isRTL ? "ابدأ بالأثر الأعلى قبل نهاية اليوم." : "Start with the highest-impact item before end of day."}</Text></View><MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color="#C73737" />
        </Pressable>

        <View className="mb-5 rounded-2xl bg-surface p-1">
          <View className={`flex-row ${isRTL ? "flex-row-reverse" : ""}`}>
            {periods.map((item) => (
              <Pressable key={item.id} onPress={() => setPeriod(item.id)} style={[styles.segment, period === item.id && styles.segmentActive]}>
                <Text className={`text-sm font-semibold ${period === item.id ? "text-white" : "text-muted"}`}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mb-7 flex-row flex-wrap justify-between gap-y-3">
          {dashboardMetrics.map((metric) => {
            const tone = TONE[metric.tone];
            return (
              <Pressable key={metric.id} onPress={() => metric.id === "loss" && router.push("/(tabs)/losses" as never)} style={({ pressed }) => [styles.metricCard, pressed && styles.pressed]}>
                <View className={`mb-3 flex-row items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                  <View style={[styles.metricIcon, { backgroundColor: tone.background }]}>
                    <MaterialIcons name={metric.icon as keyof typeof MaterialIcons.glyphMap} size={20} color={tone.color} />
                  </View>
                  <Text style={{ color: metric.tone === "error" ? "#C73737" : "#16855B", fontSize: 12, fontWeight: "700" }}>{metric.delta}</Text>
                </View>
                <Text className={`text-xs font-semibold text-muted ${isRTL ? "text-right" : "text-left"}`}>{metric.label[language]}</Text>
                <View className={`mt-1 flex-row items-end gap-1 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
                  <Text className="text-xl font-bold text-foreground">{metric.value}</Text>
                  <Text className="pb-0.5 text-xs font-semibold text-muted">{t("sar")}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="mb-7">
          <InteractiveTrendChart range={period} />
        </View>

        <SectionTitle title={t("whatToday")} subtitle={t("orderedByImpact")} />
        <View className="mb-7 gap-3">
          {recommendedActions.map((item) => (
            <Pressable key={item.id} onPress={() => router.push(`/insight/${item.id}` as never)} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
              <View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                <View className={`mt-0.5 h-11 w-11 items-center justify-center rounded-2xl ${item.priority === "high" ? "bg-error/10" : "bg-warning/10"}`}>
                  <MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={22} color={item.priority === "high" ? "#C73737" : "#D97706"} />
                </View>
                <View className="flex-1">
                  <View className={`flex-row items-center justify-between gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <Text className={`flex-1 text-[15px] font-bold leading-6 text-foreground ${isRTL ? "text-right" : "text-left"}`}>{item.title[language]}</Text>
                    <StatusPill label={t(item.priority)} tone={item.priority === "high" ? "error" : "warning"} />
                  </View>
                  <Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{item.detail[language]}</Text>
                  <View className={`mt-3 flex-row items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                    <Text className="text-xs font-bold text-error">{item.impact} {t("sar")}</Text>
                    <View className={`flex-row items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <Text className="text-xs font-semibold text-primary">{t("viewDetails")}</Text>
                      <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={18} color="#0F766E" />
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <SectionTitle title={isRTL ? "أداء الفروع" : "Branch performance"} action={isRTL ? "المقارنة" : "Compare"} />
        <View className="mb-3 rounded-3xl border border-border bg-surface px-4">
          {branchPerformance.map((branch, index) => (
            <View key={branch.id} className={`flex-row items-center gap-3 py-4 ${index < branchPerformance.length - 1 ? "border-b border-border" : ""} ${isRTL ? "flex-row-reverse" : ""}`}>
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-background">
                <MaterialIcons name="storefront" size={20} color="#0F766E" />
              </View>
              <View className="flex-1">
                <Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{branch.name[language]}</Text>
                <Text className={`mt-0.5 text-xs text-muted ${isRTL ? "text-right" : "text-left"}`}>{branch.sales} {t("sar")}</Text>
              </View>
              <Text className={`text-xs font-bold ${branch.delta.startsWith("-") ? "text-error" : "text-success"}`}>{branch.delta}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Modal animationType="fade" transparent visible={welcomeVisible} onRequestClose={() => void dismissWelcome()}>
        <View style={styles.modalBackdrop}><View style={styles.welcomeCard}><View style={styles.welcomeIcon}><MaterialIcons name="waving-hand" size={30} color="#FFFFFF" /></View><Text style={[styles.welcomeTitle, isRTL && styles.right]}>{isRTL ? "مرحبًا بك في عين التاجر" : "Welcome to Ain Al-Tajir"}</Text><Text style={[styles.welcomeDetail, isRTL && styles.right]}>{isRTL ? "خلال 7 أيام مجانية، ستعمل جميع أدوات المتجر ببياناتك الحقيقية لمساعدتك على اتخاذ قرارات أسرع." : "During your 7-day free period, every tool works with your real store data to help you make faster decisions."}</Text><View style={styles.welcomeFeatures}>{[{ icon: "insights", ar: "تحليلات وتوصيات مخصصة", en: "Personalized analytics" }, { icon: "inventory-2", ar: "مخزون وتنبيهات إعادة التزويد", en: "Inventory and replenishment alerts" }, { icon: "storefront", ar: "مقارنة أداء الفروع", en: "Branch performance comparison" }].map((item) => <View key={item.ar} style={[styles.welcomeFeature, isRTL && styles.rowReverse]}><MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={19} color="#0F766E" /><Text style={[styles.welcomeFeatureText, isRTL && styles.right]}>{isRTL ? item.ar : item.en}</Text></View>)}</View><Pressable onPress={() => void dismissWelcome()} style={({ pressed }) => [styles.welcomeButton, pressed && styles.pressed]}><Text style={styles.welcomeButtonText}>{isRTL ? "ابدأ إدارة متجرك" : "Start managing your store"}</Text><MaterialIcons name={isRTL ? "arrow-back" : "arrow-forward"} size={18} color="#FFFFFF" /></Pressable></View></View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24, paddingTop: 12 },
  segment: { alignItems: "center", borderRadius: 13, flex: 1, justifyContent: "center", minHeight: 40 },
  segmentActive: { backgroundColor: "#0F766E" },
  metricCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 20, borderWidth: 1, minHeight: 142, padding: 14, width: "48.5%" },
  metricIcon: { alignItems: "center", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22, marginTop: 10 },
  quickGridReverse: { flexDirection: "row-reverse" },
  quickCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 18, borderWidth: 1, minHeight: 106, padding: 12, position: "relative", width: "47.5%" },
  quickIcon: { alignItems: "center", borderRadius: 11, height: 36, justifyContent: "center", width: 36 },
  quickArrow: { bottom: 12, position: "absolute", right: 12 },
  quickArrowRTL: { left: 12, right: undefined },
  flex: { flex: 1 },
  rowReverse: { flexDirection: "row-reverse" },
  right: { textAlign: "right" },
  searchCard: { backgroundColor: "#F7FBFA", borderColor: "#CFE4DF", borderRadius: 18, borderWidth: 1, marginBottom: 14, padding: 10 },
  searchRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  searchInput: { color: "#14201F", flex: 1, fontSize: 13, minHeight: 38, paddingHorizontal: 4 },
  searchInputRTL: { textAlign: "right" },
  searchResults: { borderTopColor: "#DDE7E4", borderTopWidth: 1, marginTop: 8, paddingTop: 5 },
  searchResult: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 38, paddingHorizontal: 3 },
  searchResultText: { color: "#14201F", flex: 1, fontSize: 12, fontWeight: "700" },
  searchResultMeta: { color: "#63847D", fontSize: 10, marginTop: 2 },
  searchFilters: { flexDirection: "row", gap: 6, marginTop: 8 },
  searchFilter: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 10, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  searchFilterActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  searchFilterText: { color: "#63847D", fontSize: 10, fontWeight: "700" },
  searchFilterTextActive: { color: "#FFFFFF" },
  noResults: { color: "#63847D", fontSize: 12, paddingVertical: 8 },
  urgentCard: { alignItems: "center", backgroundColor: "#FBE7E7", borderColor: "#F1BABA", borderRadius: 18, flexDirection: "row", gap: 10, marginBottom: 22, padding: 13 },
  urgentIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
  urgentTitle: { color: "#9F2F2F", fontSize: 13, fontWeight: "800" },
  urgentDetail: { color: "#A85E00", fontSize: 11, marginTop: 3 },
  modalBackdrop: { alignItems: "center", backgroundColor: "rgba(11,59,58,0.55)", flex: 1, justifyContent: "center", padding: 20 },
  welcomeCard: { backgroundColor: "#FFFFFF", borderRadius: 28, maxWidth: 430, padding: 22, width: "100%" },
  welcomeIcon: { alignItems: "center", alignSelf: "center", backgroundColor: "#0F766E", borderRadius: 20, height: 58, justifyContent: "center", marginBottom: 14, width: 58 },
  welcomeTitle: { color: "#14201F", fontSize: 21, fontWeight: "800", textAlign: "center" },
  welcomeDetail: { color: "#63847D", fontSize: 13, lineHeight: 21, marginTop: 8, textAlign: "center" },
  welcomeFeatures: { gap: 11, marginTop: 18 },
  welcomeFeature: { alignItems: "center", flexDirection: "row", gap: 9 },
  welcomeFeatureText: { color: "#14201F", flex: 1, fontSize: 12, fontWeight: "700" },
  welcomeButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 16, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 22, minHeight: 50, paddingHorizontal: 14 },
  welcomeButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  actionCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 20, borderWidth: 1, padding: 15 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
